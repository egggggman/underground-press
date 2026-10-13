import { useEffect, useRef, useState } from 'react';
import { Lock, Send, Save } from 'lucide-react';
import type { Page } from '@workspace/api-client-react';
import { useSearch } from 'wouter';
import { usePress, fmt } from '@/lib/press';
import { SourceIntake } from '@/components/source-intake';
import { parsePageSources } from '@/lib/intake';
import { PageProduction } from '@/components/page-production';
import { Head, Loading, ErrorState, Tag, statusKind, Thumb, ApprovalDialog, ApprovalIdentity, MyrtleRoleNote, WriteNote } from '@/components/bits';

export default function PagesBoard() {
  const { issue, readiness, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const search = useSearch();
  const qp = Number(new URLSearchParams(search).get('page'));
  const [sel, setSel] = useState(qp >= 1 && qp <= 10 ? qp : 2);
  useEffect(() => { if (qp >= 1 && qp <= 10) setSel(qp); }, [qp]);
  const [title, setTitle] = useState('');
  const [copy, setCopy] = useState('');
  const [srcId, setSrcId] = useState('');
  const [notes, setNotes] = useState('');
  const [dlgState, setDlgState] = useState<null | { k: 'ed' | 'art'; rev: number }>(null);
  const dlg = dlgState?.k ?? null;
  const setDlg = (k: 'ed' | 'art' | null) => setDlgState(k ? { k, rev: issue?.revision ?? 0 } : null);
  const stale = !!dlgState && !!issue && issue.revision !== dlgState.rev;
  const dirtyRef = useRef(false);
  const editGeneration = useRef(0);
  const previousPage = useRef(sel);
  const formRevision = useRef(0);
  const page: Page | undefined = issue?.pages.find((p) => p.number === sel);
  const rev = issue?.revision;
  const canApproveAsMyrtle = auth.roles.includes('myrtle_editor');
  const accountName = [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ').trim() || auth.user?.email || auth.user?.id;
  useEffect(() => {
    if (previousPage.current !== sel) { dirtyRef.current = false; previousPage.current = sel; }
    if (dirtyRef.current) return;
    if (page) { setTitle(page.title); setCopy(page.copy); setSrcId(page.sourceIdentity ?? ''); formRevision.current = rev || 0; }
    // reset form when selected page or server revision changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, rev]);
  const dirtyNow = !!page && (title !== page.title || copy !== page.copy || srcId !== (page.sourceIdentity ?? ''));
  useEffect(() => {
    if (!dirtyNow) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const nav = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm('Discard unsaved draft changes before leaving the page editor?')) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', h);
    document.addEventListener('click', nav, true);
    return () => { window.removeEventListener('beforeunload', h); document.removeEventListener('click', nav, true); };
  }, [dirtyNow]);
  if (isLoading) return <Loading />;
  if (error || !issue || !page) return <ErrorState error={error} retry={refetch} />;
  const p1 = page.number === 1;
  const locked = page.locked || p1;
  const dirty = dirtyNow;
  const art = issue.assets.filter((a) => a.pages.includes(page.number));
  const pz = issue.puzzles.filter((z) => z.pages.includes(page.number));
  return (
    <div>
      <Head kicker="The ten-page issue" title="Page board" />
      <WriteNote canWrite={canWrite} login={auth.login} />
      <MyrtleRoleNote user={auth.user} hasRole={canApproveAsMyrtle} />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {issue.pages.map((p) => (
          <button key={p.number} onClick={() => { if (p.number !== sel && dirty && !window.confirm('Discard unsaved draft changes before changing pages?')) return; setSel(p.number); }} data-testid={`card-page-${p.number}`}
            className={`text-left card !p-2 transition-transform hover:-translate-y-0.5 ${sel === p.number ? 'outline outline-4 outline-[#d6a021]' : ''}`}>
            <Thumb n={p.number} title={p.title} className="w-full" />
            <div className="mt-1 text-xs font-bold leading-tight line-clamp-2 min-h-[2rem]">{p.number}. {p.title}</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {p.locked || p.number === 1 ? <Tag kind="bad">Locked</Tag> : <Tag kind={statusKind(p.status)}>{p.status.replace('_', ' ')}</Tag>}
            </div>
          </button>
        ))}
      </div>
      <section className="card" key={page.number} data-testid="panel-page-detail">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="display text-4xl font-black">{page.number}</span>
          <Tag>{page.section || 'no section'}</Tag>
          <Tag>{page.provenance}</Tag>
          <Tag><span data-testid="text-revision-indicator">{locked ? 'Locked version' : 'Draft'} r{page.draftRevision ?? 1} / issue r{issue.revision}</span></Tag>
          {locked && <Tag kind="bad"><Lock size={10} className="inline" /> Locked</Tag>}
        </div>
        {p1 && (
          <div className="card-flat bg-[#5c1a2018] mb-4" data-testid="notice-page1">
            <b>Page 1 is permanently locked.</b> {page.copy.trim() ? 'Provided copy is on file' : 'No copy is on file'}; {page.editorialApproval ? 'an editorial approval is recorded' : 'no editorial approval is recorded'}. It cannot be edited, unlocked, branched, or approved here, and import does not change that.
          </div>
        )}
        <label className="lbl" htmlFor="pt">Title</label>
        <input id="pt" className="field mb-3" value={title} disabled={locked || !canWrite} onChange={(e) => { dirtyRef.current = true; editGeneration.current++; setTitle(e.target.value); }} data-testid="input-page-title" />
        <label className="lbl" htmlFor="ps">Source identity</label>
        <input id="ps" className="field mb-3" value={srcId} disabled={locked || !canWrite} placeholder="Where this page's text came from (file, person, scan)" onChange={(e) => { dirtyRef.current = true; editGeneration.current++; setSrcId(e.target.value); }} data-testid="input-page-source-identity" />
        <label className="lbl" htmlFor="pc">Copy</label>
        <textarea id="pc" className="field mb-2 mono !text-sm" rows={9} value={copy} disabled={locked || !canWrite} onChange={(e) => { dirtyRef.current = true; editGeneration.current++; setCopy(e.target.value); }} placeholder={locked ? '' : 'No copy yet. Paste or type it here.'} data-testid="input-page-copy" />
        {dirty && issue.revision !== formRevision.current && <div role="alert" className="card-flat mb-3">
          The saved issue changed while you were editing. Your unsaved copy has been kept; saving will not overwrite the newer revision.
          <button className="btn mt-2" onClick={() => { if (!window.confirm('Discard unsaved text and load the latest saved page?')) return; dirtyRef.current = false; formRevision.current = issue.revision; setTitle(page.title); setCopy(page.copy); setSrcId(page.sourceIdentity ?? ''); }}>Load latest saved copy</button>
        </div>}
        <div className="card-flat mb-3 text-sm" data-testid="text-source-receipt">
          <div className="kicker">Source receipt</div>
          {page.sourceEvidence ? <p>Recorded by {page.sourceEvidence.actor} on {fmt(page.sourceEvidence.at)} for source "{page.sourceIdentity || 'unnamed'}"{canWrite ? <>: <i>{page.sourceEvidence.notes}</i></> : '. Sign in to read the notes.'}<br />A receipt only. NOT an approval, NOT validation, and the account is not automatically a Myrtle editor.</p> : <p>No source evidence recorded for this page.</p>}
        </div>
        {!locked && <div className="mb-3"><label className="lbl" htmlFor="pn">Evidence notes for this save (who supplied the text, how)</label><input id="pn" className="field" value={notes} disabled={!canWrite} onChange={(e) => { editGeneration.current++; setNotes(e.target.value); }} data-testid="input-page-evidence-notes" /></div>}
        {!locked && !(page.sourceIdentity ?? '').trim() && <p className="text-xs mb-2" data-testid="text-source-required">Submit needs a saved source identity.</p>}
        <p className="text-xs mb-3">Editing resets this page's editorial and art approvals.</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
          <div className="card-flat"><div className="kicker">Editorial approval</div>{page.editorialApproval ? <p><ApprovalIdentity approval={page.editorialApproval} /> on {new Date(page.editorialApproval.at).toLocaleString()}<br /><i>{page.editorialApproval.notes}</i></p> : <p>None yet.</p>}</div>
          <div className="card-flat"><div className="kicker">Art approval</div>{page.artApproval ? <p>Self-attested by {page.artApproval.reviewer} on {new Date(page.artApproval.at).toLocaleString()}<br /><i>{page.artApproval.notes}</i></p> : <p>None yet.</p>}</div>
        </div>
        <p className="text-sm mb-3">Assigned artwork: {art.length ? art.map((a) => a.name).join(', ') : 'none'}. Puzzles: {pz.length ? pz.map((z) => z.title).join(', ') : 'none'}.</p>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-green" disabled={!canWrite || !dirty || pending || !title.trim()} data-testid="button-save-page"
              onClick={async () => {
                const generation = editGeneration.current;
                const savedPage = page.number;
                const savedRevision = formRevision.current;
                if (await run({ action: 'edit_page', page: savedPage, title, copy, sourceIdentity: srcId, notes: notes.trim() || undefined }, 'Page saved', savedRevision)) {
                  if (previousPage.current !== savedPage) return;
                  formRevision.current = savedRevision + 1;
                  // A successful request saved only its submitted values.
                  // Later typing stays dirty through background revision updates.
                  dirtyRef.current = editGeneration.current !== generation;
                  if (!dirtyRef.current) setNotes('');
                }
              }}><Save size={14} />Save page</button>
            <button className="btn btn-mustard" disabled={!canWrite || dirty || pending || page.status !== 'draft' || !(page.sourceIdentity ?? '').trim()} data-testid="button-submit-page"
              onClick={() => run({ action: 'submit_page', page: page.number }, 'Submitted for review')}><Send size={14} />Submit for review</button>
            <button className="btn" disabled={!canWrite || !canApproveAsMyrtle || dirty || page.status === 'draft'} onClick={() => setDlg('ed')} data-testid="button-approve-editorial">Editorial approval</button>
            <button className="btn" disabled={!canWrite || dirty || page.status === 'draft'} onClick={() => setDlg('art')} data-testid="button-approve-art">Art approval</button>
          </div>
        )}
      </section>
      <div className="mt-5">
        <SourceIntake id="page-sources" title="Import source copy for pages 2-10" revision={issue.revision} run={run} pending={pending} canWrite={canWrite}
          help={<>JSON as {'{"pages":[{"page":2,"title":"optional","copy":"...","sourceIdentity":"..."}]}'} or a bare array. Only unlocked pages 2-10; Page 1 and locked pages are rejected; duplicates fail. All pages import in one atomic step.</>}
          parse={(t) => parsePageSources(t, issue)} identityLabel="" needIdentity={false} okMsg="Page sources imported as unapproved drafts" confirmLabel="Import as unapproved drafts"
          warning="Importing adds unapproved drafts and resets approvals on those pages. It approves nothing. Each page keeps the source identity from its own entry."
          build={(v, _i, n) => ({ action: 'import_page_sources', pageSources: v, notes: n, checked: true })}
          preview={(v) => <div className="space-y-2 max-h-96 overflow-y-auto">{v.map((s) => { const old = issue.pages.find((p) => p.number === s.page)!; return (
            <div key={s.page} className="card-flat text-sm"><b>Page {s.page}</b>
              <div className="grid md:grid-cols-2 gap-2 mt-1">
                <div><div className="kicker">Old</div><p>Title: {old.title}</p><p className="text-xs">Source: {old.sourceIdentity || 'none'}</p><pre className="mono text-xs whitespace-pre-wrap break-words">{old.copy || '(no copy)'}</pre></div>
                <div><div className="kicker">New</div><p>Title: {s.title ?? `${old.title} (unchanged)`}</p><p className="text-xs">Source: {s.sourceIdentity}</p><pre className="mono text-xs whitespace-pre-wrap break-words">{s.copy}</pre></div>
              </div></div>); })}</div>} />
      </div>
      <PageProduction issue={issue} readiness={readiness} page={page} locked={locked} p1={p1} run={run} pending={pending} canWrite={canWrite} canMyrtle={canApproveAsMyrtle} accountName={accountName} dirty={dirty} />
      <ApprovalDialog open={dlg === 'ed'} title={`Editorial approval, page ${page.number}`} verifiedMyrtle isMyrtleEditor={canApproveAsMyrtle} accountName={accountName} pending={pending}
        description="This sign-off is limited to accounts assigned the Myrtle editor role. The server records the signed-in account, not a typed name."
        ack="I have read this page's copy start to finish." onClose={() => setDlg(null)}
        onSubmit={async (_reviewer, notes) => { if (stale) return; if (await run({ action: 'approve_editorial', page: page.number, notes }, 'Verified editorial approval recorded', dlgState!.rev)) setDlg(null); }}>{stale && <div role="alert" className="card-flat mb-3 text-sm bg-[#d6a02133]">The issue moved to revision {issue.revision} after this dialog opened. Submitting is blocked; close and reopen it.</div>}</ApprovalDialog>
      <ApprovalDialog open={dlg === 'art'} title={`Art approval, page ${page.number}`} pending={pending}
        description="Records a reviewer's self-attestation that the assigned artwork was checked. The signed-in account is not independently verified."
        ack="A human has looked at the artwork on this page and it is correct and cleared for use." onClose={() => setDlg(null)}
        onSubmit={async (reviewer, notes) => { if (stale) return; if (await run({ action: 'approve_art', page: page.number, reviewer, notes }, 'Art approval recorded', dlgState!.rev)) setDlg(null); }}>{stale && <div role="alert" className="card-flat mb-3 text-sm bg-[#d6a02133]">The issue moved to revision {issue.revision} after this dialog opened. Submitting is blocked; close and reopen it.</div>}</ApprovalDialog>
    </div>
  );
}
