import { useState } from 'react';
import { Download, Eye, ShieldCheck } from 'lucide-react';
import { useAuth } from '@workspace/replit-auth-web';
import { useGetIssue, getGetIssueQueryKey, useListVersions, useGetVersion, getListVersionsQueryKey, getGetVersionQueryKey } from '@workspace/api-client-react';
import { downloadJson, fmt, usePress } from '@/lib/press';
import { exportSnapshot } from '@/components/page-production';
import { Head, Loading, ErrorState, Empty, Tag, WriteNote } from '@/components/bits';
import type {
  PageOneApprovalVerificationDecision,
  PageOneApprovalVerificationStaleReasonsItem,
} from '@workspace/api-client-react';

const staleReasonDescriptions: Record<PageOneApprovalVerificationStaleReasonsItem, string> = {
  source_unavailable: 'The current locked Page 1 is missing or is no longer a recovered repository source.',
  source_identity_changed: 'The bound Page 1 source identity no longer matches the current cover.',
  source_content_changed: 'Page 1 content or a source-bound Page 1 asset changed, even though its source identity is the same.',
  reference_missing: 'There is no current front-page reference registered in Style Guide.',
  reference_unavailable: 'The current front-page reference is incomplete or has not been confirmed.',
  reference_image_unavailable: 'The exact confirmed front-page reference image is missing from private storage.',
  reference_version_changed: 'The current front-page reference is a different record or version from the one this review used.',
  reference_source_changed: 'The front-page reference’s recorded source identity changed.',
  reference_image_changed: 'The registered reference image binding (private file or external link) changed.',
  reference_record_changed: 'Other saved reference details changed within the same version, so the original reference fingerprint no longer matches.',
};

function Snapshot({ id }: { id: number }) {
  const q = useGetVersion(id, { query: { queryKey: getGetVersionQueryKey(id), retry: 1 } });
  if (q.isLoading) return <div className="skeleton h-40" />;
  if (q.error || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const s = q.data;
  return (
    <div className="card" data-testid="panel-snapshot">
      <div className="flex flex-wrap justify-between gap-2 mb-2">
        <h2 className="text-2xl font-black">Snapshot, revision {s.revision}</h2>
        <button className="btn" onClick={() => downloadJson(`underground-press-snapshot-${id}.json`, s)} data-testid="button-download-snapshot"><Download size={14} />Download</button>
      </div>
      <p className="mono text-xs mb-2">Read-only. {s.assets.length} assets / {s.puzzles.length} puzzles / {s.proofs.length} proofs. Viewing never restores or overwrites the working copy.</p>
      <ol className="text-sm space-y-0.5 columns-1 sm:columns-2">{s.pages.map((p) => <li key={p.number}>{p.number}. {p.title} <span className="mono text-xs">[{p.locked ? 'locked' : p.status}]</span></li>)}</ol>
    </div>
  );
}

export default function History() {
  const q = useListVersions({ query: { queryKey: getListVersionsQueryKey(), retry: 1 } });
  const [sel, setSel] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();
  const { auth, canWrite, run, pending } = usePress();
  const issueQ = useGetIssue({ query: { queryKey: getGetIssueQueryKey(), retry: 1 } });
  const [reviewRevision, setReviewRevision] = useState<number | null>(null);
  const [referenceId, setReferenceId] = useState('');
  const [documentIdentity, setDocumentIdentity] = useState('');
  const [comparisonNotes, setComparisonNotes] = useState('');
  const [decision, setDecision] = useState<PageOneApprovalVerificationDecision | ''>('');
  const [compared, setCompared] = useState(false);
  const issue = issueQ.data;
  const cover = issue?.pages.find((page) => page.number === 1);
  const reference = issue?.artDirection?.references.find((item) => item.kind === 'front_page');
  const isMyrtle = auth.roles.includes('myrtle_editor');
  const authoritativeCoverReady = !!cover && cover.locked && cover.provenance === 'repository_reference' &&
    !!cover.copy.trim() && !/SAMPLE (DRAFT|EDITORIAL)|NOT REPOSITORY COPY/i.test(cover.copy) &&
    /@[\da-f]{40}$/i.test(cover.sourceIdentity ?? '');
  const originalReferenceReady = !!reference && !!reference.title.trim() && !!reference.sourceIdentity.trim() &&
    !!(reference.assetSnapshot?.objectPath || reference.url) &&
    reference.imageAvailable !== false &&
    reference.approval?.reviewerRole === 'myrtle_editor' &&
    !!reference.approval.reviewerAccountId?.trim() && !!reference.approval.notes.trim();
  const stale = reviewRevision !== null && (!issue || issue.revision !== reviewRevision || reference?.id !== referenceId);
  const verifications = [...(issue?.pageOneApprovalHistory ?? [])].sort((a, b) => b.issueRevision - a.issueRevision);
  const beginVerification = () => {
    if (!issue || !reference) return;
    setReviewRevision(issue.revision);
    setReferenceId(reference.id);
    setDocumentIdentity('');
    setComparisonNotes('');
    setDecision('');
    setCompared(false);
  };
  const submitVerification = async () => {
    if (stale || !decision || !compared || documentIdentity.trim().length < 4 || comparisonNotes.trim().length < 20) return;
    if (await run({
      action: 'verify_page_one_approval',
      referenceId,
      approvalDocumentIdentity: documentIdentity.trim(),
      decision,
      checked: true,
      notes: comparisonNotes.trim(),
    }, decision === 'verified' ? 'Original Page 1 documentation verified' : 'Original Page 1 documentation review recorded', reviewRevision ?? undefined)) {
      setReviewRevision(null);
      setReferenceId('');
      setDocumentIdentity('');
      setComparisonNotes('');
      setDecision('');
      setCompared(false);
    }
  };
  const snaps = [...(issueQ.data?.pageSnapshots ?? [])].sort((a, b) => b.issueRevision - a.issueRevision);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const list = [...q.data].sort((a, b) => b.id - a.id);
  return (
    <div>
      <Head kicker="The morgue" title="History" />
      <section className="card mb-6" data-testid="panel-page-one-approval-history">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Original Page 1 approval documentation</h2>
            <p className="text-sm mt-1">A separate human comparison record. It never changes the locked cover, source images, snapshots, or Page 1 editorial/art approval fields.</p>
          </div>
          <button className="btn btn-green" disabled={!canWrite || !isMyrtle || !authoritativeCoverReady || !originalReferenceReady || pending || reviewRevision !== null}
            title={!canWrite ? 'Sign in with a verified Myrtle editor account.' : !isMyrtle ? 'A verified Myrtle editor account is required.' : !authoritativeCoverReady ? 'Recover the actual locked Page 1 source from its exact GitHub commit first.' : reference?.imageAvailable === false ? 'The exact confirmed image is missing. Register and confirm a new reference image in Style Guide first.' : !originalReferenceReady ? 'Register and confirm the exact original front-page reference in Style Guide first.' : ''}
            onClick={beginVerification} data-testid="button-begin-page-one-document-review">
            <ShieldCheck size={14} />Compare original approval document
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3 my-3 text-sm">
          <div className="card-flat">
            <b>Preserved authoritative cover</b>
            <div className="mono text-xs break-all mt-1">{cover?.sourceIdentity || 'No recovered source identity'}</div>
            <Tag kind={authoritativeCoverReady ? 'ok' : 'warn'}>{authoritativeCoverReady ? 'GitHub source recovered' : 'Source recovery required'}</Tag>
            {cover?.copy.trim() && <details className="mt-2">
              <summary className="cursor-pointer font-bold text-xs">Show the exact preserved Page 1 copy</summary>
              <div className="mono text-xs mt-2">{cover.title} · {cover.section || 'No section recorded'}</div>
              <p className="whitespace-pre-wrap text-sm mt-1">{cover.copy}</p>
            </details>}
            {!authoritativeCoverReady && <p className="text-xs mt-1"><a className="underline" href="/repository">Open Repository to preview the authoritative Issue #1 source.</a></p>}
          </div>
          <div className="card-flat">
            <b>Current front-page reference</b>
            {reference ? <>
              <div>{reference.title} · v{reference.version}</div>
              <div className="mono text-xs break-all">{reference.sourceIdentity}</div>
              <Tag kind={originalReferenceReady ? 'ok' : 'warn'}>{reference.imageAvailable === false ? 'Exact reference image unavailable' : originalReferenceReady ? 'Original identity confirmed' : 'Original reference not confirmed'}</Tag>
              {reference.imageAvailable === false && <p role="alert" className="card-flat text-xs mt-2 bg-[#d6a02133]" data-testid="notice-page-one-reference-image-unavailable">The exact confirmed reference image is unavailable in private storage. Register a new reference image and confirm it in Style Guide before recording a new verification. Earlier verification records are preserved.</p>}
              <p className="text-xs mt-1"><a className="underline" href="/style-guide" target="_blank" rel="noreferrer">Inspect the original reference and its saved confirmation in Style Guide.</a></p>
            </> : <><p className="text-xs">No front-page reference is registered.</p><a className="underline text-xs" href="/style-guide">Open Style Guide to register and inspect it.</a></>}
          </div>
        </div>
        <p className="card-flat text-xs">Uploads, imported approval claims, reference confirmation, and typed names do not verify original approval. Cite the original document/archive record and describe the direct comparison. This records whether the documentation supports approval; it does not grant or replace editorial or art approval.</p>
        {!canWrite && <WriteNote canWrite={false} login={auth.login} />}
        {reviewRevision !== null && (
          <div className="border-2 border-[#34503f] p-3 mt-3 space-y-2" data-testid="form-page-one-document-review">
            <p className="text-sm"><b>Current comparison target:</b> Page 1 source <span className="mono break-all">{cover?.sourceIdentity}</span>; front-page reference <span className="mono">{reference?.id} / v{reference?.version}</span>.</p>
            {!isMyrtle && <p className="text-xs text-[#5c1a20]">The signed-in account does not currently have the Myrtle editor role.</p>}
            {stale && <div role="alert" className="card-flat text-sm bg-[#d6a02133]" data-testid="notice-page-one-review-stale">The issue or selected reference changed after this review opened. Close it, inspect the latest source and reference, and reopen the form.</div>}
            <div>
              <label className="lbl" htmlFor="p1-approval-document">Original approval document or archival record identity (not an upload receipt)</label>
              <input id="p1-approval-document" className="field" value={documentIdentity} onChange={(event) => setDocumentIdentity(event.target.value)} placeholder="Archive shelf, original document title, date, or record identifier" data-testid="input-page-one-approval-document" />
            </div>
            <div>
              <div className="lbl">Does the original document verify approval of this exact cover?</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={decision === 'verified'} className={`btn ${decision === 'verified' ? 'btn-green' : ''}`} onClick={() => setDecision('verified')} data-testid="button-page-one-doc-verified">Yes, verified</button>
                <button type="button" aria-pressed={decision === 'not_verified'} className={`btn ${decision === 'not_verified' ? 'btn-red' : ''}`} onClick={() => setDecision('not_verified')} data-testid="button-page-one-doc-not-verified">No, not verified</button>
              </div>
            </div>
            <div>
              <label className="lbl" htmlFor="p1-approval-notes">Comparison and evidence notes (at least 20 characters)</label>
              <textarea id="p1-approval-notes" className="field" rows={4} value={comparisonNotes} onChange={(event) => setComparisonNotes(event.target.value)} placeholder="Describe what you compared on the preserved cover and reference, what the original record says, and any limits." data-testid="input-page-one-comparison-notes" />
            </div>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#34503f]" checked={compared} onChange={(event) => setCompared(event.target.checked)} data-testid="checkbox-page-one-comparison" />
              <span>I inspected the original approval document and directly compared it with the exact preserved Page 1 and the current front-page reference. This records documentary evidence only; it does not approve or alter the page.</span>
            </label>
            <p className="text-xs card-flat">The server rechecks the signed-in account’s Myrtle assignment and rejects a stale issue revision or reference. No reviewer name is typed into this record.</p>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setReviewRevision(null)}>Cancel</button>
              <button className="btn btn-mustard" disabled={!canWrite || !isMyrtle || !authoritativeCoverReady || !originalReferenceReady || !decision || documentIdentity.trim().length < 4 || comparisonNotes.trim().length < 20 || !compared || stale || pending}
                onClick={() => void submitVerification()} data-testid="button-submit-page-one-document-review">{pending ? 'Recording…' : 'Record documentary review'}</button>
            </div>
          </div>
        )}
        <div className="mt-4">
          <h3 className="text-lg font-black mb-2">Document review history (separate from locked snapshots)</h3>
          {verifications.length === 0 ? <p className="text-sm">No original approval-document comparison has been recorded.</p> : (
            <ol className="space-y-2">{verifications.map((record) => (
              <li key={record.id} className="card-flat text-sm" data-testid={`row-page-one-document-review-${record.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag kind={record.decision === 'verified' ? 'ok' : 'warn'}>{record.decision === 'verified' ? 'Document verified' : 'Not verified'}</Tag>
                  <Tag kind={record.isCurrent === false ? 'bad' : 'ok'}>{record.isCurrent === false ? 'Stale source/reference' : 'Bound to current source/reference'}</Tag>
                  <span>Verified Myrtle editor: {record.reviewer}{canWrite && record.reviewerAccountId ? ` (account ${record.reviewerAccountId})` : ''} · issue r{record.issueRevision} · {fmt(record.at)}</span>
                </div>
                {canWrite ? <>
                  <p className="mt-1"><b>Original record:</b> {record.approvalDocumentIdentity}</p>
                  <p><b>Cover source:</b> <span className="mono break-all">{record.sourceIdentity}</span></p>
                  <p><b>Front-page reference:</b> {record.referenceId} / v{record.referenceVersion}{record.referenceSourceIdentity ? ` · ${record.referenceSourceIdentity}` : ''}</p>
                  <p className="whitespace-pre-wrap mt-1"><b>Comparison notes:</b> {record.notes}</p>
                  {record.isCurrent === false && (
                    <div className="card-flat mt-3 space-y-2" data-testid={`notice-page-one-review-stale-${record.id}`}>
                      <b>Why this review is stale</b>
                      {record.staleReasons?.length ? (
                        <ul className="list-disc pl-5">
                          {record.staleReasons.map((reason) => <li key={reason}>{staleReasonDescriptions[reason]}</li>)}
                        </ul>
                      ) : (
                        <p>The server marked this review stale but did not provide a reason breakdown. Compare the current records before starting another review.</p>
                      )}
                      <div className="space-y-1">
                        <p><b>Current Page 1 source:</b> <span className="mono break-all">{cover?.sourceIdentity || 'No current Page 1 source identity'}</span></p>
                        <p><b>Current front-page reference:</b> {reference ? <>{reference.title} · {reference.id} / v{reference.version} · <span className="mono break-all">{reference.sourceIdentity}</span></> : 'No current front-page reference'}</p>
                        <p><b>Current reference image:</b> {reference?.assetSnapshot?.name || reference?.url || 'No current image binding'}</p>
                      </div>
                      <p className="flex flex-wrap gap-x-4 gap-y-1">
                        <a className="underline font-bold" href="/repository">Open the current Page 1 source in Repository</a>
                        <a className="underline font-bold" href="/style-guide">Open the current front-page reference in Style Guide</a>
                      </p>
                      <p className="text-xs">These links are for inspection only. The historical review and locked Page 1 remain unchanged.</p>
                    </div>
                  )}
                </> : <p className="text-xs italic mt-1">Sign in to read the protected source and evidence notes.</p>}
              </li>
            ))}</ol>
          )}
        </div>
      </section>
      <section className="card mb-6" data-testid="panel-locked-snapshots">
        <h2 className="text-2xl font-black">Locked page snapshots</h2>
        <p className="text-xs mb-2">Immutable. {isAuthenticated ? 'Signed in: exports are editorial and include puzzle answers.' : 'Public: exports are redacted and omit puzzle answers.'}</p>
        {snaps.length === 0 ? <p className="text-sm">No page has been locked yet.</p> : (
          <ul className="space-y-1">{snaps.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`row-global-snapshot-${s.id}`}>
              <span className="flex-1 min-w-0">Page {s.page.number}: {s.page.title} / issue r{s.issueRevision} / {s.actor} / {fmt(s.at)}</span>
              <button className="btn" onClick={() => { if (isAuthenticated && !window.confirm('Editorial export contains puzzle answers. Export?')) return; exportSnapshot(s, isAuthenticated); }} data-testid={`button-export-global-snapshot-${s.id}`}><Download size={13} />{isAuthenticated ? 'Editorial export' : 'Redacted export'}</button>
            </li>))}</ul>
        )}
      </section>
      {list.length === 0 ? <Empty title="No snapshots yet" body="A snapshot is recorded after each accepted change." /> : (
        <div className="grid lg:grid-cols-2 gap-5">
          <ol className="space-y-2" data-testid="list-versions">
            {list.map((v) => (
              <li key={v.id} className={`card-flat flex items-center gap-3 ${sel === v.id ? 'outline outline-4 outline-[#d6a021]' : ''}`}>
                <span className="display text-2xl font-black w-12">{v.revision}</span>
                <div className="flex-1 min-w-0"><div className="mono text-sm truncate">{v.action}</div><div className="text-xs">{v.actor} / {fmt(v.at)}</div></div>
                <button className="btn" onClick={() => setSel(v.id)} data-testid={`button-view-version-${v.id}`}><Eye size={14} />Inspect</button>
              </li>
            ))}
          </ol>
          <div>{sel === null ? <Empty title="Pick a snapshot" body="Inspect any entry to read it or download its JSON." /> : <Snapshot id={sel} />}</div>
        </div>
      )}
    </div>
  );
}
