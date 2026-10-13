import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ChecklistItem } from '@workspace/api-client-react';
import { usePress } from '@/lib/press';
import { Head, Loading, ErrorState, Empty, ApprovalDialog, WriteNote } from '@/components/bits';

export default function Continuity() {
  const { issue, isLoading, error, refetch, run, pending, canWrite, auth } = usePress();
  const [sel, setSel] = useState<ChecklistItem | null>(null);
  if (isLoading) return <Loading />;
  if (error || !issue) return <ErrorState error={error} retry={refetch} />;
  const done = issue.checklist.filter((c) => c.checked).length;
  return (
    <div>
      <Head kicker="Editorial checklist" title="Continuity">
        <span className="mono text-sm">{done} / {issue.checklist.length} checked</span>
      </Head>
      <WriteNote canWrite={canWrite} login={auth.login} />
      <p className="text-sm mb-4 max-w-2xl">Pagination, bleed, fonts and image resolution are checked by eye, by a person. The software cannot tick these for you.</p>
      {issue.checklist.length === 0 ? <Empty title="No checklist items" body="The server returned an empty checklist." /> : (
        <ul className="space-y-3">
          {issue.checklist.map((c) => (
            <li key={c.id} className="card flex gap-3 items-start rise" data-testid={`row-check-${c.id}`}>
              <button onClick={() => setSel(c)} disabled={!canWrite} aria-label={c.checked ? 'Uncheck item' : 'Check item'} data-testid={`button-check-${c.id}`}
                className={`h-8 w-8 shrink-0 border-2 border-[#1e1812] flex items-center justify-center transition-colors ${c.checked ? 'bg-[#34503f] text-white' : 'bg-[#fbf6e6]'} disabled:opacity-50`}>
                {c.checked && <Check size={18} />}
              </button>
              <div><div className={`font-bold ${c.checked ? 'line-through decoration-[#5c1a20]' : ''}`}>{c.label}</div>
                {(c.reviewer || c.notes) && <div className="text-xs italic mt-0.5">Self-attested by {c.reviewer}: {c.notes}</div>}</div>
            </li>
          ))}
        </ul>
      )}
      <ApprovalDialog open={!!sel} title={sel?.checked ? 'Uncheck item' : 'Check item'} pending={pending}
        description={sel?.label ?? ''} ack={sel?.checked ? 'This no longer holds and needs another look.' : 'I personally checked this on the working proof.'}
        onClose={() => setSel(null)}
        onSubmit={async (reviewer, notes) => { if (sel && (await run({ action: 'check_continuity', id: sel.id, checked: !sel.checked, reviewer, notes }, 'Checklist updated'))) setSel(null); }} />
    </div>
  );
}
