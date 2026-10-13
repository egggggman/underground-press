import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Download } from 'lucide-react';
import type { Issue, Readiness } from '@workspace/api-client-react';
import { downloadJson, fmt } from '@/lib/press';
import { parseReported } from '@/lib/intake';
import { SourceIntake } from '@/components/source-intake';
import { Tag } from '@/components/bits';

type Run = Parameters<typeof SourceIntake>[0]['run'];
const PHASES = ['Recovery: Page 1 and Golden', 'Source copy, pages 2-7 and 10', 'Puzzles, pages 2-10 (8-9 dedicated)', 'Myrtle editorial and art', 'Continuity and print'];
const stKind = (s: string) => (s === 'clear' ? 'ok' : s === 'actionable' ? 'warn' : 'bad');

export function ProductionQueue({ r }: { r: Readiness }) {
  const q = [...(r.productionQueue ?? [])].sort((a, b) => a.priority - b.priority);
  if (!q.length) return null;
  return (
    <section className="card mb-5" data-testid="panel-queue">
      <h2 className="text-2xl font-black mb-2">Production queue</h2>
      <p className="text-xs mb-2">Clear means the matching current granular blockers are absent. It does not mean the stage is approved.</p>
      <ol className="space-y-2">
        {q.map((s, i) => (
          <li key={i} className="card-flat" data-testid={`queue-${s.priority}-${i}`}>
            <div className="flex flex-wrap gap-2 items-center"><span className="mono font-bold">P{s.priority}</span><b>{s.title}</b><Tag kind={stKind(s.state)}>{s.state.replace(/_/g, ' ')}</Tag><span className="mono text-xs">{PHASES[s.priority - 1] ?? ''}</span></div>
            <p className="text-sm mt-1">Owner: {s.owner}. Pages: {s.pages.join(', ') || 'none'}. Blockers: {s.blockerIds.length}.</p>
            {s.prerequisite && <p className="text-sm">Waiting on: {s.prerequisite}</p>}
            <p className="text-sm">Next: {s.nextMove} {s.href && <Link href={s.href} className="underline font-bold">Go</Link>}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BlockerDetails({ r }: { r: Readiness }) {
  const all = r.blockerDetails ?? [];
  const [qs, setQs] = useState(''); const [owner, setOwner] = useState(''); const [pg, setPg] = useState(''); const [root, setRoot] = useState('');
  const owners = useMemo(() => [...new Set(all.map((b) => b.owner))], [all]);
  const roots = useMemo(() => [...new Set(all.map((b) => b.rootCause))], [all]);
  const list = all.filter((b) => (!owner || b.owner === owner) && (!pg || b.pages.includes(Number(pg))) && (!root || b.rootCause === root) && (!qs || `${b.description} ${b.nextMove}`.toLowerCase().includes(qs.toLowerCase())));
  if (!all.length) return null;
  return (
    <section className="card mb-5" data-testid="panel-blocker-details">
      <h2 className="text-2xl font-black mb-1">Blocker detail ({list.length} shown of {all.length} reported by server)</h2>
      <p className="text-xs mb-2">Filtering only hides rows. It does not clear anything. Each description is the exact server text.</p>
      <div className="grid sm:grid-cols-4 gap-2 mb-3">
        <input className="field" placeholder="Search text" value={qs} onChange={(e) => setQs(e.target.value)} aria-label="Search blockers" data-testid="input-blocker-search" />
        <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner"><option value="">All owners</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
        <select className="field" value={pg} onChange={(e) => setPg(e.target.value)} aria-label="Page"><option value="">All pages</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>Page {n}</option>)}</select>
        <select className="field" value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Root cause"><option value="">All root causes</option>{roots.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      {list.length === 0 && <p className="text-sm">No blocker matches these filters. That is not clearance; {all.length} remain.</p>}
      <ul className="space-y-2 max-h-[34rem] overflow-y-auto">
        {list.map((b) => (
          <li key={b.id} className="card-flat text-sm" data-testid={`blocker-${b.ordinal}`}>
            <div className="flex flex-wrap gap-2 items-center"><span className="mono font-bold text-[#5c1a20]">{String(b.ordinal).padStart(2, '0')}</span><Tag kind="bad">{b.state.replace(/_/g, ' ')}</Tag><Tag>P{b.priority}</Tag><Tag>{b.owner}</Tag><span className="mono text-xs">pages {b.pages.join(', ') || '-'}</span></div>
            <p className="mt-1 whitespace-pre-wrap break-words">{b.description}</p>
            <p className="text-xs mt-1">Root cause: {b.rootCause}.{b.prerequisite ? ` Prerequisite: ${b.prerequisite}.` : ''} Next: {b.nextMove} {b.href && <Link href={b.href} className="underline font-bold">Open</Link>}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReportedPreflight({ issue, r, run, pending, canWrite }: { issue: Issue; r: Readiness; run: Run; pending: boolean; canWrite: boolean }) {
  const rp = issue.reportedPreflight;
  const live = r.blockers;
  const saved = issue.proofs;
  const [shown, setShown] = useState<number | null>(null);
  const exportAll = () => downloadJson('underground-press-reported-vs-live.json', { issueRevision: issue.revision, reportedPreflight: rp ?? null, liveBlockers: live, savedProofs: saved });
  return (
    <section className="mb-5" data-testid="panel-reported">
      <div className="card mb-3">
        <div className="flex flex-wrap justify-between gap-2 items-center"><h2 className="text-2xl font-black">Reported 48 versus live {live.length}</h2><button className="btn" disabled={!canWrite} title={!canWrite ? 'Sign in to export protected source records.' : ''} onClick={exportAll} data-testid="button-export-reported"><Download size={14} />Export JSON</button></div>
        <p className="text-sm mt-1">The user reported 48 blockers. The live server list has {live.length}. These are three separate records and none implies clearance: the reported snapshot, the live list, and saved proofs.</p>
        <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm">
          <div className="card-flat" data-testid="box-reported"><div className="kicker">Reported snapshot</div>{rp ? <><p>{rp.entries.length} entries from {rp.sourceIdentity}</p><p className="text-xs">Recorded by {rp.evidence.actor} at {fmt(rp.evidence.at)}{canWrite ? `: ${rp.evidence.notes}` : '. Sign in to read the notes.'}</p><p className="text-xs italic">Source receipt only. NOT an approval, NOT validation, and the account is not automatically a Myrtle editor.</p></> : (issue as { reportedPreflightPresent?: boolean }).reportedPreflightPresent ? <p>A reported-list receipt exists. Sign in to inspect it.</p> : <p>Reported #48 is unavailable: no list has been supplied. It is not equivalent to live #48.</p>}</div>
          <div className="card-flat" data-testid="box-live"><div className="kicker">Live blockers</div><p>{live.length} now. Live #48: {live[47] !== undefined ? <span className="whitespace-pre-wrap break-words">{live[47]}</span> : 'no such live entry'}</p></div>
          <div className="card-flat" data-testid="box-proofs"><div className="kicker">Saved proofs</div>{saved.length ? <ul>{saved.map((p) => <li key={p.id} className="text-xs"><details><summary className="cursor-pointer underline">{p.id}: r{p.revision}, {p.status}, {p.blockers.length} blockers, {fmt(p.createdAt)} — inspect original checks</summary><ol className="max-h-64 overflow-y-auto mt-2">{p.blockers.map((b, i) => <li key={i} className="mb-2"><b>Saved #{i + 1}</b><pre className="whitespace-pre-wrap break-words">{b.trim() ? b : '(blank description as stored; meaning not inferred)'}</pre><code className="whitespace-pre-wrap break-words">Raw: {JSON.stringify(b)}</code></li>)}</ol></details></li>)}</ul> : <p>No historical proof is saved in this working copy. The externally reported list is not inferred from this absence.</p>}</div>
        </div>
      </div>
      {rp && (
        <div className="card mb-3" data-testid="list-reported">
          <h3 className="text-xl font-black mb-1">Reported entries (read-only, blanks preserved)</h3>
          <ol className="max-h-72 overflow-y-auto text-sm space-y-1">
            {rp.entries.map((e, i) => <li key={i} className="flex gap-2"><span className="mono font-bold w-8 shrink-0">{i + 1}</span><div className="min-w-0"><span className="whitespace-pre-wrap break-words">{e.replace(/[\s\u200B-\u200D\uFEFF]/g, '') ? e : '(blank description as supplied; meaning not inferred)'}</span><button className="underline text-xs ml-2" onClick={() => setShown(shown === i ? null : i)}>Inspect raw #{i + 1}</button>{shown === i && <div className="card-flat mono text-xs mt-1 max-h-56 overflow-auto"><pre className="whitespace-pre-wrap break-words">{JSON.stringify(e)}</pre>{(i === 47 || !e.trim()) && <p className="break-words">Characters: {Array.from(e).map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ') || '(none)'}</p>}</div>}</div></li>)}
          </ol>
        </div>
      )}
      {saved.length > 0 && <div className="card mb-3"><h3 className="text-xl font-black mb-1">Saved proof blocker lists (read-only)</h3>{saved.map((p) => <details key={p.id} className="text-sm mb-1"><summary>{p.id}: {p.blockers.length} blockers, {p.status}</summary><ol className="list-decimal ml-6">{p.blockers.map((b, i) => <li key={i} className="whitespace-pre-wrap break-words">{b === '' ? '(blank entry)' : b}</li>)}</ol></details>)}</div>}
      <SourceIntake id="reported" title="Record reported 48 list" revision={issue.revision} run={run} pending={pending} canWrite={canWrite}
        help={<>Paste or upload exactly a JSON array of 48 strings. Blank entries must stay as empty strings. Nothing is padded, forced, or invented.</>}
        parse={parseReported} identityLabel="Source identity (where the 48 came from)"
        okMsg="Reported list recorded"
        confirmLabel="Record reported list"
        warning="This stores a snapshot with your evidence notes. It does not approve, clear, or verify anything."
        build={(v, identity, notes) => ({ action: 'record_reported_preflight', reportedEntries: v, sourceIdentity: identity, notes, checked: true })}
        preview={(v) => <ol className="max-h-60 overflow-y-auto text-sm card-flat">{v.map((e, i) => <li key={i} className="flex gap-2"><span className="mono font-bold w-8">{i + 1}</span><span className="whitespace-pre-wrap break-words">{e === '' ? '(blank)' : e}</span></li>)}</ol>} />
    </section>
  );
}
