import { useState } from 'react';
import { Download, Eye, Plus, Trash2, Lock, GitBranch, Copy, ShieldCheck } from 'lucide-react';
import {
  useListVersions, useGetVersion, getListVersionsQueryKey, getGetVersionQueryKey,
  type Issue, type Page, type PageSnapshot, type Readiness, type ArtworkSlot, type PressCommand, type Puzzle,
} from '@workspace/api-client-react';
import { downloadJson, fmt } from '@/lib/press';
import { useToast } from '@/hooks/use-toast';
import { Tag, Modal, ApprovalDialog, ApprovalIdentity } from '@/components/bits';

type Run = (cmd: Omit<PressCommand, 'revision'>, okMsg?: string, expectedRevision?: number) => Promise<boolean>;
type Dlg = null | { kind: 'print' | 'lock' | 'branch' | 'slots' | 'snap'; rev: number; snap?: PageSnapshot };

export function redactPuzzle(z: Puzzle): Puzzle {
  return { ...z, solution: '', validationNotes: '' };
}
export function exportSnapshot(s: PageSnapshot, editor: boolean) {
  const out = editor ? s : { ...s, puzzles: s.puzzles.map(redactPuzzle) };
  downloadJson(`underground-press-page-${s.page.number}-snapshot-${s.id}${editor ? '-editorial' : '-redacted'}.json`, editor ? { exportKind: 'editorial, includes puzzle answers', ...out } : { exportKind: 'public, answers redacted', ...out });
}

function DraftVersion({ id, n, editor }: { id: number; n: number; editor: boolean }) {
  const q = useGetVersion(id, { query: { queryKey: getGetVersionQueryKey(id), retry: 1 } });
  if (q.isLoading) return <div className="skeleton h-16 mt-2" />;
  if (q.error || !q.data) return <p className="text-xs mt-2">Could not load this revision. <button className="btn" onClick={() => q.refetch()}>Retry</button></p>;
  const pg = q.data.pages.find((p) => p.number === n);
  return (
    <div className="card-flat mt-2 text-sm" data-testid={`panel-draft-version-${id}`}>
      <div className="flex justify-between gap-2 flex-wrap">
        <b>Read-only: revision {q.data.revision}</b>
        <button className="btn" onClick={() => downloadJson(`underground-press-revision-${q.data!.revision}${editor ? '-editorial' : '-redacted'}.json`, q.data)} data-testid={`button-download-draft-${id}`}><Download size={13} />Download revision</button>
      </div>
      {pg ? <><div className="mt-1 font-bold">{pg.title}</div><pre className="mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto mt-1">{pg.copy || '(no copy)'}</pre></> : <p>Page not present in this revision.</p>}
      <p className="text-xs mt-1">Inspecting never restores or overwrites the working draft. Copy text out by hand if you need it.</p>
    </div>
  );
}

export function PageProduction(p: {
  issue: Issue; readiness?: Readiness; page: Page; locked: boolean; p1: boolean; run: Run; pending: boolean;
  canWrite: boolean; canMyrtle: boolean; accountName?: string; dirty: boolean;
}) {
  const { issue, readiness, page, p1, locked, run, pending, canWrite, canMyrtle, dirty } = p;
  const { toast } = useToast();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [slots, setSlots] = useState<ArtworkSlot[]>([]);
  const [reveal, setReveal] = useState(false);
  const [showVers, setShowVers] = useState(false);
  const [inspectVer, setInspectVer] = useState<number | null>(null);
  const vers = useListVersions({ query: { queryKey: getListVersionsQueryKey(), enabled: showVers, retry: 1 } });
  const check = readiness?.pageChecks?.find((c) => c.page === page.number);
  const snaps = (issue.pageSnapshots ?? []).filter((s) => s.page.number === page.number).sort((a, b) => b.issueRevision - a.issueRevision);
  const stale = !!dlg && issue.revision !== dlg.rev;
  const open = (kind: NonNullable<Dlg>['kind'], snap?: PageSnapshot) => {
    if (kind === 'slots') setSlots((page.artworkSlots ?? []).map((s) => ({ ...s })));
    setReveal(false);
    setDlg({ kind, rev: issue.revision, snap });
  };
  const close = () => setDlg(null);
  const go = async (cmd: Omit<PressCommand, 'revision'>, msg: string) => {
    if (!dlg) return;
    if (issue.revision !== dlg.rev) {
      toast({ title: 'Issue changed since this dialog opened', description: 'Close and reopen to review the latest state.', variant: 'destructive' });
      return;
    }
    if (await run(cmd, msg, dlg.rev)) close();
  };
  const staleBanner = stale ? <div role="alert" className="card-flat mb-3 text-sm bg-[#d6a02133]" data-testid="notice-dialog-stale">The issue moved from revision {dlg!.rev} to {issue.revision} after this dialog opened. Submitting is blocked. Close and reopen it.</div> : null;
  const needsSave = dirty ? <p className="text-xs mb-2">Save or discard your unsaved page edits first.</p> : null;
  const printed = page.printApproval;

  return (
    <div className="space-y-4 mt-4" data-testid="panel-page-production">
      <div className="card-flat" data-testid="panel-page-readiness">
        <div className="kicker">Page readiness</div>
        {!check ? <p className="text-sm">Per-page readiness is not reported by the server yet.</p> : (
          <>
            <div className="flex flex-wrap gap-1 my-1">
              <Tag kind={check.editorial ? 'ok' : 'warn'}>editorial {check.editorial ? 'yes' : 'no'}</Tag>
              <Tag kind={check.art ? 'ok' : 'warn'}>art {check.art ? 'yes' : 'no'}</Tag>
              <Tag kind={check.puzzle ? 'ok' : 'warn'}>puzzle {check.puzzle ? 'yes' : 'no'}</Tag>
              <Tag kind={check.print ? 'ok' : 'warn'}>print layout {check.print ? 'yes' : 'no'}</Tag>
              <Tag kind={check.canLock ? 'ok' : 'bad'}>{check.canLock ? 'can lock' : 'cannot lock'}</Tag>
            </div>
            {check.blockers.length > 0 && <ul className="text-sm list-disc pl-5">{check.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
            <p className="text-sm mt-1" data-testid="text-page-next-move"><b>Next move:</b> {check.nextMove}</p>
          </>
        )}
      </div>

      <div className="card-flat" data-testid="panel-artwork-slots">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="kicker">Named artwork slots</div>
          {!locked && <button className="btn" disabled={!canWrite || pending || dirty} onClick={() => open('slots')} data-testid="button-edit-slots">Edit slots</button>}
        </div>
        {(page.artworkSlots ?? []).length === 0 ? <p className="text-sm">No named slots. Assign existing assets to labelled slots to make placement explicit.</p> : (
          <ul className="text-sm mt-1 space-y-0.5">
            {(page.artworkSlots ?? []).map((s) => <li key={s.id}><b>{s.label}</b>: {issue.assets.find((a) => a.id === s.assetId)?.name ?? <i>missing asset ({s.assetId})</i>}</li>)}
          </ul>
        )}
      </div>

      <div className="card-flat" data-testid="panel-print-lock">
        <div className="kicker">Print layout and lock</div>
        <p className="text-sm">Print layout: {printed ? <>attested by {printed.reviewer} on {fmt(printed.at)}<br /><i>{printed.notes}</i></> : 'no human attestation yet.'}</p>
        {printed?.reviewerAccountId && <p className="text-xs"><ApprovalIdentity approval={printed} /></p>}
        {page.branchedFrom && <p className="text-xs mt-1">Branched from snapshot {page.branchedFrom}. This draft is not approved until reviewed again.</p>}
        {p1 ? <p className="text-sm mt-2">Page 1 cannot be edited, locked, branched, or approved here.</p> : (
          <div className="flex flex-wrap gap-2 mt-2">
            {!locked && <button className="btn" disabled={!canWrite || pending || dirty} onClick={() => open('print')} data-testid="button-check-print">Attest print layout</button>}
            {!locked && <button className="btn btn-red" disabled={!canWrite || !canMyrtle || pending || dirty || check?.canLock === false} onClick={() => open('lock')} data-testid="button-lock-page"><Lock size={13} />Lock page</button>}
            {locked && <button className="btn" disabled={!canWrite || pending} onClick={() => open('branch')} data-testid="button-branch-page"><GitBranch size={13} />Branch from locked page</button>}
          </div>
        )}
        {!p1 && !locked && !canMyrtle && <p className="text-xs mt-1">Locking requires the verified Myrtle editor role.</p>}
        {!p1 && !locked && dirty && <p className="text-xs mt-1">Save or discard unsaved edits to enable these actions.</p>}
      </div>

      <div className="card-flat" data-testid="panel-page-snapshots">
        <div className="kicker">Locked snapshots (immutable)</div>
        {snaps.length === 0 ? <p className="text-sm">No locked snapshot for this page.</p> : (
          <ul className="space-y-2 mt-1">
            {snaps.map((s) => (
              <li key={s.id} className="text-sm flex flex-wrap gap-2 items-center justify-between" data-testid={`row-snapshot-${s.id}`}>
                <span>Issue rev {s.issueRevision} / {s.actor} / {fmt(s.at)}<br /><i className="text-xs">{s.notes}</i></span>
                <span className="flex gap-2">
                  <button className="btn" onClick={() => open('snap', s)} data-testid={`button-inspect-snapshot-${s.id}`}><Eye size={13} />Inspect</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-flat" data-testid="panel-draft-history">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="kicker">Draft revision history</div>
          <button className="btn" onClick={() => setShowVers((v) => !v)} data-testid="button-toggle-versions">{showVers ? 'Hide' : 'Show'} revisions</button>
        </div>
        <p className="text-xs">Prior drafts can be inspected or downloaded. There is no silent restore.</p>
        {showVers && (vers.isLoading ? <div className="skeleton h-20 mt-2" /> : vers.error || !vers.data ? <p className="text-sm mt-2">Could not load revisions. <button className="btn" onClick={() => vers.refetch()}>Retry</button></p> : (
          <ol className="mt-2 space-y-1 max-h-72 overflow-y-auto">
            {[...vers.data].sort((a, b) => b.id - a.id).slice(0, 30).map((v) => (
              <li key={v.id}>
                <div className="flex gap-2 items-center text-xs"><span className="mono w-10">r{v.revision}</span><span className="flex-1 truncate">{v.action} / {v.actor} / {fmt(v.at)}</span>
                  <button className="btn" onClick={() => setInspectVer(inspectVer === v.id ? null : v.id)} data-testid={`button-inspect-draft-${v.id}`}><Eye size={12} /></button></div>
                {inspectVer === v.id && <DraftVersion id={v.id} n={page.number} editor={canWrite} />}
              </li>
            ))}
          </ol>
        ))}
      </div>

      <ApprovalDialog open={dlg?.kind === 'print'} title={`Print layout attestation, page ${page.number}`} needReviewer pending={pending}
        description="Records that a human reviewed the actual print layout of this page: margins, bleed, crops, legibility, and placement of every named slot. Self-attested."
        ack="A person looked at this page's print layout and it is correct." onClose={close}
        onSubmit={(reviewer, notes) => go({ action: 'check_page_print', page: page.number, reviewer, notes, checked: true }, 'Print layout attested')}>
        {staleBanner}{needsSave}
      </ApprovalDialog>
      <ApprovalDialog open={dlg?.kind === 'lock'} title={`Lock page ${page.number}`} verifiedMyrtle isMyrtleEditor={canMyrtle} accountName={p.accountName} pending={pending} danger confirmLabel="Lock page"
        description="Locking freezes this page and records an immutable snapshot of its copy, puzzles, and assets. Notes must cite the evidence you checked (approvals, puzzle solves, layout)."
        ack="I verified the evidence listed in my notes and this page is final." onClose={close}
        onSubmit={(_r, notes) => go({ action: 'lock_page', page: page.number, notes }, 'Page locked; snapshot recorded')}>
        {staleBanner}
        <div className="card-flat mb-3 text-xs"><ShieldCheck size={12} className="inline" /> Editorial: {page.editorialApproval ? 'approved' : 'missing'} / Art: {page.artApproval ? 'approved' : 'missing'} / Print: {printed ? 'attested' : 'missing'}</div>
      </ApprovalDialog>
      <ApprovalDialog open={dlg?.kind === 'branch'} title={`Branch locked page ${page.number}`} pending={pending} needReviewer
        description="Creates a new unapproved draft from the current locked page. The locked snapshot stays immutable. Approvals do not carry over."
        ack="I understand the new draft starts unapproved and must be reviewed again." onClose={close}
        onSubmit={(_r, notes) => go({ action: 'branch_page', page: page.number, notes }, 'Draft branched from locked page')}>
        {staleBanner}
      </ApprovalDialog>

      <Modal open={dlg?.kind === 'slots'} title={`Artwork slots, page ${page.number}`} onClose={close}>
        {staleBanner}
        <div className="space-y-2">
          {slots.map((s, i) => (
            <div key={s.id} className="flex gap-2 items-center">
              <input className="field" aria-label="Slot label" placeholder="Label, e.g. Header spot" value={s.label} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} data-testid={`input-slot-label-${i}`} />
              <select className="field" aria-label="Asset" value={s.assetId} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, assetId: e.target.value } : x)))} data-testid={`select-slot-asset-${i}`}>
                <option value="">Choose asset</option>{issue.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button className="btn btn-ghost" aria-label="Remove slot" onClick={() => setSlots(slots.filter((_, j) => j !== i))} data-testid={`button-remove-slot-${i}`}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn" onClick={() => setSlots([...slots, { id: crypto.randomUUID(), label: '', assetId: '' }])} data-testid="button-add-slot"><Plus size={13} />Add slot</button>
          <p className="text-xs">Changing slots resets this page's art approval. The server stores the result.</p>
          <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Cancel</button>
            <button className="btn btn-green" disabled={pending || stale || slots.some((s) => !s.label.trim() || !s.assetId)} data-testid="button-save-slots"
              onClick={() => go({ action: 'set_artwork_slots', page: page.number, artworkSlots: slots.map((s) => ({ ...s, label: s.label.trim() })) }, 'Artwork slots saved')}>Save slots</button></div>
        </div>
      </Modal>

      <Modal open={dlg?.kind === 'snap'} title={dlg?.snap ? `Snapshot of page ${dlg.snap.page.number}, rev ${dlg.snap.issueRevision}` : 'Snapshot'} onClose={close}>
        {dlg?.snap && (() => {
          const s = dlg.snap;
          return (
            <div className="space-y-3 text-sm" data-testid="panel-snapshot-inspect">
              <p className="mono text-xs">Read-only. Locked by {s.actor} on {fmt(s.at)}. {s.notes}</p>
              <div className="font-bold">{s.page.title}</div>
              <textarea readOnly className="field mono !text-xs" rows={8} value={s.page.copy} aria-label="Snapshot copy (read-only)" />
              <button className="btn" onClick={async () => {
                try {
                  if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.');
                  await navigator.clipboard.writeText(s.page.copy);
                  toast({ title: 'Copy placed on clipboard', description: 'Paste it into a new draft by hand. Nothing was restored.' });
                } catch {
                  toast({ title: 'Clipboard unavailable', description: 'Select and copy the read-only text manually.', variant: 'destructive' });
                }
              }} data-testid="button-copy-snapshot"><Copy size={13} />Copy text (read-only copy)</button>
              <div><div className="kicker">Assets at lock</div>
                {s.assets.length ? <ul className="text-xs">{s.assets.map((a) => <li key={a.id}>{a.name} / {a.provenance} / review {a.review} / {a.dpi} dpi / {a.credit || 'no credit'}</li>)}</ul> : <p className="text-xs">None.</p>}</div>
              <div><div className="kicker">Puzzles at lock</div>
                {s.puzzles.length ? <ul className="text-xs space-y-1">{s.puzzles.map((z) => (
                  <li key={z.id}><b>{z.title}</b> ({z.kind}) / {z.validation}{z.validationAt ? ` at ${fmt(z.validationAt)}` : ''}{z.validationAccountId ? ` by account ${z.validationAccountId}` : ''}
                    {canWrite && reveal && <div className="mono">Solution: {z.solution || '(none)'}</div>}</li>))}</ul> : <p className="text-xs">None.</p>}
                {canWrite && s.puzzles.length > 0 && <button className="btn mt-1" onClick={() => setReveal(!reveal)} data-testid="button-reveal-snapshot-solutions">{reveal ? 'Hide' : 'Reveal'} solutions</button>}
                {!canWrite && <p className="text-xs">Solutions are hidden. Sign in to the working production desk to reveal them.</p>}
              </div>
              <div className="flex justify-end">
                <button className="btn btn-mustard" data-testid="button-export-snapshot" onClick={() => {
                  if (canWrite && !window.confirm('This export is editorial and contains puzzle answers. Only editors should hold it. Export?')) return;
                  exportSnapshot(s, canWrite);
                }}><Download size={13} />Export snapshot ({canWrite ? 'editorial, answers' : 'redacted'})</button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
