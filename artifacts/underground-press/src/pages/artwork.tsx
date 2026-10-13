import { useState } from 'react';
import type { Asset } from '@workspace/api-client-react';
import { usePress } from '@/lib/press';
import { formatStyleReviewDate, StyleBadge, StyleReviewDialog, styleReviewDecision, styleReviewStatus, styleStatus, type StyleReviewDecision, type StyleReviewStatus } from '@/components/asset-style-review';
import { Head, Loading, ErrorState, Tag, statusKind, Empty, ApprovalDialog, WriteNote } from '@/components/bits';

const STYLE_STATUS_FILTERS: { value: 'all' | StyleReviewStatus; label: string }[] = [
  { value: 'all', label: 'All assets' },
  { value: 'current', label: 'Current' },
  { value: 'stale', label: 'Stale' },
  { value: 'unreviewed', label: 'Unreviewed' },
];

const STYLE_DECISION_FILTERS: { value: 'all' | StyleReviewDecision; label: string }[] = [
  { value: 'all', label: 'All decisions' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
];

export default function Artwork() {
  const { issue, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const [sty, setSty] = useState<Asset | null>(null);
  const [sel, setSel] = useState<{ a: Asset; d: 'approved' | 'rejected' } | null>(null);
  const [styleFilter, setStyleFilter] = useState<'all' | StyleReviewStatus>('all');
  const [decisionFilter, setDecisionFilter] = useState<'all' | StyleReviewDecision>('all');
  const [styleSort, setStyleSort] = useState<'oldest' | 'newest'>('oldest');
  if (isLoading) return <Loading />;
  if (error || !issue) return <ErrorState error={error} retry={refetch} />;
  const currentSty = sty ? issue.assets.find((asset) => asset.id === sty.id) ?? sty : null;
  const statusCounts = issue.assets.reduce<Record<StyleReviewStatus, number>>((counts, asset) => {
    counts[styleReviewStatus(asset, issue.artDirection)] += 1;
    return counts;
  }, { current: 0, stale: 0, unreviewed: 0 });
  const freshnessAssets = styleFilter === 'all'
    ? issue.assets
    : issue.assets.filter((asset) => styleReviewStatus(asset, issue.artDirection) === styleFilter);
  const decisionCounts = freshnessAssets.reduce<Record<StyleReviewDecision, number>>((counts, asset) => {
    const decision = styleReviewDecision(asset);
    if (decision) counts[decision] += 1;
    return counts;
  }, { passed: 0, failed: 0 });
  const visibleAssets = (decisionFilter === 'all'
    ? freshnessAssets
    : freshnessAssets.filter((asset) => styleReviewDecision(asset) === decisionFilter))
    .slice()
    .sort((a, b) => {
      const aDate = a.styleReview ? Date.parse(a.styleReview.at) : Number.NaN;
      const bDate = b.styleReview ? Date.parse(b.styleReview.at) : Number.NaN;
      const aHasDate = Number.isFinite(aDate);
      const bHasDate = Number.isFinite(bDate);
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
      if (!aHasDate || !bHasDate || aDate === bDate) return 0;
      return styleSort === 'oldest' ? aDate - bDate : bDate - aDate;
    });
  return (
    <div>
      <Head kicker="Art desk" title="Artwork review" />
      <WriteNote canWrite={canWrite} login={auth.login} />
      <p className="text-sm mb-4 max-w-2xl">Look at it yourself. Check credit, source, and resolution. Original working files are readable only by signed-in collaborators and remain private after approval; approval does not publish them. Review names are self-attested and are not tied to verified account roles.</p>
      {issue.assets.length === 0 ? <Empty title="Nothing to review" body="Upload assets first; they will queue here." /> : (
        <>
          <fieldset className="mb-4">
            <legend className="lbl">Style review status</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter artwork by style review status">
              {STYLE_STATUS_FILTERS.map(({ value, label }) => {
                const count = value === 'all' ? issue.assets.length : statusCounts[value];
                return (
                  <button
                    key={value}
                    type="button"
                    className={`btn ${styleFilter === value ? 'btn-mustard' : ''}`}
                    aria-pressed={styleFilter === value}
                    onClick={() => setStyleFilter(value)}
                    data-testid={`button-style-filter-${value}`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            <fieldset className="mt-4">
              <legend className="lbl">Style review decision</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter artwork by style review decision">
                {STYLE_DECISION_FILTERS.map(({ value, label }) => {
                  const count = value === 'all' ? freshnessAssets.length : decisionCounts[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`btn ${decisionFilter === value ? 'btn-mustard' : ''}`}
                      aria-pressed={decisionFilter === value}
                      onClick={() => setDecisionFilter(value)}
                      data-testid={`button-style-decision-filter-${value}`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <p className="text-xs mt-2" aria-live="polite" data-testid="text-artwork-filter-results">
              Showing {visibleAssets.length} of {issue.assets.length} assets
            </p>
          </fieldset>
          <div className="mb-4 max-w-sm">
            <label className="lbl" htmlFor="artwork-style-sort">Sort by style review date</label>
            <select
              id="artwork-style-sort"
              className="field"
              aria-label="Sort artwork by style review date"
              data-testid="select-artwork-style-sort"
              value={styleSort}
              onChange={(event) => setStyleSort(event.target.value as 'oldest' | 'newest')}
            >
              <option value="oldest">Oldest review first</option>
              <option value="newest">Newest review first</option>
            </select>
          </div>
          {visibleAssets.length === 0
            ? <Empty title="No matching artwork" body="Choose another style review status or decision to see assets." />
            : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleAssets.map((a) => (
                  <article key={a.id} className="card rise !p-3" data-testid={`card-art-${a.id}`}>
                    <div className="aspect-[4/3] pd-frame press-preview mb-2 flex items-center justify-center overflow-hidden">
                      {!canWrite ? (
                        <span className="mono text-xs text-center px-3">Log in to inspect private working files.</span>
                      ) : a.contentType.startsWith('image/') && a.objectPath ? (
                        <img src={`${import.meta.env.BASE_URL}api/storage${a.objectPath}`} alt={a.caption || a.name} className="w-full h-full object-contain" data-pd-frame="true" loading="lazy" />
                      ) : <span className="mono text-xs">No preview ({a.contentType || 'unknown'})</span>}
                    </div>
                    <div className="flex justify-between gap-2"><b>{a.name}</b><Tag kind={statusKind(a.review)}>{a.review}</Tag></div>
                    <div className="text-xs mt-1">{a.caption}</div>
                    {canWrite
                      ? <a className="underline text-sm" href={`${import.meta.env.BASE_URL}api/storage${a.objectPath}`} target="_blank" rel="noopener noreferrer">Inspect original file</a>
                      : <span className="text-xs">Sign in to inspect the original file.</span>}
                    <div className="mono text-xs mt-1">{a.provenance.replace(/_/g, ' ')} / {a.dpi ? `${a.dpi} dpi` : 'dpi unset'} / pages {a.pages.join(', ') || 'none'}</div>
                    {a.reviewNotes && <div className="text-xs italic mt-1">Self-attested by {a.reviewer}: {a.reviewNotes}</div>}
                    <div className="mt-2">
                      <StyleBadge asset={a} issue={issue} canReview={canWrite} onReview={() => setSty(a)} />
                      <div className="text-xs mt-1" data-testid={`text-style-review-date-${a.id}`}>
                        {!a.styleReview
                          ? 'No style review recorded'
                          : formatStyleReviewDate(a.styleReview.at)
                            ? `Style review recorded ${formatStyleReviewDate(a.styleReview.at)}`
                            : 'Style review recorded; date unavailable'}
                      </div>
                      {a.styleReview && <div className="text-xs italic">Style review by {a.styleReview.reviewer} (account {a.styleReview.reviewerAccountId}): {a.styleReview.notes}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {!styleStatus(a, issue.artDirection).stale && <button className="btn btn-mustard" disabled={!canWrite} onClick={() => setSty(a)} data-testid={`button-style-review-${a.id}`}>Style checklist</button>}
                      <button className="btn btn-green" disabled={!canWrite} onClick={() => setSel({ a, d: 'approved' })} data-testid={`button-approve-art-${a.id}`}>Approve</button>
                      <button className="btn btn-red" disabled={!canWrite} onClick={() => setSel({ a, d: 'rejected' })} data-testid={`button-reject-art-${a.id}`}>Reject</button>
                    </div>
                  </article>
                ))}
              </div>}
        </>
      )}
      <StyleReviewDialog asset={currentSty} issue={issue} onClose={() => setSty(null)} />
      <ApprovalDialog open={!!sel} title={`${sel?.d === 'approved' ? 'Approve' : 'Reject'}: ${sel?.a.name ?? ''}`} pending={pending} danger={sel?.d === 'rejected'}
        description="Your entered name and notes are stored as a self-attestation, not verified against your signed-in account."
        ack="I looked at this asset in full and checked its credit, source and resolution." confirmLabel={sel?.d === 'approved' ? 'Approve asset' : 'Reject asset'}
        onClose={() => setSel(null)}
        onSubmit={async (reviewer, notes) => { if (sel && (await run({ action: 'review_asset', id: sel.a.id, decision: sel.d, reviewer, notes }, `Asset ${sel.d}`))) setSel(null); }} />
    </div>
  );
}
