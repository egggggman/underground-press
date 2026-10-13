import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import type { PressCommand } from '@workspace/api-client-react';
import { MAX_INTAKE_BYTES, type Parsed } from '@/lib/intake';
import { Tag } from '@/components/bits';

type Run = (cmd: Omit<PressCommand, 'revision'>, okMsg?: string, expectedRevision?: number) => Promise<boolean>;

export function SourceIntake<T>({ id, title, help, accept, parse, preview, build, okMsg, confirmLabel, identityLabel, revision, run, pending, canWrite, needIdentity = true, warning }: {
  id: string; title: string; help: ReactNode; accept?: string;
  parse: (text: string) => Parsed<T>;
  preview: (v: T) => ReactNode;
  build: (v: T, identity: string, notes: string) => Omit<PressCommand, 'revision'>;
  okMsg: string; confirmLabel: string; identityLabel: string;
  revision: number; run: Run; pending: boolean; canWrite: boolean; needIdentity?: boolean; warning: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [parsed, setParsed] = useState<{ v: T; rev: number } | null>(null);
  const [identity, setIdentity] = useState('');
  const [notes, setNotes] = useState('');
  const [ack, setAck] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stale = !!parsed && parsed.rev !== revision;
  const reset = () => { setParsed(null); setAck(false); setErr(''); };
  const doParse = (t: string) => {
    setAck(false);
    const r = parse(t);
    if (r.ok) { setErr(''); setParsed({ v: r.value, rev: revision }); } else { setParsed(null); setErr(r.error); }
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > MAX_INTAKE_BYTES) { setParsed(null); setErr('File is over the 1 MiB limit.'); return; }
    const t = await f.text(); setText(t); doParse(t);
    if (fileRef.current) fileRef.current.value = '';
  };
  const ready = !!parsed && !stale && ack && notes.trim() && (!needIdentity || identity.trim()) && canWrite && !pending;
  return (
    <section className="card mb-5" data-testid={`intake-${id}`}>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-black">{title}</h2>
        <button className="btn" onClick={() => setOpen(!open)} data-testid={`button-open-${id}`}><Upload size={14} />{open ? 'Close intake' : 'Open intake'}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-sm">{help}</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={!canWrite} onClick={() => fileRef.current?.click()}>Choose JSON file (max 1 MiB)</button>
            <input ref={fileRef} type="file" accept={accept ?? 'application/json,.json'} className="sr-only" aria-label={`${title} JSON file`} onChange={(e) => onFile(e.target.files?.[0])} data-testid={`input-file-${id}`} />
          </div>
          <label className="lbl" htmlFor={`${id}-t`}>Or paste JSON</label>
          <textarea id={`${id}-t`} className="field mono !text-xs" rows={5} value={text} onChange={(e) => { setText(e.target.value); reset(); }} data-testid={`input-json-${id}`} />
          <button className="btn btn-mustard" disabled={!text.trim() || !canWrite} onClick={() => doParse(text)} data-testid={`button-preview-${id}`}>Preview (no changes made)</button>
          {err && <div role="alert" className="card-flat text-sm" data-testid={`error-${id}`}>Rejected: {err}</div>}
          {parsed && (
            <div className="space-y-3" data-testid={`preview-${id}`}>
              <div className="flex gap-2 items-center"><Tag>Preview bound to issue r{parsed.rev}</Tag><span className="text-xs">Nothing is saved until you confirm.</span></div>
              {stale && <div role="alert" className="card-flat text-sm bg-[#d6a02133]" data-testid={`notice-stale-${id}`}>The issue moved to r{revision} after this preview was made. Confirmation is blocked. <button className="btn ml-2" onClick={() => doParse(text)}>Review a fresh preview</button></div>}
              {preview(parsed.v)}
              <div className="card-flat text-sm">{warning}</div>
              {needIdentity && <div><label className="lbl" htmlFor={`${id}-i`}>{identityLabel}</label><input id={`${id}-i`} className="field" value={identity} onChange={(e) => setIdentity(e.target.value)} data-testid={`input-identity-${id}`} /></div>}
              <div><label className="lbl" htmlFor={`${id}-n`}>Human evidence notes (who supplied this, how it was checked)</label><textarea id={`${id}-n`} className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid={`input-notes-${id}`} /></div>
              <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid={`checkbox-ack-${id}`} />I have read the preview above. I understand this adds unapproved, unverified material and approves nothing.</label>
              <button className="btn btn-red" disabled={!ready} data-testid={`button-confirm-${id}`}
                onClick={async () => { if (await run(build(parsed.v, identity.trim(), notes.trim()), okMsg, parsed.rev)) { setText(''); setNotes(''); setIdentity(''); reset(); setOpen(false); } }}>{confirmLabel}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
