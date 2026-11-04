import { useState } from 'react';
import { Printer, ScanSearch } from 'lucide-react';
import { usePress, fmt } from '@/lib/press';
import '@/styles/press-direction.css';
import { ensureCondensedFont } from '@/components/asset-style-review';
ensureCondensedFont();
import { Head, Loading, ErrorState, Tag, statusKind, Empty, ApprovalDialog, ApprovalIdentity, MyrtleRoleNote, WriteNote } from '@/components/bits';

export default function Proof() {
  const { issue, readiness, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const [appr, setAppr] = useState<string | null>(null);
  const canApproveAsMyrtle = auth.roles.includes('myrtle_editor');
  const accountName = [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ').trim() || auth.user?.email || auth.user?.id;
  if (isLoading) return <Loading />;
  if (error || !issue || !readiness) return <ErrorState error={error} retry={refetch} />;
  const proofs = [...issue.proofs].reverse();
  return (
    <div>
      <div className="no-print"><Head kicker="Print preflight" title="Proof desk">
        <button className="btn btn-green" disabled={!canWrite || pending} onClick={() => run({ action: 'run_preflight' }, 'Preflight recorded')} data-testid="button-run-preflight"><ScanSearch size={14} />Run preflight</button>
        <button className="btn btn-mustard" disabled={!canWrite} title={!canWrite ? "Sign in to include protected working artwork in the proof" : "Draft proof only; inspect pagination manually"} onClick={() => window.print()} data-testid="button-print-proof"><Printer size={14} />Print working proof</button>
      </Head></div>
      <WriteNote canWrite={canWrite} login={auth.login} />
      <MyrtleRoleNote user={auth.user} hasRole={canApproveAsMyrtle} />
      <div className="card-flat mb-4 text-sm no-print" data-testid="notice-benchmark">{issue.artDirection?.references.some((r) => r.kind === "front_page" && r.approval) ? "Front-page benchmark confirmed by Myrtle." : "Front-page benchmark: reference artwork not yet imported. Page 1 proof is unchanged."}</div>
      <div className="card-flat bg-[#5c1a2018] mb-4 text-sm no-print">
        Preflight lists content blockers. It does not certify PDF structure, fonts, color or printer properties. The browser print is a DRAFT working proof, not press-ready. Long copy or artwork may overflow the ten logical pages; inspect pagination and fit before signing the human print checklist.
      </div>
      <section className="card mb-6 no-print">
        <h2 className="text-2xl font-black mb-2">Current blockers ({readiness.blockers.length})</h2>
        {readiness.blockers.length ? <ul className="list-disc pl-5 text-sm space-y-1">{readiness.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul> : <p className="text-sm">None reported.</p>}
      </section>
      <section className="mb-8 no-print">
        <h2 className="text-2xl font-black mb-2">Proof records</h2>
        {proofs.length === 0 ? <Empty title="No proofs yet" body="Run preflight to record the first one. It will list what still blocks printing." /> : (
          <div className="space-y-3">
            {proofs.map((p) => (
              <article key={p.id} className="card" data-testid={`card-proof-${p.id}`}>
                <div className="flex flex-wrap gap-2 items-center"><Tag kind={statusKind(p.status)}>{p.status.replace('_', ' ')}</Tag><span className="mono text-xs">rev {p.revision} / {fmt(p.createdAt)} {p.revision !== issue.revision ? '/ HISTORICAL — not current sign-off' : '/ current revision'}</span></div>
                {p.blockers.length > 0 && <ul className="list-disc pl-5 text-sm mt-2">{p.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
                {p.approval && <p className="text-sm mt-2 italic stamp inline-block border-2 border-[#34503f] text-[#34503f] px-2"><ApprovalIdentity approval={p.approval} />: {p.approval.notes}</p>}
                {p.status === 'awaiting_review' && p.revision === issue.revision && <div className="mt-3"><button className="btn btn-red" disabled={!canWrite || !canApproveAsMyrtle || pending} onClick={() => setAppr(p.id)} data-testid={`button-approve-proof-${p.id}`}>Approve proof</button></div>}
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-label="Working proof">
        <div className="kicker mb-2 no-print">Working proof preview, ten pages (DRAFT)</div>
        <div className="space-y-6">
          {issue.pages.map((p) => (
            <div key={p.number} className={`proof-sheet ${p.number > 1 ? "press-preview" : ""}`} data-testid={`sheet-page-${p.number}`}>
              
              {p.number === 1 && <div className="wm">DRAFT</div>}
              <div className="flex justify-between mono text-xs border-b-2 border-[#1e1812] pb-1"><span>{issue.name} / Portland, Maine / 1991</span><span>DRAFT, NOT PRESS-READY / page {p.number} of 10</span></div>
              <h2 className={`display text-5xl font-black mt-6 leading-none ${p.number > 1 ? 'pd-head' : ''}`}>{p.title}</h2>
              <div className="kicker mt-1">{p.section}</div>
              <div className={`mt-5 columns-2 gap-6 text-[13px] leading-snug whitespace-pre-wrap ${p.number > 1 ? 'pd-columns pd-rule' : ''}`}>{p.number === 1 ? p.copy || 'Page 1 source is missing and not approved. Placeholder only.' : p.copy || 'No copy entered.'}</div>
              {issue.puzzles.filter(z => z.pages.includes(p.number)).map(z => (
                <section key={z.id} className="pd-rule mt-4">
                  <h3 className="text-xl font-bold">{z.title} <small className="mono text-xs">/ {z.validation}</small></h3>
                  <p className="pd-puzzle-source whitespace-pre-wrap text-sm">{z.source}</p>
                  <p className="mono text-[10px]">Solution withheld from reader proof; inspect in Puzzle Dojo.</p>
                </section>
              ))}
               {issue.assets.filter(a => a.pages.includes(p.number) || (p.artworkSlots || []).some(s => s.assetId === a.id) || issue.puzzles.some(z => z.pages.includes(p.number) && z.artworkId === a.id)).map(a => (
                <figure key={a.id} className={`mt-3 inline-block mr-3 align-top max-w-[44%] ${p.number > 1 ? 'pd-frame' : ''}`}>
                  {!canWrite ? <p className="mono text-xs">Sign in to inspect private working files.</p> : a.contentType.startsWith('image/') ? <img className="max-h-32 object-contain" src={`${import.meta.env.BASE_URL}api/storage${a.objectPath}`} alt={a.caption || a.name} /> : <p className="mono text-xs">Non-image asset: {a.name}. Inspect original separately.</p>}
                  <figcaption className="text-xs">{(p.artworkSlots || []).filter(s => s.assetId === a.id).map(s => s.label).join(", ")} {a.caption} / {a.credit} / {a.review}</figcaption>
                </figure>
              ))}
              <div className="absolute bottom-6 left-[.75in] right-[.75in] mono text-[10px] flex justify-between border-t border-[#1e1812] pt-1">
                <span>Masthead credit (not a verified account approval): {issue.attribution}</span><span>{issue.advertisers.join(' / ')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <ApprovalDialog open={!!appr} title="Approve proof" verifiedMyrtle isMyrtleEditor={canApproveAsMyrtle} accountName={accountName} pending={pending}
        description="Only an account assigned the Myrtle editor role can approve the proof. This records approval of the content state, not any PDF or printer setting."
        ack="I reviewed all ten pages of the working proof and the human checklist is truly done."
        onClose={() => setAppr(null)}
        onSubmit={async (_reviewer, notes) => { if (appr && (await run({ action: 'approve_proof', id: appr, notes }, 'Verified proof approval recorded'))) setAppr(null); }} />
    </div>
  );
}
