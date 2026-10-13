import '@/styles/press-direction.css';
import { StyleBadge } from '@/components/asset-style-review';
import { useState } from 'react';
import { Plus, Pencil, Trash2, CheckCheck, Download, Eye, EyeOff } from 'lucide-react';
import type { Puzzle } from '@workspace/api-client-react';
import { usePress, downloadJson, fmt } from '@/lib/press';
import { SourceIntake } from '@/components/source-intake';
import { parsePuzzles } from '@/lib/intake';
import { Head, Loading, ErrorState, Tag, statusKind, Modal, Empty, ApprovalDialog, Confirm, WriteNote } from '@/components/bits';

function PuzzlePreview({ list }: { list: Puzzle[] }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="card-flat text-sm">
      <button type="button" className="btn mb-2" onClick={() => setReveal(!reveal)} data-testid="button-reveal-import-solutions">{reveal ? 'Hide solutions' : 'Reveal solutions'}</button>
      <ol className="space-y-2 max-h-96 overflow-y-auto">{list.map((z, i) => (
        <li key={i}><b>{i + 1}. {z.title}</b> <span className="mono text-xs">{z.kind} / pages {z.pages.join(', ')} / art {z.artworkId || 'none'}</span>
          <p className="text-xs">Source identity: {z.sourceIdentity || 'not given'}</p>
          <p className="whitespace-pre-wrap break-words">{z.source || <i>Missing source text</i>}</p>
          <p className="whitespace-pre-wrap break-words text-xs">{z.solution ? (reveal ? z.solution : 'Solution present, hidden') : 'Missing solution'}</p></li>))}</ol>
    </div>
  );
}

const PAGES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const blank: Puzzle = { id: '', title: '', kind: 'crossword', source: '', solution: '', validation: 'unvalidated', validationNotes: '', reviewer: '', artworkId: '', pages: [8], provenance: 'original, submitted by a contributor', sourceIdentity: '' };

export default function Puzzles() {
  const { issue, readiness, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const [form, setForm] = useState<Puzzle | null>(null);
  const [val, setVal] = useState<Puzzle | null>(null);
  const [decision, setDecision] = useState<'passed' | 'failed'>('passed');
  const [del, setDel] = useState<Puzzle | null>(null);
  const [rev, setRev] = useState(0);
  const [showSol, setShowSol] = useState(false);
  const [evNotes, setEvNotes] = useState('');
  if (isLoading) return <Loading />;
  if (error || !issue || !readiness) return <ErrorState error={error} retry={refetch} />;
  const isNew = form && !form.id;
  const stale = rev > 0 && issue.revision !== rev && (!!form || !!val || !!del);
  const openForm = (z: Puzzle) => { setEvNotes(''); setRev(issue.revision); setShowSol(false); setForm({ ...z }); };
  const staleNote = stale ? <div role="alert" className="card-flat mb-3 text-sm bg-[#d6a02133]" data-testid="notice-puzzle-stale">The issue moved from revision {rev} to {issue.revision} after this dialog opened. Submitting is blocked; close and reopen it.</div> : null;
  const exportPublicManifest = () => downloadJson('underground-press-issue-manifest.json', {
    exportKind: 'reader-safe manifest, no solutions or validation notes',
    issueRevision: issue.revision,
    pages: issue.pages.map((p) => ({ number: p.number, title: p.title, status: p.locked || p.number === 1 ? 'locked' : p.status, locked: p.locked || p.number === 1, draftRevision: p.draftRevision ?? 1, sourceIdentity: p.sourceIdentity ?? '', artworkSlots: (p.artworkSlots ?? []).map((sl) => ({ label: sl.label, assetId: sl.assetId })) })),
    puzzles: issue.puzzles.map((z) => ({ id: z.id, title: z.title, kind: z.kind, pages: z.pages, artworkId: z.artworkId, provenance: z.provenance, sourceIdentity: z.sourceIdentity ?? '', validation: z.validation, validationAt: z.validationAt ?? null })),
    assets: issue.assets.map((a) => ({ id: a.id, name: a.name, contentType: a.contentType, size: a.size, caption: a.caption, credit: a.credit, source: a.source, provenance: a.provenance, pages: a.pages, review: a.review, dpi: a.dpi })),
    placement: readiness.manifest,
  });
  const save = async () => {
    if (!form || stale) return;
    const ok = await run(isNew ? { action: 'add_puzzle', puzzle: { ...form, validation: 'unvalidated', validationNotes: '' }, notes: evNotes.trim() || undefined } : { action: 'edit_puzzle', id: form.id, puzzle: form, notes: evNotes.trim() || undefined }, isNew ? 'Puzzle added' : 'Puzzle saved; validation reset', rev);
    if (ok) setForm(null);
  };
  const set = (k: keyof Puzzle, v: unknown) => setForm((f) => (f ? { ...f, [k]: v } : f));
  return (
    <div>
      <Head kicker="Puzzle Dojo" title="Puzzle inventory">
        <button className="btn btn-mustard" onClick={exportPublicManifest} data-testid="button-export-issue-manifest"><Download size={14} />Export issue manifest</button>
        <button className="btn btn-red" disabled={!canWrite} onClick={() => openForm({ ...blank })} data-testid="button-add-puzzle"><Plus size={14} />Add puzzle</button>
      </Head>
      <WriteNote canWrite={canWrite} login={auth.login} />
      <SourceIntake id="puzzles" title="Import real puzzle inventory" revision={issue.revision} run={run} pending={pending} canWrite={canWrite}
        help={<>JSON as {'{"puzzles":[...]}'} or a bare array (max 100). Records may omit source or solution; missing parts are labelled. Pages must be unlocked 2-10 and artwork IDs must exist. One atomic batch; the server assigns new IDs and never overwrites a row.</>}
        parse={(t) => parsePuzzles(t, issue)} identityLabel="Global imported-source identity (where this inventory came from)" okMsg="Puzzle inventory imported as unvalidated" confirmLabel="Import as unvalidated"
        warning="Every imported puzzle is unvalidated, has no reviewer or validation evidence, and carries provenance imported_unverified. Nothing is approved."
        build={(v, identity, n) => ({ action: 'import_puzzle_inventory', puzzleInventory: v, sourceIdentity: identity, notes: n, checked: true })}
        preview={(v) => <PuzzlePreview list={v} />} />
      <p className="text-xs mb-2">Imported puzzles are always stamped unvalidated. Validation evidence (time and account) is recorded by the server, never by this form.</p>
      <p className="text-sm mb-4 max-w-2xl">Pages 8 and 9 are the main dojo. Pages 2-7 and 10 carry integrated puzzles. Correctness is a human judgement: nothing here solves or verifies a puzzle for you.</p>
      {issue.puzzles.length === 0 ? (
        <Empty title="The dojo is empty" body="No puzzles have been entered, so none are validated. Add the first one with its source and the actual solution, then have a person solve it.">
          <button className="btn btn-red" disabled={!canWrite} onClick={() => openForm({ ...blank })} data-testid="button-add-puzzle-empty">Add the first puzzle</button>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {issue.puzzles.map((z) => (
            <article key={z.id} className="card rise" data-testid={`card-puzzle-${z.id}`}>
              <div className="flex justify-between gap-2"><h3 className="text-xl font-black">{z.title}</h3><Tag kind={statusKind(z.validation)}>{z.validation}</Tag></div>
              <div className="mono text-xs mt-1">{z.kind} / pages {z.pages.join(', ') || 'none'} / art {z.artworkId ? issue.assets.find((a) => a.id === z.artworkId)?.name ?? 'missing asset' : 'none'}</div>
              {z.artworkId && (() => { const aa = issue.assets.find((x) => x.id === z.artworkId); return aa ? <div className="mt-1"><StyleBadge asset={aa} issue={issue} /></div> : null; })()}
              <div className="press-preview pd-rule p-2 mt-2" data-testid={`preview-puzzle-${z.id}`}><p className="pd-puzzle-source text-sm line-clamp-3">{z.source || 'No source text.'}</p></div>
              {z.sourceIdentity && <p className="text-xs mt-1">Source identity: {z.sourceIdentity}</p>}
              {!z.source && <p className="text-xs mt-1 font-bold">Source text missing.</p>}
              {!z.solution && <p className="text-xs font-bold">Solution missing.</p>}
              {z.sourceEvidence && <p className="text-xs mt-1" data-testid={`text-source-receipt-${z.id}`}>Source receipt: {z.sourceEvidence.actor}, {fmt(z.sourceEvidence.at)}{canWrite && z.sourceEvidence.notes ? `, ${z.sourceEvidence.notes}` : ''}. Not verified.</p>}
              {z.validation !== 'unvalidated' && <p className="text-xs mt-2 italic" data-testid={`text-validation-evidence-${z.id}`}>Verdict {z.validation} by {z.reviewer || 'unnamed reviewer'} (self-reported){z.validationAt ? `, recorded ${fmt(z.validationAt)}` : ', no server timestamp'}{z.validationAccountId ? `, account ${z.validationAccountId}` : ''}.{canWrite && z.validationNotes ? ` Notes: ${z.validationNotes}` : ''}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <button className="btn" disabled={!canWrite} onClick={() => openForm(z)} data-testid={`button-edit-puzzle-${z.id}`}><Pencil size={13} />Edit</button>
                <button className="btn btn-green" disabled={!canWrite} onClick={() => { setDecision('passed'); setRev(issue.revision); setVal(z); }} data-testid={`button-validate-puzzle-${z.id}`}><CheckCheck size={13} />Validate</button>
                <button className="btn btn-ghost" disabled={!canWrite} onClick={() => { setRev(issue.revision); setDel(z); }} data-testid={`button-delete-puzzle-${z.id}`}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <section className="mt-8">
        <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
          <h2 className="text-3xl font-black">Integrated manifest</h2>
          <button className="btn" onClick={() => downloadJson('underground-press-puzzle-manifest.json', readiness.manifest)} data-testid="button-export-manifest"><Download size={14} />Export manifest</button>
        </div>
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-sm" data-testid="table-manifest">
            <thead className="bg-[#1e1812] text-[#f2ead3] mono text-xs uppercase"><tr><th className="p-2 text-left">Page</th><th className="p-2 text-left">Role</th><th className="p-2 text-left">Puzzles</th><th className="p-2 text-left">Validated</th></tr></thead>
            <tbody>
              {readiness.manifest.map((m) => (
                <tr key={m.page} className="border-t border-[#1e181255]">
                  <td className="p-2 mono">{m.page}</td><td className="p-2">{m.role}</td>
                  <td className="p-2">{m.puzzleIds.length ? m.puzzleIds.map((id) => issue.puzzles.find((z) => z.id === id)?.title ?? id).join(', ') : 'none'}</td>
                  <td className="p-2"><Tag kind={m.validated ? 'ok' : 'warn'}>{m.validated ? 'yes' : 'no'}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!form} title={isNew ? 'Add puzzle' : 'Edit puzzle'} onClose={() => setForm(null)}>
        {form && (
          <div className="space-y-3">
            {staleNote}
            <div><label className="lbl" htmlFor="z1">Title</label><input id="z1" className="field" value={form.title} onChange={(e) => set('title', e.target.value)} data-testid="input-puzzle-title" /></div>
            <div><label className="lbl" htmlFor="z2">Kind</label><input id="z2" className="field" value={form.kind} onChange={(e) => set('kind', e.target.value)} data-testid="input-puzzle-kind" /></div>
            <div><label className="lbl" htmlFor="z3">Source (clues, grid, prompt)</label><textarea id="z3" className="field" rows={4} value={form.source} onChange={(e) => set('source', e.target.value)} data-testid="input-puzzle-source" /></div>
            <div><label className="lbl" htmlFor="zs">Source identity (where this puzzle came from; not the clues)</label><input id="zs" className="field" value={form.sourceIdentity ?? ''} onChange={(e) => set('sourceIdentity', e.target.value)} data-testid="input-puzzle-source-identity" /></div>
            <div><div className="flex justify-between items-center"><label className="lbl" htmlFor="z4">Actual solution (signed-in working copy only)</label>
              <button type="button" className="btn" onClick={() => setShowSol(!showSol)} data-testid="button-toggle-solution">{showSol ? <EyeOff size={13} /> : <Eye size={13} />}{showSol ? 'Hide solution' : 'Reveal / edit solution'}</button></div>
              {showSol ? <textarea id="z4" className="field" rows={3} value={form.solution} onChange={(e) => set('solution', e.target.value)} data-testid="input-puzzle-solution" /> : <p className="text-xs card-flat">Solution hidden. {form.solution ? 'A solution is stored and will be kept unless you edit it.' : 'None stored yet.'}</p>}</div>
            <div><label className="lbl" htmlFor="z5">Artwork</label>
              <select id="z5" className="field" value={form.artworkId} onChange={(e) => set('artworkId', e.target.value)} data-testid="select-puzzle-art">
                <option value="">No artwork</option>{issue.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div><span className="lbl">Pages</span><div className="flex flex-wrap gap-2">
              {PAGES.map((n) => (
                <label key={n} className={`tag cursor-pointer ${form.pages.includes(n) ? 'tag-ok' : ''}`}>
                  <input type="checkbox" className="sr-only" checked={form.pages.includes(n)} data-testid={`checkbox-puzzle-page-${n}`}
                    onChange={() => set('pages', form.pages.includes(n) ? form.pages.filter((x) => x !== n) : [...form.pages, n].sort((a, b) => a - b))} />{n}
                </label>
              ))}</div></div>
            <div><label className="lbl" htmlFor="z6">Provenance</label><input id="z6" className="field" value={form.provenance} onChange={(e) => set('provenance', e.target.value)} /></div>
            <div><label className="lbl" htmlFor="zn">Evidence notes (who supplied this, how)</label><input id="zn" className="field" value={evNotes} onChange={(e) => setEvNotes(e.target.value)} data-testid="input-puzzle-evidence-notes" /></div>
            <p className="text-xs">Saving resets validation. A person must re-solve it.</p>
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-green" disabled={pending || stale || !form.title.trim()} onClick={save} data-testid="button-save-puzzle">Save puzzle</button></div>
          </div>
        )}
      </Modal>

      <ApprovalDialog open={!!val} title={`Validate: ${val?.title ?? ''}`} pending={pending} needReviewer
        description="Record a human verdict. Pick passed only if a person solved it from the printed clues and matched the stored solution."
        ack="A person solved or checked this puzzle by hand. I am not relying on automation." confirmLabel={`Record ${decision}`}
        onClose={() => setVal(null)}
        onSubmit={async (reviewer, notes) => { if (val && !stale && (await run({ action: 'validate_puzzle', id: val.id, decision, reviewer, notes }, `Puzzle marked ${decision}`, rev))) setVal(null); }}>
        {staleNote}
        <div className="card-flat mb-4 flex gap-2 items-center">
          <span className="lbl !mb-0">Verdict</span>
          <button className={`btn ${decision === 'passed' ? 'btn-green' : ''}`} onClick={() => setDecision('passed')} data-testid="button-verdict-passed">Passed</button>
          <button className={`btn ${decision === 'failed' ? 'btn-red' : ''}`} onClick={() => setDecision('failed')} data-testid="button-verdict-failed">Failed</button>
        </div>
      </ApprovalDialog>
      <Confirm open={!!del} title="Delete this puzzle?" body={`"${del?.title}" will be removed from the working copy. This changes the manifest and resets proofs.`} label="Delete puzzle" pending={pending}
        onClose={() => setDel(null)} onConfirm={async () => { if (del && !stale && (await run({ action: 'delete_puzzle', id: del.id }, 'Puzzle deleted', rev))) setDel(null); }} />
    </div>
  );
}
