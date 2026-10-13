import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetGitHubConnectionStatus,
  useListGitHubRepositories,
  usePreviewGitHubPull,
  useApplyGitHubPull,
  usePreviewGitHubPush,
  useApplyGitHubPush,
  usePreviewGitHubPageOneSource,
  useApplyGitHubPageOneSource,
  usePreviewGitHubMediaTransfer,
  useApplyGitHubMediaTransfer,
  useListGitHubMediaRestores,
  useImportIssue,
  getGetGitHubConnectionStatusQueryKey,
  getListGitHubRepositoriesQueryKey,
  getListGitHubMediaRestoresQueryKey,
  getGetIssueQueryKey,
  getGetReadinessQueryKey,
  getListVersionsQueryKey,
  exportIssue,
  type GitHubRepository,
  type GitHubSyncPreview,
  type GitHubMediaTransferPreview,
  type GitHubMediaTransferResult,
  type GitHubMediaRestoreRecord,
  type Issue,
} from '@workspace/api-client-react';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Check, ChevronLeft, ChevronRight,
  CircleHelp, FileJson2, Github, LockKeyhole, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { usePress, downloadJson, errMsg, errStatus } from '@/lib/press';
import {
  getMediaRestoreFailureNotice,
  type MediaRestoreFailureNotice,
} from '@/lib/media-restore-error.mjs';
import { useToast } from '@/hooks/use-toast';
import { Head, Loading, ErrorState, Tag, WriteNote } from '@/components/bits';

type Workflow = 'pull' | 'push' | 'source';

type MediaDirection = 'to_repository' | 'from_repository';
function Fingerprint({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0 border-l-2 border-[#34503f] pl-2" data-testid={`fingerprint-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="lbl mb-1">{label}</div>
      <div className="mono break-all text-xs">{value || 'Not provided by GitHub'}</div>
    </div>
  );
}

function PreviewCard({
  preview, localIssue, currentRevision, workflow, stale, onConfirm, busy, disabledReason,
}: {
  preview: GitHubSyncPreview;
  localIssue: Issue;
  currentRevision: number;
  workflow: Workflow;
  stale: boolean;
  onConfirm: () => void;
  busy: boolean;
  disabledReason: string | null;
}) {
  const blockers = preview.pullBlockers ?? [];
  const fileValid = preview.fileExists && Boolean(preview.remoteIssue) && !preview.remoteIssueError;
  const isPush = workflow === 'push';
  const isSource = workflow === 'source';
  const title = isPush ? 'Push review' : isSource ? 'Page 1 source review' : 'Pull review';
  const pageOne = preview.remoteIssue?.pages.find((page) => page.number === 1);
  const localPageOne = localIssue.pages.find((page) => page.number === 1);
  const changedPages = preview.remoteIssue
    ? localIssue.pages
      .filter((page) => page.number !== 1)
      .map((localPage) => ({
        local: localPage,
        remote: preview.remoteIssue!.pages.find((page) => page.number === localPage.number),
      }))
      .filter(({ local, remote }) => remote && (
        local.title !== remote.title || local.section !== remote.section || local.copy !== remote.copy
      ))
    : [];
  const metadataSections = preview.remoteIssue
    ? [
        { key: 'assets', label: 'Asset records', local: localIssue.assets, remote: preview.remoteIssue.assets },
        { key: 'puzzles', label: 'Puzzle records', local: localIssue.puzzles, remote: preview.remoteIssue.puzzles },
        { key: 'checklist', label: 'Continuity checklist', local: localIssue.checklist, remote: preview.remoteIssue.checklist },
        { key: 'proofs', label: 'Proof records', local: localIssue.proofs, remote: preview.remoteIssue.proofs },
      ]
    : [];
  return (
    <section className="card mt-5 rise" data-testid={`panel-${workflow}-preview`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-double border-[#1e1812] pb-3">
        <div>
          <div className="kicker">Explicit confirmation required</div>
          <h3 className="text-2xl font-black mt-1">{title}</h3>
          <p className="mono text-xs mt-1" data-testid={`${workflow}-target`}>
            {preview.owner}/{preview.repo} · {preview.branch} · {preview.path}
          </p>
        </div>
        <Tag kind={stale ? 'bad' : 'warn'}>{stale ? 'Stale preview' : 'Preview only'}</Tag>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 py-4" data-testid={`${workflow}-fingerprints`}>
        <Fingerprint label="Local revision" value={`rev ${preview.localRevision}`} />
        <Fingerprint label="Current local revision" value={`rev ${currentRevision}`} />
        <Fingerprint label="GitHub issue revision" value={preview.remoteIssue ? `rev ${preview.remoteIssue.revision}` : null} />
        <Fingerprint label="Remote HEAD" value={preview.headSha} />
        <Fingerprint label="Remote blob" value={preview.blobSha} />
      </div>
      <div className="grid sm:grid-cols-3 gap-2 mb-4 text-sm">
        <div className="card-flat" data-testid={`${workflow}-file-status`}>
          File: <b>{preview.fileExists ? 'present' : 'absent'}</b>
          {preview.remoteIssueError && <div className="text-[#5c1a20] mt-1">{preview.remoteIssueError}</div>}
          {preview.fileExists && !preview.remoteIssue && !preview.remoteIssueError && <div className="mt-1">Remote JSON could not be confirmed as a valid issue.</div>}
        </div>
        <div className="card-flat" data-testid={`${workflow}-push-access`}>
          GitHub push access: <b>{preview.pushAccess ? 'granted' : 'not granted'}</b>
        </div>
        <div className="card-flat" data-testid={`${workflow}-page-one-diff`}>
          Page 1 differs: <b>{preview.pageOneDiffers ? 'yes' : 'no'}</b>
        </div>
      </div>
      {stale && (
        <div className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mb-3 text-sm" role="alert" data-testid={`${workflow}-stale-warning`}>
          The local revision or selected target changed after this preview. Discard it and preview again before continuing.
        </div>
      )}
      {blockers.length > 0 && (
        <div className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mb-3" data-testid={`${workflow}-blockers`}>
          <div className="flex gap-2 items-center font-bold"><ShieldAlert size={16} /> Server-reported blockers</div>
          <ul className="list-disc pl-5 text-sm mt-1">{blockers.map((item, i) => <li key={`${i}-${item}`} data-testid={`${workflow}-blocker-${i}`}>{item}</li>)}</ul>
        </div>
      )}
      {workflow === 'pull' && (
        <p className="text-sm mb-3">A pull applies ordinary issue data from GitHub while preserving the current locked Page 1. The server resets imported approvals, puzzle validation and proofs; the preview is not an approval or provenance check.</p>
      )}
      {workflow === 'push' && (
        <p className="text-sm mb-3">A JSON commit does not transfer media bytes. GitHub remains authoritative; this action will write only the issue JSON and preserve the remote GitHub Page 1.</p>
      )}
      {workflow === 'source' && (
        <div className="border-2 border-[#5c1a20] p-3 mb-3" data-testid="source-load-boundary">
          <p className="font-bold text-[#5c1a20]">This is the only workflow here that may touch local Page 1, and only to fill missing source copy. It never replaces existing copy or an approved cover; the server rejects the load if copy is already present.</p>
          {localPageOne && <p className="text-sm mt-1" data-testid="text-page1-actual-state">Actual local state: {localPageOne.copy.trim() ? 'source copy is present, so a load will be rejected' : 'source copy is missing, so it can be filled'}; editorial {localPageOne.editorialApproval ? 'approval recorded' : 'approval not recorded'}.</p>}
          <p className="text-sm mt-1">Loading source material is not editorial approval or art approval. It does not verify puzzle or artwork provenance.</p>
          {localPageOne?.sourceIdentity && <p className="mono text-xs mt-1 break-all" data-testid="text-page1-source-identity">Preserved Page 1 source version: {localPageOne.sourceIdentity}</p>}
          <p className="text-sm mt-1">To verify original front-page approval paperwork against this exact recovered source and the confirmed reference, use the separate Myrtle-only comparison in <a className="underline font-bold" href="/history">History</a>. That review never changes the locked cover or its snapshots.</p>
          {pageOne && localPageOne && (
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <div className="card-flat">
                <div className="lbl">Current locked Page 1</div>
                <b>{localPageOne.title}</b><div className="mono text-xs mt-1">{localPageOne.section || 'No section recorded'}</div>
                <p className="whitespace-pre-wrap text-sm mt-2">{localPageOne.copy || 'No Page 1 copy is currently loaded.'}</p>
              </div>
              <div className="card-flat border-[#5c1a20]">
                <div className="lbl">Page 1 from this exact GitHub commit</div>
                <b>{pageOne.title}</b><div className="mono text-xs mt-1">{pageOne.section || 'No section recorded'}</div>
                <p className="whitespace-pre-wrap text-sm mt-2">{pageOne.copy}</p>
              </div>
            </div>
          )}
        </div>
      )}
      {(workflow === 'pull' || workflow === 'push') && preview.remoteIssue && (
        <section className="mb-4" data-testid={`${workflow}-content-diff`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs mono" data-testid={`${workflow}-record-counts`}>
            <div className="card-flat">Pages · local {localIssue.pages.length} / GitHub {preview.remoteIssue.pages.length}</div>
            <div className="card-flat">Assets · local {localIssue.assets.length} / GitHub {preview.remoteIssue.assets.length}</div>
            <div className="card-flat">Puzzles · local {localIssue.puzzles.length} / GitHub {preview.remoteIssue.puzzles.length}</div>
            <div className="card-flat">Proofs · local {localIssue.proofs.length} / GitHub {preview.remoteIssue.proofs.length}</div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3" data-testid={`${workflow}-metadata-differences`}>
            {metadataSections.map((section) => {
              const differs = JSON.stringify(section.local) !== JSON.stringify(section.remote);
              return <Tag key={section.key} kind={differs ? 'warn' : 'ok'}>{section.label}: {differs ? 'different' : 'same'}</Tag>;
            })}
          </div>
          <h4 className="font-black">{changedPages.length ? `${changedPages.length} page${changedPages.length === 1 ? '' : 's'} with copy differences` : 'No Page 2–10 copy differences'}</h4>
          <p className="text-xs mt-1 mb-2">
            {isPush
              ? 'For changed pages, this commit will use the local working-copy text shown on the left.'
              : 'For changed pages, this pull will use the GitHub text shown on the right. Page 1 is excluded.'}
          </p>
          {changedPages.length > 0 && (
            <div className="space-y-2">
              {changedPages.map(({ local, remote }) => remote && (
                <details key={local.number} className="card-flat" data-testid={`${workflow}-page-diff-${local.number}`}>
                  <summary className="cursor-pointer font-bold">
                    Page {local.number}: {local.title} / {remote.title}
                    <span className="mono text-xs font-normal ml-2">
                      {[local.title !== remote.title && 'title', local.section !== remote.section && 'section', local.copy !== remote.copy && 'copy']
                        .filter(Boolean).join(', ')}
                    </span>
                  </summary>
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    <div><div className="lbl">Local working copy · {local.section || 'No section recorded'}</div><b>{local.title}</b><p className="whitespace-pre-wrap text-sm mt-1 max-h-64 overflow-y-auto">{local.copy || 'Empty copy'}</p></div>
                    <div><div className="lbl">GitHub · {remote.section || 'No section recorded'}</div><b>{remote.title}</b><p className="whitespace-pre-wrap text-sm mt-1 max-h-64 overflow-y-auto">{remote.copy || 'Empty copy'}</p></div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      )}
      {!fileValid && isPush && <p className="text-sm text-[#5c1a20] mb-3">Push is blocked: the remote file is absent or its JSON issue record was not validated.</p>}
      {isPush && !preview.pushAccess && <p className="text-sm text-[#5c1a20] mb-3">Push is blocked because this account has no repository push access.</p>}
      {isSource && !fileValid && <p className="text-sm text-[#5c1a20] mb-3">Page 1 source load is unavailable until GitHub returns a present, valid issue file.</p>}
      {disabledReason && <p className="text-sm text-[#5c1a20] mb-3" data-testid={`${workflow}-disabled-reason`}>{disabledReason}</p>}
      <button
        className={`btn ${isPush ? 'btn-red' : 'btn-green'}`}
        disabled={busy || stale || Boolean(disabledReason) || (blockers.length > 0 && !isPush) || (isPush && (!fileValid || !preview.pushAccess)) || (isSource && !fileValid)}
        onClick={onConfirm}
        data-testid={`button-confirm-${workflow}`}
      >
        {busy ? 'Waiting for server…' : isPush ? 'Confirm push preview' : isSource ? 'Authorize Page 1 source load' : 'Confirm pull preview'}
      </button>
    </section>
  );
}

export default function Repository() {
  const { issue, readiness, isLoading, error, refetch, canWrite, auth } = usePress();
  const qc = useQueryClient();
  const { toast } = useToast();
  const mediaRestoreHistoryKey = [...getListGitHubMediaRestoresQueryKey(), auth.user?.id ?? 'signed-out'] as const;
  const mediaRestoreHistoryQ = useListGitHubMediaRestores({
    query: {
      queryKey: mediaRestoreHistoryKey,
      enabled: canWrite,
      retry: 1,
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });
  const connectionQ = useGetGitHubConnectionStatus({
    query: { queryKey: getGetGitHubConnectionStatusQueryKey(), enabled: canWrite, retry: 1, staleTime: 10000 },
  });
  const [repositoryPage, setRepositoryPage] = useState(1);
  const connected = connectionQ.data?.connected === true;
  const repositoriesQ = useListGitHubRepositories(repositoryPage, {
    query: { queryKey: getListGitHubRepositoriesQueryKey(repositoryPage), enabled: connected, retry: 1 },
  });
  const pullPreviewMutation = usePreviewGitHubPull();
  const pullMutation = useApplyGitHubPull();
  const pushPreviewMutation = usePreviewGitHubPush();
  const pushMutation = useApplyGitHubPush();
  const sourcePreviewMutation = usePreviewGitHubPageOneSource();
  const sourceMutation = useApplyGitHubPageOneSource();
  const mediaPreviewMutation = usePreviewGitHubMediaTransfer();
  const mediaTransferMutation = useApplyGitHubMediaTransfer();
  const importMutation = useImportIssue();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState('');
  const [previews, setPreviews] = useState<Partial<Record<Workflow, GitHubSyncPreview>>>({});
  const [acknowledged, setAcknowledged] = useState<Partial<Record<Workflow, boolean>>>({});
  const [commitMessage, setCommitMessage] = useState('');
  const [lastCommit, setLastCommit] = useState<{ sha: string; url: string; revision: number } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<GitHubMediaTransferPreview | null>(null);
  const [mediaSelectedAssetIds, setMediaSelectedAssetIds] = useState<Set<string>>(new Set());
  const [mediaAcknowledged, setMediaAcknowledged] = useState(false);
  const [replaceRemoteMediaConflicts, setReplaceRemoteMediaConflicts] = useState(false);
  const [mediaTransferError, setMediaTransferError] = useState<MediaRestoreFailureNotice | null>(null);
  const [lastMediaTransfer, setLastMediaTransfer] = useState<GitHubMediaTransferResult | null>(null);
  const [candidate, setCandidate] = useState<Issue | null>(null);
  const [importProblems, setImportProblems] = useState<string[]>([]);
  const [importAck, setImportAck] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (isLoading) return <Loading />;
  if (error || !issue) return <ErrorState error={error} retry={refetch} />;

  const selection = (): { owner: string; repo: string; branch: string; path: string; revision: number } | null => {
    if (!selectedRepo || !branch.trim() || !path.trim()) return null;
    return {
      owner: selectedRepo.owner,
      repo: selectedRepo.name,
      branch: branch.trim(),
      path: path.trim().replace(/^\/+/, ''),
      revision: issue.revision,
    };
  };
  const selectionKey = (s: ReturnType<typeof selection>) => s ? `${s.owner}/${s.repo}:${s.branch}:${s.path}:rev${s.revision}` : '';
  const mediaPreviewIsStale = (preview: GitHubMediaTransferPreview) => {
    const current = selection();
    return !current || preview.localRevision !== issue.revision ||
      `${preview.owner}/${preview.repo}:${preview.branch}:${preview.issuePath}:rev${preview.localRevision}` !== selectionKey(current);
  };
  const previewIsStale = (preview: GitHubSyncPreview) => {
    const current = selection();
    return !current || preview.localRevision !== issue.revision ||
      `${preview.owner}/${preview.repo}:${preview.branch}:${preview.path}:rev${preview.localRevision}` !== selectionKey(current);
  };
  const refreshIssueData = () => {
    void qc.invalidateQueries({ queryKey: getGetIssueQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetReadinessQueryKey() });
    void qc.invalidateQueries({ queryKey: getListVersionsQueryKey() });
  };
  const resetMediaPreview = () => {
    setMediaPreview(null);
    setMediaSelectedAssetIds(new Set());
    setMediaAcknowledged(false);
    setReplaceRemoteMediaConflicts(false);
    setMediaTransferError(null);
  };
  const setTarget = (repo: GitHubRepository | null) => {
    setSelectedRepo(repo);
    setBranch(repo?.defaultBranch ?? '');
    setPath('');
    setPreviews({});
    setAcknowledged({});
    setLastCommit(null);
    resetMediaPreview();
    setLastMediaTransfer(null);
  };
  const showFailure = (title: string, e: unknown, onStale?: () => void) => {
    if (errStatus(e) === 409) {
      refreshIssueData();
      setPreviews({});
      toast({ title: 'Stale repository preview', description: 'The server rejected a stale revision or remote fingerprint. Data was refreshed; preview again.', variant: 'destructive' });
      onStale?.();
    } else {
      toast({ title, description: errMsg(e), variant: 'destructive' });
    }
  };
  const doExport = async () => {
    if (canWrite && !window.confirm("This editorial JSON includes protected puzzle answers and review evidence. Keep it with the newsroom, not the reader edition. Export?")) return;
    setExporting(true);
    try {
      downloadJson(`underground-press-issue-rev${issue.revision}.json`, await exportIssue());
    } catch (e) {
      toast({ title: 'Export failed', description: errMsg(e), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };
  const previewWorkflow = async (workflow: Workflow) => {
    const data = selection();
    if (!data) return;
    setPreviews((old) => ({ ...old, [workflow]: undefined }));
    setAcknowledged((old) => ({ ...old, [workflow]: false }));
    try {
      const preview = workflow === 'pull'
        ? await pullPreviewMutation.mutateAsync({ data })
        : workflow === 'push'
          ? await pushPreviewMutation.mutateAsync({ data })
          : await sourcePreviewMutation.mutateAsync({ data });
      setPreviews((old) => ({ ...old, [workflow]: preview }));
    } catch (e) {
      showFailure(`${workflow === 'source' ? 'Page 1 source' : workflow} preview failed`, e);
    }
  };
  const previewMedia = async (direction: MediaDirection) => {
    const data = selection();
    if (!data) return;
    setMediaPreview(null);
    setMediaSelectedAssetIds(new Set());
    setMediaAcknowledged(false);
    setReplaceRemoteMediaConflicts(false);
    setMediaTransferError(null);
    try {
      const preview = await mediaPreviewMutation.mutateAsync({ data: { ...data, direction } });
      setMediaPreview(preview);
      setMediaSelectedAssetIds(initialMediaSelection(preview));
    } catch (e) {
      showFailure('Media transfer preview failed', e, () => setMediaPreview(null));
    }
  };
  const confirmMediaTransfer = async () => {
    const preview = mediaPreview;
    if (!preview || mediaPreviewIsStale(preview) || !mediaAcknowledged) return;
    const selectedConflictPaths = preview.direction === 'to_repository'
      ? (preview.files as Array<{ assetId: string; status: string; path: string }>)
        .filter((file) => mediaSelectedAssetIds.has(file.assetId) && file.status === 'remote_conflict')
        .map((file) => file.path)
      : [];
    if (selectedConflictPaths.length > 1 && !window.confirm([
      `You are about to replace ${selectedConflictPaths.length} existing GitHub media files:`,
      '',
      ...selectedConflictPaths.map((filePath) => `• ${filePath}`),
      '',
      'Only these selected paths will be replaced. Continue?',
    ].join('\n'))) return;
    setMediaTransferError(null);
    try {
      const result = await mediaTransferMutation.mutateAsync({
        data: {
          owner: preview.owner,
          repo: preview.repo,
          branch: preview.branch,
          path: preview.issuePath,
          revision: preview.localRevision,
          direction: preview.direction,
          expectedHeadSha: preview.headSha,
          selectedAssetIds: [...mediaSelectedAssetIds],
          expectedFiles: preview.files.map(({ assetId, path, status, localSha256, remoteSha256, remoteBlobSha }) => ({
            assetId, path, status, localSha256, remoteSha256, remoteBlobSha,
          })),
          confirmed: true,
          replaceRemoteConflicts: replaceRemoteMediaConflicts,
        },
      });
      setLastMediaTransfer(result);
      setMediaPreview(null);
      setMediaSelectedAssetIds(new Set());
      setMediaAcknowledged(false);
      setReplaceRemoteMediaConflicts(false);
      setMediaTransferError(null);
      if (preview.direction === 'from_repository') {
        void qc.invalidateQueries({ queryKey: mediaRestoreHistoryKey });
      }
      toast({
        title: result.direction === 'to_repository' ? 'Media backup confirmed' : 'Media restore confirmed',
        description: `${result.filesTransferred} file${result.filesTransferred === 1 ? '' : 's'} transferred; ${result.filesAlreadyCurrent} already current. Issue review state was not changed.`,
      });
    } catch (e) {
      if (preview.direction === 'from_repository') {
        void qc.invalidateQueries({ queryKey: mediaRestoreHistoryKey });
      }
      const failureNotice = getMediaRestoreFailureNotice(e);
      if (failureNotice) {
        setMediaTransferError(failureNotice);
        toast({ title: failureNotice.title, description: failureNotice.reason, variant: 'destructive' });
      } else {
        showFailure('Media transfer was not applied', e, () => setMediaPreview(null));
      }
    }
  };
  const confirmPull = async () => {
    const preview = previews.pull;
    if (!preview || previewIsStale(preview)) return;
    try {
      const updated = await pullMutation.mutateAsync({
        data: {
          owner: preview.owner, repo: preview.repo, branch: preview.branch, path: preview.path,
          revision: preview.localRevision, expectedHeadSha: preview.headSha,
          expectedBlobSha: preview.blobSha, confirmed: true,
        },
      });
      qc.setQueryData(getGetIssueQueryKey(), updated);
      refreshIssueData();
      setPreviews({});
      resetMediaPreview();
      toast({ title: 'Pull confirmed by server', description: `Working copy is now revision ${updated.revision}. Page 1 was preserved.` });
    } catch (e) {
      showFailure('Pull was not applied', e);
    }
  };
  const confirmPush = async () => {
    const preview = previews.push;
    if (!preview || previewIsStale(preview) || !commitMessage.trim()) return;
    try {
      const result = await pushMutation.mutateAsync({
        data: {
          owner: preview.owner, repo: preview.repo, branch: preview.branch, path: preview.path,
          revision: preview.localRevision, expectedHeadSha: preview.headSha,
          expectedBlobSha: preview.blobSha, confirmed: true, message: commitMessage.trim(),
        },
      });
      setLastCommit({ sha: result.commitSha, url: result.htmlUrl, revision: result.revision });
      setCommitMessage('');
      setPreviews((old) => ({ ...old, push: undefined }));
      toast({ title: 'GitHub confirmed the commit', description: `Commit ${result.commitSha.slice(0, 12)} at revision ${result.revision}.` });
      refreshIssueData();
    } catch (e) {
      showFailure('Push was not confirmed', e);
    }
  };
  const confirmSourceLoad = async () => {
    const preview = previews.source;
    if (!preview || previewIsStale(preview) || !acknowledged.source) return;
    try {
      const updated = await sourceMutation.mutateAsync({
        data: {
          owner: preview.owner, repo: preview.repo, branch: preview.branch, path: preview.path,
          revision: preview.localRevision, expectedHeadSha: preview.headSha,
          expectedBlobSha: preview.blobSha, sourceLoadConfirmed: true,
        },
      });
      qc.setQueryData(getGetIssueQueryKey(), updated);
      refreshIssueData();
      setPreviews({});
      setAcknowledged({});
      resetMediaPreview();
      toast({ title: 'Page 1 source load confirmed', description: `Working copy is now revision ${updated.revision}. This did not approve editorial or art.` });
    } catch (e) {
      showFailure('Page 1 source was not loaded', e);
    }
  };
  const onFile = async (file: File | undefined) => {
    setCandidate(null);
    setImportProblems([]);
    setImportAck(false);
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const problems: string[] = [];
      if (!parsed || typeof parsed !== 'object') {
        problems.push('File must contain a JSON issue object.');
      } else {
        const record = parsed as Partial<Issue>;
        if (!Array.isArray(record.pages) || record.pages.length !== 10) {
          problems.push('Issue must contain exactly ten pages.');
        } else {
          record.pages.forEach((page, index) => {
            if (!page || typeof page.title !== 'string' || typeof page.copy !== 'string') {
              problems.push(`Page ${index + 1} is missing title or copy.`);
            }
            if (page && page.number !== index + 1) problems.push(`Slot ${index + 1} has page number ${page.number}.`);
          });
        }
        if (!Array.isArray(record.assets) || !Array.isArray(record.puzzles) || !Array.isArray(record.checklist) || !Array.isArray(record.proofs)) {
          problems.push('Issue must include assets, puzzles, checklist and proofs arrays.');
        }
        if (problems.length === 0) setCandidate(record as Issue);
      }
      setImportProblems(problems);
    } catch {
      setImportProblems(['File is not valid JSON.']);
    }
  };
  const doImport = async () => {
    if (!candidate || !importAck) return;
    try {
      const updated = await importMutation.mutateAsync({ data: { revision: issue.revision, issue: candidate, confirmed: true } });
      qc.setQueryData(getGetIssueQueryKey(), updated);
      refreshIssueData();
      setCandidate(null);
      setImportAck(false);
      resetMediaPreview();
      toast({ title: 'Import confirmed by server', description: `Working copy is now revision ${updated.revision}; current locked Page 1 was preserved.` });
    } catch (e) {
      showFailure('Import rejected; nothing was confirmed', e);
    }
  };

  const repos = repositoriesQ.data?.repositories ?? [];
  const configured = selection();
  const importedPageOne = candidate?.pages.find((page) => page.number === 1);
  const currentPageOne = issue.pages.find((page) => page.number === 1);
  const importedPageOneDiffers = Boolean(importedPageOne && currentPageOne && (
    importedPageOne.title !== currentPageOne.title ||
    importedPageOne.section !== currentPageOne.section ||
    importedPageOne.copy !== currentPageOne.copy
  ));
  const pendingPreview = pullPreviewMutation.isPending || pushPreviewMutation.isPending || sourcePreviewMutation.isPending || mediaPreviewMutation.isPending;
  const currentPreview = (workflow: Workflow) => previews[workflow];
  const disabledReason = !canWrite
    ? 'Sign in to preview or change the working copy.'
    : !connected
      ? 'A confirmed GitHub connection is required.'
      : !selectedRepo
        ? 'Select a repository returned by GitHub.'
        : !configured?.path
          ? 'Enter the JSON file path in this repository; no path is assumed.'
          : null;

  return (
    <div className="pb-8">
      <Head kicker="Repository desk · GitHub is authoritative" title="Compare before you move">
        <button className="btn btn-green" disabled={exporting} onClick={doExport} data-testid="button-export-issue">
          <ArrowDownToLine size={15} />{exporting ? 'Exporting…' : canWrite ? 'Export editorial JSON' : 'Export redacted JSON'}
        </button>
      </Head>
      <WriteNote canWrite={canWrite} login={auth.login} />

      <div className="card-flat mb-4 text-sm" data-testid="note-sync-vs-connector">
        <b>Two separate things.</b> App background sync: <b data-testid="status-app-sync">{issue.githubSync}</b> (this app never syncs on its own; pull, push, and source-load below are manual). GitHub connector (the installed, authenticated account): reported by the server below once signed in, independent of app sync, and unaffected by the app sync being inactive. Imported files cannot create or alter page locks or locked snapshots; the server keeps current ones.
      </div>
      <section className="card bg-[#1e1812] text-[#f2ead3] mb-6" data-testid="panel-github">
        <div className="grid md:grid-cols-[1fr_auto] items-start gap-4">
          <div className="flex items-start gap-3">
            <Github size={24} className="mt-1 shrink-0" />
            <div>
              <div className="kicker !text-[#d6a021]">Connection identity</div>
              <h2 className="text-2xl md:text-3xl font-black mt-1" data-testid="status-github-connection">
                {!canWrite ? 'Sign in to check GitHub' : connectionQ.isLoading ? 'Checking GitHub…' : connectionQ.data?.connected ? 'Connected to GitHub' : connectionQ.error ? 'Connection status unavailable' : 'Not connected'}
              </h2>
              <p className="text-sm mt-1" data-testid="text-github-account">
                {!canWrite
                  ? 'The GitHub connection check requires a signed-in press-room user.'
                  : connectionQ.data?.connected && connectionQ.data.account
                  ? `${connectionQ.data.account.name || connectionQ.data.account.login} · @${connectionQ.data.account.login}`
                  : connectionQ.error
                    ? `The server did not confirm a connection: ${errMsg(connectionQ.error)}`
                    : 'No GitHub account is confirmed by the server.'}
              </p>
            </div>
          </div>
          <div className="text-left md:text-right border-t md:border-t-0 md:border-l border-[#f2ead344] pt-3 md:pt-0 md:pl-5">
            <div className="kicker !text-[#d6a021]">Local working copy</div>
            <div className="mono text-2xl font-bold mt-1" data-testid="text-local-revision">rev {issue.revision}</div>
            <div className="text-xs mt-1">This is not the GitHub revision.</div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[#f2ead344] grid sm:grid-cols-3 gap-3 text-sm">
          <div><b>Authority</b><br />GitHub repository content</div>
          <div><b>Comparison</b><br />Manual preview; no background sync</div>
          <div><b>Working copy</b><br />Local issue database, revision {issue.revision}</div>
        </div>
      </section>

      <section className="card mb-6" data-testid="panel-repository-target">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="kicker">Live GitHub repository directory</div>
            <h2 className="text-2xl font-black mt-1">Choose the source, name the file</h2>
            <p className="text-sm mt-1 max-w-2xl">Only repositories returned for this confirmed account can be selected. Branch starts at the repository’s reported default branch. Enter the exact JSON path; the desk will not guess it.</p>
          </div>
          <button
            className="btn"
            disabled={!connected || repositoriesQ.isFetching}
            onClick={() => void repositoriesQ.refetch()}
            data-testid="button-refresh-repositories"
          ><RefreshCw size={14} />{repositoriesQ.isFetching ? 'Refreshing…' : 'Refresh repositories'}</button>
        </div>
        {!canWrite && (
          <div className="card-flat border-[#d6a021] mb-3 flex gap-2 text-sm" data-testid="note-github-sign-in-required">
            <CircleHelp size={16} className="shrink-0" />Sign in before checking the authorized GitHub account or listing repositories.
          </div>
        )}
        {canWrite && !connected && !connectionQ.isLoading && (
          <div className="card-flat border-[#d6a021] mb-3 flex gap-2 text-sm" data-testid="note-github-not-connected">
            <CircleHelp size={16} className="shrink-0" />
            {connectionQ.error ? 'Connection could not be checked. Repository actions stay unavailable until status is confirmed.' : 'Connect a GitHub account in the server-managed connection flow before selecting a repository.'}
          </div>
        )}
        {connected && repositoriesQ.isLoading && <div className="skeleton h-12 mb-3" aria-label="Loading repositories" data-testid="state-repositories-loading" />}
        {connected && repositoriesQ.error && (
          <div role="alert" className="card-flat border-[#5c1a20] mb-3 text-sm" data-testid="state-repositories-error">
            Could not load repositories: {errMsg(repositoriesQ.error)}
            <button className="btn mt-2" onClick={() => void repositoriesQ.refetch()} data-testid="button-retry-repositories">Retry</button>
          </div>
        )}
        {connected && !repositoriesQ.isLoading && !repositoriesQ.error && repos.length === 0 && (
          <div className="card-flat border-dashed text-center p-5 mb-3" data-testid="state-repositories-empty">No repositories were returned for this account on this page.</div>
        )}
        {repos.length > 0 && (
          <div className="space-y-2 mb-4" data-testid="list-github-repositories">
            {repos.map((repo) => {
              const selected = selectedRepo?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => setTarget(repo)}
                  className={`w-full text-left p-3 border-2 flex flex-wrap items-center justify-between gap-3 transition-colors ${selected ? 'border-[#34503f] bg-[#34503f18]' : 'border-[#1e181255] bg-[#f2ead3]'}`}
                  data-testid={`button-select-repository-${repo.id}`}
                  aria-pressed={selected}
                >
                  <span className="min-w-0">
                    <span className="block font-bold break-all" data-testid={`text-repository-name-${repo.id}`}>{repo.fullName}</span>
                    <span className="mono text-xs">default branch: {repo.defaultBranch} · {repo.private ? 'private' : 'public'}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Tag kind={repo.pushAccess ? 'ok' : 'warn'}>{repo.pushAccess ? 'Push access' : 'No push access'}</Tag>
                    {selected && <Check size={17} aria-label="Selected" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {connected && repositoriesQ.data && (
          <div className="flex justify-between items-center gap-2">
            <span className="mono text-xs" data-testid="text-repository-page">Repository page {repositoriesQ.data.page}</span>
            <div className="flex gap-2">
              <button className="btn" disabled={repositoryPage <= 1 || repositoriesQ.isFetching} onClick={() => setRepositoryPage((p) => Math.max(1, p - 1))} data-testid="button-repositories-previous"><ChevronLeft size={14} />Previous</button>
              <button className="btn" disabled={!repositoriesQ.data.hasNextPage || repositoriesQ.isFetching} onClick={() => setRepositoryPage((p) => p + 1)} data-testid="button-repositories-next">Next<ChevronRight size={14} /></button>
            </div>
          </div>
        )}
        {selectedRepo && (
          <div className="mt-5 border-t-2 border-double border-[#1e1812] pt-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="lbl" htmlFor="github-branch">Branch</label>
                <input id="github-branch" className="field mono" value={branch} onChange={(e) => { setBranch(e.target.value); setPreviews({}); resetMediaPreview(); }} data-testid="input-github-branch" />
                <p className="text-xs mt-1">Default supplied by GitHub: <span className="mono">{selectedRepo.defaultBranch}</span></p>
              </div>
              <div className="md:col-span-2">
                <label className="lbl" htmlFor="github-path">JSON file path in repository</label>
                <input id="github-path" className="field mono" placeholder="Enter the exact path, for example only if verified in your repository" value={path} onChange={(e) => { setPath(e.target.value); setPreviews({}); resetMediaPreview(); }} data-testid="input-github-path" />
                <p className="text-xs mt-1">No filename or folder is prefilled. Path is sent exactly as entered, apart from leading slashes.</p>
              </div>
            </div>
            <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="card-flat flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid="selected-repository-details">
                <span><b>Repository</b> {selectedRepo.fullName}</span>
                <span><b>Branch</b> {branch || 'Not set'}</span>
                <span><b>Access</b> {selectedRepo.pushAccess ? 'Push granted' : 'Read only'}</span>
              </div>
              <span className="mono text-xs">local issue rev {issue.revision}</span>
            </div>
            <div className="mt-4 grid sm:grid-cols-3 gap-2">
              <button className="btn btn-green justify-center" disabled={Boolean(disabledReason) || pendingPreview} onClick={() => void previewWorkflow('pull')} data-testid="button-preview-pull"><ArrowDownToLine size={15} />{pullPreviewMutation.isPending ? 'Reading GitHub…' : 'Preview pull'}</button>
              <button className="btn justify-center" disabled={Boolean(disabledReason) || pendingPreview} onClick={() => void previewWorkflow('push')} data-testid="button-preview-push"><ArrowUpFromLine size={15} />{pushPreviewMutation.isPending ? 'Comparing…' : 'Preview push'}</button>
              <button className="btn btn-mustard justify-center" disabled={Boolean(disabledReason) || pendingPreview || Boolean(issue.pages.find((p) => p.number === 1)?.copy.trim())} title={issue.pages.find((p) => p.number === 1)?.copy.trim() ? 'Page 1 already has source copy; the loader only fills missing source.' : undefined} onClick={() => void previewWorkflow('source')} data-testid="button-preview-source-load"><LockKeyhole size={15} />{sourcePreviewMutation.isPending ? 'Checking source…' : 'Preview Page 1 source'}</button>
            </div>
            <div className="mt-5 border-t border-[#1e181255] pt-4" data-testid="panel-media-transfer-actions">
              <div className="kicker">Media files · separate from issue JSON</div>
              <h3 className="text-xl font-black mt-1">Back up or restore asset files</h3>
              <p className="text-sm mt-1 max-w-3xl">The media folder is derived from the exact JSON path above: <span className="mono">{configured?.path ? configured.path.replace(/\.json$/i, '.media') : 'issue-name.media'}/</span>. Restore reads the selected GitHub issue’s asset records as an index and writes missing bytes to private storage without importing or changing issue data.</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <button className="btn btn-red justify-center" disabled={Boolean(disabledReason) || pendingPreview} onClick={() => void previewMedia('to_repository')} data-testid="button-preview-media-backup">
                  <ArrowUpFromLine size={15} />{mediaPreviewMutation.isPending ? 'Inspecting files…' : 'Preview media backup'}
                </button>
                <button className="btn btn-green justify-center" disabled={Boolean(disabledReason) || pendingPreview} onClick={() => void previewMedia('from_repository')} data-testid="button-preview-media-restore">
                  <ArrowDownToLine size={15} />{mediaPreviewMutation.isPending ? 'Inspecting files…' : 'Preview media restore'}
                </button>
              </div>
            </div>
            {disabledReason && <p className="text-xs mt-2" data-testid="text-workflow-prerequisite">{disabledReason}</p>}
          </div>
        )}
      </section>

      {currentPreview('pull') && (
        <PreviewCard preview={currentPreview('pull')!} localIssue={issue} currentRevision={issue.revision} workflow="pull" stale={previewIsStale(currentPreview('pull')!)} busy={pullMutation.isPending} disabledReason={null} onConfirm={() => void confirmPull()} />
      )}
      {currentPreview('push') && (
        <section className="card mt-5" data-testid="push-confirmation-fields">
          <label className="lbl" htmlFor="github-commit-message">Commit message (required)</label>
          <input id="github-commit-message" className="field" maxLength={200} value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Describe this issue JSON update" data-testid="input-github-commit-message" />
          <p className="mono text-xs mt-1">{commitMessage.length}/200 characters</p>
        </section>
      )}
      {currentPreview('push') && (
        <PreviewCard preview={currentPreview('push')!} localIssue={issue} currentRevision={issue.revision} workflow="push" stale={previewIsStale(currentPreview('push')!)} busy={pushMutation.isPending} disabledReason={!commitMessage.trim() ? 'Enter a commit message to authorize a push.' : null} onConfirm={() => void confirmPush()} />
      )}
      {currentPreview('source') && (
        <div className="card mt-5" data-testid="source-load-authorization">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#34503f]" checked={Boolean(acknowledged.source)} onChange={(e) => setAcknowledged((old) => ({ ...old, source: e.target.checked }))} data-testid="checkbox-authorize-source-load" />
            <span>I explicitly authorize loading Page 1 source material from this exact GitHub preview into the local working copy. I understand this is not editorial or art approval and does not verify puzzle or artwork provenance.</span>
          </label>
        </div>
      )}
      {currentPreview('source') && (
        <PreviewCard preview={currentPreview('source')!} localIssue={issue} currentRevision={issue.revision} workflow="source" stale={previewIsStale(currentPreview('source')!)} busy={sourceMutation.isPending} disabledReason={!acknowledged.source ? 'Separate source-load authorization is required.' : null} onConfirm={() => void confirmSourceLoad()} />
      )}
      {mediaPreview && (
        <MediaTransferReview
          preview={mediaPreview}
          stale={mediaPreviewIsStale(mediaPreview)}
          acknowledged={mediaAcknowledged}
          selectedAssetIds={mediaSelectedAssetIds}
          replaceRemoteConflicts={replaceRemoteMediaConflicts}
          applyFailure={mediaTransferError}
          busy={mediaTransferMutation.isPending}
          onAcknowledge={setMediaAcknowledged}
          onSelectAsset={(assetId, checked) => {
            setMediaTransferError(null);
            setMediaAcknowledged(false);
            setReplaceRemoteMediaConflicts(false);
            setMediaSelectedAssetIds((old) => {
              const next = new Set(old);
              if (checked) next.add(assetId);
              else next.delete(assetId);
              return next;
            });
          }}
          onReplaceConflicts={(checked) => {
            setReplaceRemoteMediaConflicts(checked);
            setMediaAcknowledged(false);
          }}
          onConfirm={() => void confirmMediaTransfer()}
        />
      )}

      {lastCommit && (
        <section className="card mt-5 border-[#34503f]" data-testid="panel-last-commit">
          <div className="flex gap-2 items-center"><Check size={18} /><h3 className="text-xl font-black">GitHub confirmed this commit</h3><Tag kind="ok">Server result</Tag></div>
          <p className="text-sm mt-2">Repository JSON at local revision {lastCommit.revision} was committed. Media bytes were not transferred.</p>
          <Fingerprint label="Commit SHA" value={lastCommit.sha} />
          <a className="mono text-xs underline break-all mt-2 inline-block" href={lastCommit.url} target="_blank" rel="noreferrer" data-testid="link-confirmed-commit">Open confirmed commit on GitHub</a>
        </section>
      )}
      {lastMediaTransfer && (
        <section className="card mt-5 border-[#34503f]" data-testid="panel-last-media-transfer">
          <div className="flex gap-2 items-center"><Check size={18} /><h3 className="text-xl font-black">{lastMediaTransfer.direction === 'to_repository' ? 'Media backup confirmed' : 'Media restore confirmed'}</h3><Tag kind="ok">Server result</Tag></div>
          <p className="text-sm mt-2">{lastMediaTransfer.filesTransferred} file{lastMediaTransfer.filesTransferred === 1 ? '' : 's'} transferred; {lastMediaTransfer.filesAlreadyCurrent} already current. No issue review state was changed.</p>
          {lastMediaTransfer.skippedFiles.length > 0 && (
            <div className="mt-3 text-sm" data-testid="media-transfer-skipped-result">
              <b>{lastMediaTransfer.skippedFiles.length} file{lastMediaTransfer.skippedFiles.length === 1 ? '' : 's'} skipped</b>
              <ul className="list-disc pl-5 mt-1">
                {lastMediaTransfer.skippedFiles.map((file) => (
                  <li key={`${file.assetId}:${file.assetName}`}><span className="font-semibold">{file.assetName}</span>: {file.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {lastMediaTransfer.commitSha && <Fingerprint label="Media commit SHA" value={lastMediaTransfer.commitSha} />}
          {lastMediaTransfer.htmlUrl && <a className="mono text-xs underline break-all mt-2 inline-block" href={lastMediaTransfer.htmlUrl} target="_blank" rel="noreferrer" data-testid="link-confirmed-media-commit">Open media commit on GitHub</a>}
        </section>
      )}

      <section className="card mt-6" data-testid="panel-media-restore-history">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-double border-[#1e1812] pb-3">
          <div>
            <div className="kicker">Private-storage activity · separate audit</div>
            <h2 className="text-2xl font-black mt-1">GitHub media restore history</h2>
            <p className="text-sm mt-1">Completed and failed file restores remain here after you leave this page. File contents are never included.</p>
          </div>
          <button
            className="btn"
            disabled={!canWrite || mediaRestoreHistoryQ.isFetching}
            onClick={() => void mediaRestoreHistoryQ.refetch()}
            data-testid="button-refresh-media-restore-history"
          ><RefreshCw size={14} />{mediaRestoreHistoryQ.isFetching ? 'Refreshing…' : 'Refresh history'}</button>
        </div>
        {!canWrite && (
          <p className="card-flat mt-3 text-sm" data-testid="note-media-restore-history-sign-in">
            Sign in with a newsroom editor or administrator account to review restore history.
          </p>
        )}
        {canWrite && mediaRestoreHistoryQ.isLoading && (
          <div className="skeleton h-12 mt-3" aria-label="Loading restore history" data-testid="state-media-restore-history-loading" />
        )}
        {canWrite && mediaRestoreHistoryQ.error && (
          <div className="card-flat border-[#5c1a20] mt-3 text-sm" role="alert" data-testid="state-media-restore-history-error">
            Restore history could not be loaded: {errMsg(mediaRestoreHistoryQ.error)}
            <p className="mt-1">Only newsroom editors and administrators can review these records.</p>
            <button className="btn mt-2" onClick={() => void mediaRestoreHistoryQ.refetch()} data-testid="button-retry-media-restore-history">Retry</button>
          </div>
        )}
        {canWrite && !mediaRestoreHistoryQ.isLoading && !mediaRestoreHistoryQ.error &&
          mediaRestoreHistoryQ.data?.restores.length === 0 && (
            <div className="card-flat border-dashed text-center p-5 mt-3" data-testid="state-media-restore-history-empty">
              No GitHub media restore attempts have been recorded.
            </div>
          )}
        {canWrite && !mediaRestoreHistoryQ.error && mediaRestoreHistoryQ.data?.restores && (
          <div className="space-y-2 mt-3" data-testid="list-media-restore-history">
            {mediaRestoreHistoryQ.data.restores.map((record: GitHubMediaRestoreRecord) => (
              <article key={record.id} className="card-flat grid md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start" data-testid={`media-restore-history-record-${record.id}`}>
                <div className="min-w-0">
                  <div className="font-bold break-all">{record.fileName}</div>
                  <div className="mono text-xs break-all mt-1">{record.owner}/{record.repo} · {record.branch}</div>
                  <div className="mono text-xs break-all mt-1">{record.filePath}</div>
                  <div className="text-xs mt-1">Issue file: <span className="mono break-all">{record.issuePath}</span></div>
                  <div className="text-xs mt-1" data-testid={`media-restore-history-actor-${record.id}`}>
                    Restored by: <span className="font-semibold">{record.actorDisplayName}</span>
                  </div>
                  {record.failureReason && <p className="text-sm text-[#5c1a20] mt-2">{record.failureReason}</p>}
                </div>
                <div className="md:text-right shrink-0">
                  <Tag kind={record.outcome === 'completed' ? 'ok' : 'bad'}>
                    {record.outcome === 'completed' ? 'Completed' : 'Failed'}
                  </Tag>
                  <time className="mono block text-xs mt-2" dateTime={record.at}>{new Date(record.at).toLocaleString()}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-5 mt-7">
        <section className="card" data-testid="panel-export">
          <div className="kicker">Portable issue record</div>
          <h2 className="text-2xl font-black mt-1">Export JSON</h2>
          <p className="text-sm mt-2 mb-3">Downloads the server-produced issue record at the current local revision ({issue.revision}), including pages, asset records, puzzles, checklist and proofs. JSON contains references and metadata; it does not transfer media bytes.</p>
          <button className="btn btn-green" disabled={exporting} onClick={doExport} data-testid="button-export-json-secondary"><FileJson2 size={15} />{exporting ? 'Preparing…' : 'Download issue JSON'}</button>
          {readiness && <button className="btn ml-2 mt-2 sm:mt-0" onClick={() => downloadJson('underground-press-puzzle-manifest.json', readiness.manifest)} data-testid="button-export-manifest">Export puzzle manifest</button>}
        </section>
        <section className="card" data-testid="panel-import">
          <div className="kicker">Local file only</div>
          <h2 className="text-2xl font-black mt-1">Import issue JSON</h2>
          <p className="text-sm mt-2 mb-3">Import validates the record structure, then asks the server to apply it to editable drafts. All local locked pages, their puzzles and assets, and snapshots are kept; imported snapshot or approval claims are ignored.</p>
          <label className="lbl" htmlFor="imp">Issue JSON file</label>
          <input id="imp" type="file" accept="application/json,.json" className="field" disabled={!canWrite || importMutation.isPending} onChange={(e) => void onFile(e.target.files?.[0])} data-testid="input-import-file" />
          {importProblems.length > 0 && (
            <div className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mt-3 text-sm" role="alert" data-testid="list-import-problems">
              <b>Import validation failed. Nothing was changed.</b>
              <ul className="list-disc pl-5 mt-1">{importProblems.map((problem, i) => <li key={`${i}-${problem}`}>{problem}</li>)}</ul>
            </div>
          )}
          {importedPageOneDiffers && importedPageOne && currentPageOne && (
            <div className="border-2 border-[#d6a021] bg-[#d6a02115] p-3 mb-3" data-testid="import-page-one-preservation">
              <b>The imported file has different Page 1 content, but it will not be applied.</b>
              <p className="text-sm mt-1">Ordinary import preserves the current locked Page 1. To load a source, use the separately authorized GitHub Page 1 workflow.</p>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <div><div className="lbl">Current locked Page 1</div><b>{currentPageOne.title}</b><p className="whitespace-pre-wrap text-sm mt-1">{currentPageOne.copy || 'No Page 1 copy is currently loaded.'}</p></div>
                <div><div className="lbl">Incoming file Page 1 · ignored</div><b>{importedPageOne.title}</b><p className="whitespace-pre-wrap text-sm mt-1">{importedPageOne.copy}</p></div>
              </div>
            </div>
          )}
          {candidate && (
            <div className="card-flat mt-3" data-testid="panel-import-preview">
              <div className="font-bold">Ready for explicit import confirmation</div>
              <div className="mono grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2" data-testid="import-record-counts">
                <span>{candidate.pages.length} pages</span><span>{candidate.assets.length} asset records</span><span>{candidate.puzzles.length} puzzles</span><span>{candidate.proofs.length} proofs</span>
              </div>
              <p className="text-xs mt-2">Approvals, puzzle validation and proofs follow the server’s import rules. Current locked Page 1 is preserved regardless of JSON Page 1 differences.</p>
              <label className="flex gap-2 items-start text-sm mt-3 mb-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#34503f]" checked={importAck} onChange={(e) => setImportAck(e.target.checked)} data-testid="checkbox-import-ack" />
                <span>I understand this replaces the working copy at local revision {issue.revision}; GitHub is not modified by this file import.</span>
              </label>
              <button className="btn btn-red" disabled={!importAck || !canWrite || importMutation.isPending} onClick={() => void doImport()} data-testid="button-confirm-import">{importMutation.isPending ? 'Waiting for server…' : 'Confirm local import'}</button>
            </div>
          )}
        </section>
      </section>
      <div className="mt-5 text-xs flex gap-2 items-start opacity-80" data-testid="note-no-media-transfer">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <p>Issue JSON sync never moves media bytes. Use the separate media preview and authorization above; file presence in GitHub or storage does not verify provenance or grant approval.</p>
      </div>
    </div>
  );
}

function MediaTransferReview({
  preview, stale, acknowledged, selectedAssetIds, replaceRemoteConflicts,
  applyFailure, busy, onAcknowledge, onSelectAsset, onReplaceConflicts, onConfirm,
}: {
  preview: GitHubMediaTransferPreview;
  stale: boolean;
  acknowledged: boolean;
  selectedAssetIds: Set<string>;
  replaceRemoteConflicts: boolean;
  applyFailure: MediaRestoreFailureNotice | null;
  busy: boolean;
  onAcknowledge: (checked: boolean) => void;
  onSelectAsset: (assetId: string, checked: boolean) => void;
  onReplaceConflicts: (checked: boolean) => void;
  onConfirm: () => void;
}) {
  const isBackup = preview.direction === 'to_repository';
  const selectedFiles = preview.files.filter((file) =>
    selectedAssetIds.has(file.assetId) && isMediaFileSelectable(file, preview.direction),
  );
  const selectedConflicts = selectedFiles.filter((file) => file.status === 'remote_conflict');
  const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
  const exceedsCountLimit = selectedFiles.length > preview.maxFiles;
  const exceedsSizeLimit = selectedBytes > preview.maxTransferBytes;
  const transferable = selectedFiles.filter((file) => file.status === 'ready' || file.status === 'remote_conflict');
  const skippedCount = preview.files.length - selectedFiles.length;
  const blocked = preview.blockers.length > 0 || !preview.pushAccess && isBackup || stale;
  return (
    <section className="card mt-5 rise" data-testid="panel-media-transfer-preview">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-double border-[#1e1812] pb-3">
        <div>
          <div className="kicker">Separate file workflow · explicit authorization required</div>
          <h3 className="text-2xl font-black mt-1">{isBackup ? 'Back up issue media' : 'Restore issue media'}</h3>
          <p className="mono text-xs mt-1 break-all">{preview.owner}/{preview.repo} · {preview.repositoryPrivate ? 'private' : 'public'} · {preview.branch} · {preview.mediaDirectory}/</p>
          <p className="mono text-[11px] mt-1 break-all">GitHub branch preview: {preview.headSha}</p>
        </div>
        <Tag kind={stale ? 'bad' : 'warn'}>{stale ? 'Stale preview' : 'Preview only'}</Tag>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4 text-sm">
        <div className="card-flat"><b>{preview.files.length}</b> asset files</div>
        <div className="card-flat"><b>{selectedFiles.length}</b> selected · {skippedCount} skipped</div>
        <div className="card-flat">Selected size: <b>{formatBytes(selectedBytes)}</b> / {formatBytes(preview.maxTransferBytes)}</div>
        <div className="card-flat">Per file: <b>{formatBytes(preview.maxFileBytes)}</b> maximum</div>
        <div className="card-flat">Per transfer: <b>{preview.maxFiles} files</b> maximum</div>
      </div>
      {(exceedsCountLimit || exceedsSizeLimit) && (
        <p className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mt-3 text-sm" role="alert" data-testid="media-selection-limit-warning">
          {exceedsCountLimit && `Select no more than ${preview.maxFiles} files. `}
          {exceedsSizeLimit && `The selected files exceed the ${formatBytes(preview.maxTransferBytes)} combined limit.`}
        </p>
      )}
      {applyFailure && (
        <div className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mt-3 text-sm" role="alert" data-testid="media-transfer-apply-error">
          <b>{applyFailure.title}</b>
          <p className="mt-1">{applyFailure.reason}</p>
          <p className="mt-1">{applyFailure.recovery}</p>
        </div>
      )}
      {stale && <p className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mt-3 text-sm" role="alert">The selected repository, branch, JSON path, or local issue revision changed. Preview again before continuing.</p>}
      {!preview.repositoryPrivate && (
        <p className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mt-3 text-sm" role="alert">
          This GitHub repository is public. {isBackup ? 'Backing up will make these media files visible to anyone.' : 'The repository media files are already visible to anyone.'}
        </p>
      )}
      {isBackup && !preview.pushAccess && <p className="text-sm text-[#5c1a20] mt-3">This GitHub connection does not have repository push access.</p>}
      {preview.blockers.length > 0 && (
        <div className="border border-[#5c1a20] bg-[#5c1a2010] p-3 mt-3 text-sm" data-testid="media-transfer-blockers">
          <b>Transfer blocked</b>
          <ul className="list-disc pl-5 mt-1">{preview.blockers.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 space-y-2" data-testid="media-transfer-file-list">
        {preview.files.map((file) => (
          <div key={`${file.assetId}:${file.path}`} className="card-flat grid md:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start" data-testid={`media-transfer-file-${file.assetId}`}>
            <div className="min-w-0">
              <label className="flex gap-2 items-start font-bold break-words">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[#34503f]"
                  checked={selectedAssetIds.has(file.assetId)}
                  disabled={busy || !isMediaFileSelectable(file, preview.direction)}
                  onChange={(event) => onSelectAsset(file.assetId, event.target.checked)}
                  aria-label={`Select ${file.assetName}`}
                  data-testid={`checkbox-select-media-${file.assetId}`}
                />
                <span>{file.assetName}</span>
              </label>
              <div className="mono text-xs break-all mt-1">{file.path}</div>
              <div className="mono text-xs mt-1">{file.contentType} · {formatBytes(file.size)}</div>
              {!selectedAssetIds.has(file.assetId) && <div className="text-xs mt-1">Skipped: {isMediaFileSelectable(file, preview.direction) ? 'not selected.' : file.message || 'not eligible for this transfer.'}</div>}
              {(file.localSize !== null || file.remoteSize !== null) && (
                <div className="mono text-[11px] mt-1">
                  {file.localSize !== null && `Private copy: ${formatBytes(file.localSize)}`}
                  {file.localSize !== null && file.remoteSize !== null && ' · '}
                  {file.remoteSize !== null && `GitHub copy: ${formatBytes(file.remoteSize)}`}
                </div>
              )}
              {file.message && <div className="text-xs mt-1">{file.message}</div>}
            </div>
            <Tag kind={file.status === 'already_current' ? 'ok' : file.status === 'ready' ? 'warn' : 'bad'}>
              {mediaStatusLabel(file.status, preview.direction)}
            </Tag>
          </div>
        ))}
      </div>

      {isBackup && selectedConflicts.length > 0 && (
        <label className="flex gap-2 items-start text-sm mt-4 border border-[#d6a021] p-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#34503f]" checked={replaceRemoteConflicts} onChange={(e) => onReplaceConflicts(e.target.checked)} data-testid="checkbox-replace-github-media" />
          <span>I explicitly authorize replacing the {selectedConflicts.length} selected conflicting GitHub file{selectedConflicts.length === 1 ? '' : 's'}. Other repository files will not be changed.</span>
        </label>
      )}
      <label className="flex gap-2 items-start text-sm mt-4 mb-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[#34503f]" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} data-testid="checkbox-authorize-media-transfer" />
        <span>
          I authorize this exact media-only transfer. It does not import issue data or verify provenance, and it does not change puzzle validation, artwork review, source or credit, or Page 1.
          {!isBackup && ' Restore only writes files missing from private storage; a different existing private file is never overwritten.'}
        </span>
      </label>
      {selectedFiles.length === 0 && preview.blockers.length === 0 && <p className="text-sm mb-3">Select one or more eligible files to transfer. Files with unsupported types, missing bytes, or conflicts that cannot be replaced are skipped.</p>}
      {selectedFiles.length > 0 && transferable.length === 0 && preview.blockers.length === 0 && <p className="text-sm mb-3">The selected files are already current. No transfer or GitHub commit is needed.</p>}
      <button
        className={`btn ${isBackup ? 'btn-red' : 'btn-green'}`}
        disabled={busy || blocked || !acknowledged || transferable.length === 0 || exceedsCountLimit || exceedsSizeLimit || (isBackup && selectedConflicts.length > 0 && !replaceRemoteConflicts)}
        onClick={onConfirm}
        data-testid="button-confirm-media-transfer"
      >
        {busy
          ? 'Transferring…'
          : !isBackup && applyFailure
            ? `Retry restore of ${transferable.length} file${transferable.length === 1 ? '' : 's'}`
            : isBackup
              ? `Authorize backup of ${transferable.length} file${transferable.length === 1 ? '' : 's'}`
              : `Authorize restore of ${transferable.length} file${transferable.length === 1 ? '' : 's'}`}
      </button>
    </section>
  );
}

function isMediaFileSelectable(
  file: GitHubMediaTransferPreview['files'][number],
  direction: MediaDirection,
) {
  return file.status === 'ready' ||
    file.status === 'already_current' ||
    (direction === 'to_repository' && file.status === 'remote_conflict');
}

function initialMediaSelection(preview: GitHubMediaTransferPreview) {
  const selected = new Set<string>();
  let selectedBytes = 0;
  for (const file of preview.files) {
    // Conflicting copies require a deliberate per-file selection and replacement authorization.
    if (file.status !== 'ready' && file.status !== 'already_current') continue;
    if (selected.size >= preview.maxFiles || selectedBytes + file.size > preview.maxTransferBytes) continue;
    selected.add(file.assetId);
    selectedBytes += file.size;
  }
  return selected;
}

function mediaStatusLabel(status: string, direction: MediaDirection) {
  if (status === 'ready') return direction === 'to_repository' ? 'Ready to back up' : 'Ready to restore';
  return status.replaceAll('_', ' ');
}

const formatBytes = (bytes: number) => bytes >= 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;
