import { useState, useEffect, useRef, type ReactNode } from 'react';
import { X, AlertTriangle, Lock } from 'lucide-react';
import type { Approval, AuthUser } from '@workspace/api-client-react';

export function Tag({ kind, children }: { kind?: 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  return <span className={`tag ${kind ? 'tag-' + kind : ''}`}>{children}</span>;
}

export function statusKind(s: string): 'ok' | 'warn' | 'bad' | undefined {
  if (['approved', 'passed', 'repository_reference'].includes(s)) return 'ok';
  if (['rejected', 'failed', 'blocked'].includes(s)) return 'bad';
  if (['in_review', 'awaiting_review', 'pending', 'uploaded_unverified'].includes(s)) return 'warn';
  return undefined;
}

export function Head({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-double border-[#1e1812] pb-3 rise">
      <div>
        <div className="kicker">{kicker}</div>
        <h1 className="text-3xl md:text-5xl font-black leading-none mt-1">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2 no-print">{children}</div>
    </header>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const nodes = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []);
    nodes()[0]?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const elements = nodes();
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1e1812]/60 p-0 sm:p-4 no-print" onMouseDown={onClose} data-testid="dialog-backdrop">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={title} className="card w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rise" onMouseDown={(e) => e.stopPropagation()} data-testid="dialog">
        <div className="flex items-start justify-between gap-3 mb-3 border-b-2 border-[#1e1812] pb-2">
          <h2 className="text-2xl font-black">{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ApprovalDialog(p: {
  open: boolean; title: string; description: string; ack: string; verifiedMyrtle?: boolean;
  isMyrtleEditor?: boolean; accountName?: string;
  pending?: boolean; confirmLabel?: string; danger?: boolean; needReviewer?: boolean;
  onClose: () => void; onSubmit: (reviewer: string, notes: string) => void;
  children?: ReactNode;
}) {
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [ack, setAck] = useState(false);
  useEffect(() => { if (p.open) { setNotes(''); setAck(false); } }, [p.open]);
  const ok = ack && notes.trim().length > 0 && (p.verifiedMyrtle ? p.isMyrtleEditor : reviewer.trim().length > 0);
  return (
    <Modal open={p.open} title={p.title} onClose={p.onClose}>
      <p className="mb-3 text-sm">{p.description}</p>
      {p.verifiedMyrtle ? (
        <p className={`card-flat mb-3 text-xs ${p.isMyrtleEditor ? '' : 'bg-[#d6a02133]'}`} data-testid="notice-verified-role">
          {p.isMyrtleEditor
            ? <>Verified Myrtle editor role. The server will record this sign-off under {p.accountName ?? 'your authenticated account'}.</>
            : 'This signed-in account is not assigned the Myrtle editor role and cannot record this sign-off.'}
        </p>
      ) : (
        <p className="card-flat mb-3 text-xs" data-testid="notice-self-attested-reviewer">
          Reviewer names are self-reported and are not checked against the signed-in account.
        </p>
      )}
      {p.children}
      {!p.verifiedMyrtle && <>
        <label className="lbl" htmlFor="rv">Self-reported reviewer name</label>
        <input id="rv" className="field mb-1" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name (self-attested)" data-testid="input-reviewer" />
      </>}
      <label className="lbl mt-2" htmlFor="nt">Notes (required)</label>
      <textarea id="nt" className="field mb-3" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-notes" />
      <label className="flex gap-2 items-start text-sm mb-4 cursor-pointer">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[#34503f]" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="checkbox-ack" />
        <span>{p.ack}</span>
      </label>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={p.onClose}>Cancel</button>
        <button className={`btn ${p.danger ? 'btn-red' : 'btn-green'}`} disabled={!ok || p.pending} onClick={() => p.onSubmit(p.verifiedMyrtle ? '' : reviewer.trim(), notes.trim())} data-testid="button-confirm">
          {p.pending ? 'Sending...' : p.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}

export function ApprovalIdentity({ approval }: { approval: Approval }) {
  const verified = approval.reviewerRole === 'myrtle_editor' && !!approval.reviewerAccountId;
  return verified ? (
    <span data-testid="approval-verified-identity">
      Verified Myrtle editor: {approval.reviewer} (account {approval.reviewerAccountId})
    </span>
  ) : (
    <span data-testid="approval-self-attestation">Self-attested by {approval.reviewer}</span>
  );
}

export function MyrtleRoleNote({ user, hasRole }: { user: AuthUser | null; hasRole: boolean }) {
  if (!user) return null;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.id;
  return (
    <div className="card-flat mb-4 text-xs" data-testid="notice-myrtle-role">
      {hasRole
        ? <>Verified Myrtle editor role for {displayName}. Editorial and final proof sign-offs are recorded under your authenticated account.</>
        : <>
            {displayName} does not have a verified Myrtle editor role. This account ID can be explicitly assigned by setting <code>MYRTLE_EDITOR_USER_IDS</code> on the API server: <code>{user.id}</code>.
          </>}
    </div>
  );
}

export function Confirm(p: { open: boolean; title: string; body: string; label: string; pending?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={p.open} title={p.title} onClose={p.onClose}>
      <p className="mb-4 text-sm">{p.body}</p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={p.onClose}>Keep it</button>
        <button className="btn btn-red" disabled={p.pending} onClick={p.onConfirm} data-testid="button-confirm-delete">{p.label}</button>
      </div>
    </Modal>
  );
}

export function Loading() {
  return (
    <div className="space-y-3" data-testid="state-loading" aria-busy="true">
      <div className="skeleton h-12 w-2/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-64" />
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const e = error as { message?: string; data?: { error?: string } };
  return (
    <div className="card border-[#5c1a20]" role="alert" data-testid="state-error">
      <div className="flex gap-2 items-center"><AlertTriangle className="text-[#5c1a20]" /><h2 className="text-2xl font-black">The press room is not answering</h2></div>
      <p className="mt-2 text-sm">{e?.data?.error || e?.message || 'The API could not be reached.'} Nothing here is shown as saved until the server confirms it.</p>
      <button className="btn btn-red mt-3" onClick={retry} data-testid="button-retry">Retry</button>
    </div>
  );
}

export function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="card-flat border-dashed text-center py-10 px-4" data-testid="state-empty">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="text-sm max-w-md mx-auto mt-1 mb-3">{body}</p>
      {children}
    </div>
  );
}

export function WriteNote({ canWrite, login }: { canWrite: boolean; login: () => void }) {
  if (canWrite) return null;
  return (
    <div className="card-flat bg-[#d6a02133] flex flex-wrap items-center gap-3 mb-4 no-print" data-testid="note-readonly">
      <Lock size={16} /> <span className="text-sm">Read-only visitor. Edits, uploads and approvals need a login.</span>
      <button className="btn btn-mustard" onClick={login} data-testid="button-login-inline">Log in</button>
    </div>
  );
}

export function Thumb({ n, title, className = '' }: { n: number; title: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 160" className={className} role="img" aria-label={`Sample layout thumbnail for page ${n}`}>
      <rect width="120" height="160" fill="#f2ead3" stroke="#1e1812" strokeWidth="2" />
      <rect x="8" y="8" width="104" height="22" fill={n === 1 ? '#5c1a20' : '#34503f'} />
      <text x="12" y="23" fontSize="9" fontFamily="serif" fontWeight="900" fill="#f2ead3">{title.slice(0, 18)}</text>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <rect key={i} x={i % 2 ? 62 : 8} y={38 + Math.floor(i / 2) * 18} width={i % 3 === 0 ? 50 : 44} height="3" fill="#1e1812" opacity=".55" />
      ))}
      <rect x="8" y="128" width="40" height="22" fill="#d6a021" />
      <text x="64" y="146" fontSize="9" fontFamily="monospace" fontWeight="700" fill="#5c1a20">SAMPLE</text>
      <text x="108" y="156" fontSize="8" textAnchor="end" fontFamily="monospace" fill="#1e1812">{n}</text>
    </svg>
  );
}
