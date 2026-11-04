import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { usePress, fmt } from '@/lib/press';
import { ProductionQueue, BlockerDetails, ReportedPreflight } from '@/components/front-desk';
import { Head, Loading, ErrorState, Tag, WriteNote } from '@/components/bits';

function Stat({ label, a, b, id }: { label: string; a: number; b: number; id: string }) {
  const pct = b ? Math.round((a / b) * 100) : 0;
  return (
    <div className="card rise" data-testid={`stat-${id}`}>
      <div className="kicker">{label}</div>
      <div className="display text-4xl font-black mt-1">{a}<span className="text-xl opacity-60"> / {b}</span></div>
      <div className="h-2 mt-2 bg-[#d9ccaa] border border-[#1e1812]"><div className="h-full bg-[#34503f] transition-all duration-700" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Dashboard() {
  const { issue, readiness: r, isLoading, error, refetch, canWrite, auth, run, pending } = usePress();
  if (isLoading) return <Loading />;
  if (error || !issue || !r) return <ErrorState error={error} retry={refetch} />;
  const nextAction = [...(r.blockerDetails || [])].sort((a, b) => a.priority - b.priority || a.ordinal - b.ordinal)[0];
  return (
    <div>
      <Head kicker={`Issue ${issue.number} / ${issue.name}`} title="Is this paper ready?">
        {r.readyToPrint ? <Tag kind="ok">Gates clear</Tag> : <Tag kind="bad">Not ready to print</Tag>}
      </Head>
      <WriteNote canWrite={canWrite} login={auth.login} />
      <section className="card bg-[#d6a021] mb-5" data-testid="card-next-move">
        <div className="kicker !text-[#1e1812]">Next move</div>
        <p className="display text-2xl md:text-3xl font-black mt-1">{r.nextMove}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={nextAction?.href || (r.readyToPrint ? '/repository' : '/proof')} className="btn btn-mustard" data-testid="link-next-action">Take this next step <ArrowRight size={14} /></Link>
          <Link href="/pages" className="btn btn-red" data-testid="link-go-pages">Open the page board <ArrowRight size={14} /></Link>
          <Link href="/proof" className="btn" data-testid="link-go-proof">Proof desk</Link>
        </div>
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat id="pages" label="Pages approved" a={r.approvedPages} b={r.totalPages} />
        <Stat id="puzzles" label="Puzzles validated" a={r.validatedPuzzles} b={r.totalPuzzles} />
        <Stat id="assets" label="Assets reviewed" a={r.reviewedAssets} b={r.totalAssets} />
        <Stat id="continuity" label="Continuity checks" a={r.continuityComplete} b={r.continuityTotal} />
      </div>
      <ProductionQueue r={r} />
      <BlockerDetails r={r} />
      <ReportedPreflight issue={issue} r={r} run={run} pending={pending} canWrite={canWrite} />
      <div className="grid md:grid-cols-5 gap-5">
        <section className="md:col-span-3 card">
          <h2 className="text-2xl font-black mb-2">Blockers ({r.blockers.length})</h2>
          {r.blockers.length === 0 ? <p className="text-sm">The server reports no blockers. A human still has to approve the proof.</p> : (
            <ul className="space-y-1.5 max-h-80 overflow-y-auto" data-testid="list-blockers" aria-label="Raw server blocker strings">
              {r.blockers.map((b, i) => <li key={i} className="flex gap-2 text-sm"><span className="mono text-[#5c1a20] font-bold">{String(i + 1).padStart(2, '0')}</span>{b}</li>)}
            </ul>
          )}
        </section>
        <section className="md:col-span-2 card bg-[#34503f] text-[#f2ead3]">
          <div className="kicker !text-[#d6a021]">Masthead</div>
          <p className="display text-2xl font-black mt-1">"{issue.motto}"</p>
          <p className="mono text-xs mt-3"><span className="opacity-80">Canonical masthead credit, not a verified account approval:</span><br />{issue.attribution}</p>
          <p className="mono text-xs mt-3 opacity-80">Advertisers: {issue.advertisers.join(' / ')}</p>
          <p className="mono text-xs mt-3 opacity-80">Revision {issue.revision}. Updated {fmt(issue.updatedAt)}. Stored in the working database; GitHub sync is {issue.githubSync}.</p>
        </section>
      </div>
    </div>
  );
}
