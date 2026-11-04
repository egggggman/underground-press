import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@workspace/replit-auth-web';
import { useGetIssue, getGetIssueQueryKey } from '@workspace/api-client-react';

const NAV = [
  ['/', 'Front Desk'], ['/pages', 'Ten Pages'], ['/puzzles', 'Puzzle Dojo'], ['/assets', 'Assets'],
  ['/artwork', 'Artwork'], ['/continuity', 'Continuity'], ['/proof', 'Proof'], ['/history', 'History'], ['/repository', 'Repository'], ['/style-guide', 'Style Guide'],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { user, roles, isAuthenticated, login, logout, isLoading } = useAuth();
  const isNewsroomAdmin = roles.includes('newsroom_admin');
  const navItems = isNewsroomAdmin ? [...NAV, ['/access', 'Editor access'] as const] : NAV;
  useEffect(() => {
    document.title = `${navItems.find(([path]) => path === loc)?.[1] || 'Production Desk'} · The Underground Press`;
  }, [loc, isNewsroomAdmin]);
  const qc = useQueryClient();
  const prevAuth = useRef<boolean | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (prevAuth.current !== null && prevAuth.current !== isAuthenticated) qc.resetQueries();
    else if (prevAuth.current === null && isAuthenticated) qc.invalidateQueries();
    prevAuth.current = isAuthenticated;
  }, [isLoading, isAuthenticated, qc]);
  const { data } = useGetIssue({ query: { queryKey: getGetIssueQueryKey(), retry: 1, refetchInterval: 30000 } });
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="no-print md:w-60 md:min-h-[100dvh] md:sticky md:top-0 md:self-start bg-[#1e1812] text-[#f2ead3] md:flex md:flex-col">
        <div className="p-4 border-b-4 border-double border-[#d6a021]">
          <div className="kicker !text-[#d6a021]">Portland, Maine / 1991</div>
          <div className="display text-3xl font-black leading-[.9] mt-1">The Underground Press</div>
          <div className="mono text-[11px] mt-2 opacity-80">We're all looking for a place to land.</div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1" aria-label="Main">
          {navItems.map(([href, label], i) => {
            const on = href === '/' ? loc === '/' : loc.startsWith(href);
            return (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                className={`mono whitespace-nowrap text-sm px-3 py-2 border-l-4 transition-colors ${on ? 'bg-[#5c1a20] border-[#d6a021] text-white' : 'border-transparent hover:bg-[#34503f]'}`}>
                <span className="opacity-60 mr-2">{String(i + 1).padStart(2, '0')}</span>{label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3 border-t border-[#f2ead355] text-xs mono space-y-2 hidden md:block">
          <div>Published by Nobody<br />Contributors Everybody<br />Masthead credit: Approved by Myrtle (self-attested)</div>
          <div className="text-[10px] opacity-70">Only Myrtle sign-offs labeled verified are tied to an account role; other reviewer names are self-attested.</div>
          <div className="text-[#d6a021]">Auto-sync: off · manual GitHub actions</div>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 bg-[#34503f] text-[#f2ead3] mono text-xs border-b-2 border-[#1e1812]">
          <span data-testid="text-revision">Working copy rev {data?.revision ?? '...'}</span>
          <span className="hidden sm:inline">Local database is the working copy; GitHub changes require an explicit Repository action.</span>
          <span className="ml-auto flex items-center gap-2">
            {isLoading ? <span>checking login</span> : isAuthenticated ? (
              <>
                <span data-testid="text-user">{user?.firstName || user?.email || 'Signed in'}</span>
                <button className="btn !py-0.5 !min-h-0 btn-mustard" onClick={logout} data-testid="button-logout"><LogOut size={12} />Log out</button>
              </>
            ) : (
              <button className="btn !py-0.5 !min-h-0 btn-mustard" onClick={login} data-testid="button-login"><LogIn size={12} />Log in</button>
            )}
          </span>
        </div>
        <main className="p-4 md:p-8 max-w-6xl">{children}</main>
        <footer className="no-print px-4 md:px-8 pb-8 mono text-xs text-[#4a3f33]">
          Thanks to our advertisers: The Crust Bucket / Quality Shop / Great Lost Bear / Tony's Donuts
        </footer>
      </div>
    </div>
  );
}
