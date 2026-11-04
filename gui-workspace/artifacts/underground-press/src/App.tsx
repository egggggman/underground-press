import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import PagesBoard from '@/pages/pages-board';
import Puzzles from '@/pages/puzzles';
import Assets from '@/pages/assets';
import Artwork from '@/pages/artwork';
import Continuity from '@/pages/continuity';
import Proof from '@/pages/proof';
import History from '@/pages/history';
import Repository from '@/pages/repository';
import StyleGuide from '@/pages/style-guide';
import EditorAccess from '@/pages/editor-access';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/pages" component={PagesBoard} />
          <Route path="/puzzles" component={Puzzles} />
          <Route path="/assets" component={Assets} />
          <Route path="/artwork" component={Artwork} />
          <Route path="/continuity" component={Continuity} />
          <Route path="/proof" component={Proof} />
          <Route path="/history" component={History} />
          <Route path="/repository" component={Repository} />
          <Route path="/style-guide" component={StyleGuide} />
          <Route path="/access" component={EditorAccess} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
