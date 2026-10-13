import { useQueryClient } from '@tanstack/react-query';
import {
  getListMyrtleEditorAssignmentsQueryKey,
  useListMyrtleEditorAssignments,
  useUpdateMyrtleEditorAssignment,
} from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { Check, Shield, UserRound, UserRoundX } from 'lucide-react';
import { Head, Loading } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/press';

function accountLabel(account: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}) {
  const name = [account.firstName, account.lastName].filter(Boolean).join(' ').trim();
  return name || account.email || 'Authenticated account';
}

export default function EditorAccess() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = auth.roles.includes('newsroom_admin');
  const assignments = useListMyrtleEditorAssignments({
    query: {
      queryKey: getListMyrtleEditorAssignmentsQueryKey(),
      enabled: isAdmin,
      refetchInterval: 30000,
      retry: false,
    },
  });
  const update = useUpdateMyrtleEditorAssignment({
    mutation: {
      onSuccess: async (_updated, variables) => {
        await queryClient.invalidateQueries({ queryKey: getListMyrtleEditorAssignmentsQueryKey() });
        toast({
          title: variables.data.enabled ? 'Editor access granted' : 'Editor access revoked',
          description: 'The change is active immediately and recorded in the access history.',
        });
      },
      onError: (error) => {
        toast({ title: 'Access change failed', description: errMsg(error), variant: 'destructive' });
      },
    },
  });

  if (auth.isLoading) return <Loading />;
  if (!isAdmin) {
    return (
      <section className="card" data-testid="notice-editor-access-denied">
        <Head kicker="Restricted desk" title="Editor access" />
        <p>Only a newsroom administrator can view or change Myrtle editor assignments.</p>
      </section>
    );
  }

  return (
    <div>
      <Head kicker="Newsroom administration" title="Editor access">
        <span className="tag"><Shield size={13} /> Administrator</span>
      </Head>
      <p className="max-w-3xl mb-5 text-sm">
        Grant or revoke the Myrtle editor role for authenticated accounts. These changes take effect on the server immediately.
        Newsroom administrator access itself is restricted to accounts configured by the deployment.
      </p>

      {assignments.isLoading ? <Loading /> : assignments.error ? (
        <section className="card" role="alert">
          <h2 className="text-xl font-bold">Could not load account access</h2>
          <p className="text-sm mt-2">{errMsg(assignments.error)}</p>
          <button className="btn mt-3" onClick={() => assignments.refetch()}>Try again</button>
        </section>
      ) : (
        <>
          <section className="card mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="kicker">Authenticated accounts</div>
                <h2 className="text-2xl font-black">Myrtle editor role</h2>
              </div>
              <span className="tag">{assignments.data?.accounts.length ?? 0} accounts</span>
            </div>
            {!assignments.data?.accounts.length ? (
              <p className="text-sm">No accounts have signed in yet.</p>
            ) : (
              <div className="divide-y-2 divide-[#1e1812]/15">
                {assignments.data.accounts.map((account) => (
                  <article key={account.accountId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3" data-testid={`row-editor-access-${account.accountId}`}>
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-2">
                        <UserRound size={15} />
                        <span className="truncate">{accountLabel(account)}</span>
                        {account.enabled && <span className="tag !py-0">Myrtle editor</span>}
                      </div>
                      <p className="mono text-xs break-all mt-1">
                        {account.email || 'No email provided'} · account {account.accountId}
                      </p>
                      {account.changedAt && (
                        <p className="text-xs mt-1">
                          Last changed by {account.changedBy || 'unknown'} on {new Date(account.changedAt).toLocaleString()}
                        </p>
                      )}
                      {!account.changedAt && account.enabled && (
                        <p className="text-xs mt-1">Access comes from the legacy deployment assignment.</p>
                      )}
                    </div>
                    <button
                      className={`btn shrink-0 ${account.enabled ? 'btn-red' : 'btn-green'}`}
                      disabled={update.isPending}
                      onClick={() => update.mutate({
                        accountId: account.accountId,
                        data: { enabled: !account.enabled },
                      })}
                      data-testid={`button-${account.enabled ? 'revoke' : 'grant'}-editor-${account.accountId}`}
                    >
                      {account.enabled ? <><UserRoundX size={14} />Revoke access</> : <><Check size={14} />Grant access</>}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="kicker">Audit trail</div>
            <h2 className="text-2xl font-black mb-3">Recent access changes</h2>
            {!assignments.data?.changes.length ? (
              <p className="text-sm">No in-app role changes have been recorded.</p>
            ) : (
              <ol className="space-y-2 text-sm" data-testid="list-editor-role-changes">
                {assignments.data.changes.map((change) => (
                  <li key={change.id} className="card-flat">
                    <b>{change.enabled ? 'Granted' : 'Revoked'}</b> Myrtle editor access for{' '}
                    <span className="mono break-all">{change.targetAccountId}</span>
                    <br />
                    <span className="text-xs">Changed by {change.changedBy} · {new Date(change.changedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
