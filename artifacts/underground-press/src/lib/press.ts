import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetIssue,
  useGetReadiness,
  useExecutePressCommand,
  getGetIssueQueryKey,
  getGetReadinessQueryKey,
  getListVersionsQueryKey,
  type PressCommand,
} from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { useToast } from '@/hooks/use-toast';

export function errMsg(e: unknown): string {
  const x = e as { status?: number; data?: { error?: string } | null; message?: string };
  return x?.data?.error || x?.message || 'Request failed';
}
export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number })?.status;
}

export function fmt(d?: string) {
  if (!d) return '-';
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleString();
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const POLL = { refetchInterval: 30000, retry: 1, staleTime: 10000 };

export function usePress() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const auth = useAuth();
  const issueQ = useGetIssue({ query: { queryKey: getGetIssueQueryKey(), ...POLL } });
  const readyQ = useGetReadiness({ query: { queryKey: getGetReadinessQueryKey(), ...POLL } });
  const mut = useExecutePressCommand();
  const revRef = useRef(0);
  revRef.current = issueQ.data?.revision ?? 0;
  const mutateAsync = useRef(mut.mutateAsync);
  mutateAsync.current = mut.mutateAsync;
  const canWrite = auth.isAuthenticated;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetIssueQueryKey() });
    qc.invalidateQueries({ queryKey: getGetReadinessQueryKey() });
    qc.invalidateQueries({ queryKey: getListVersionsQueryKey() });
  };

  const run = async (cmd: Omit<PressCommand, 'revision'>, okMsg?: string, expectedRevision?: number): Promise<boolean> => {
    if (!canWrite) {
      toast({ title: 'Log in to make changes', description: 'Browsing is open. Writes need a signed-in human.' });
      return false;
    }
    try {
      const issue = await mutateAsync.current({ data: { ...cmd, revision: expectedRevision ?? revRef.current } });
      qc.setQueryData(getGetIssueQueryKey(), issue);
      refresh();
      toast({ title: okMsg ?? 'Saved to working copy', description: `Revision ${issue.revision}` });
      return true;
    } catch (e) {
      if (errStatus(e) === 409) {
        refresh();
        toast({ title: 'Stale revision', description: 'Someone else changed the issue. Reloaded latest; review and retry.', variant: 'destructive' });
      } else {
        toast({ title: 'Command rejected', description: errMsg(e), variant: 'destructive' });
      }
      return false;
    }
  };

  return {
    auth,
    issue: issueQ.data,
    readiness: readyQ.data,
    isLoading: issueQ.isLoading || readyQ.isLoading,
    error: issueQ.error ?? readyQ.error,
    refetch: () => { issueQ.refetch(); readyQ.refetch(); },
    run,
    refresh,
    pending: mut.isPending,
    canWrite,
  };
}
