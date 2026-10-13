import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Repository from './repository';

const mocks = vi.hoisted(() => ({
  applyMediaTransfer: vi.fn(),
  previewMediaTransfer: vi.fn(),
  restoreHistory: null as null | Record<string, unknown>,
  toast: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
  pressState: null as null | Record<string, unknown>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/press', () => ({
  usePress: () => mocks.pressState,
  downloadJson: vi.fn(),
  errMsg: (error: { data?: { error?: string }; message?: string }) =>
    error?.data?.error || error?.message || 'Request failed',
  errStatus: (error: { status?: number }) => error?.status,
}));

vi.mock('@workspace/api-client-react', () => ({
  useGetGitHubConnectionStatus: () => ({
    data: { connected: true, account: { name: 'Test editor', login: 'editor' } },
    isLoading: false,
  }),
  useListGitHubRepositories: () => ({
    data: {
      repositories: [{
        id: 22,
        owner: 'press',
        name: 'issue-files',
        fullName: 'press/issue-files',
        defaultBranch: 'main',
        private: true,
        pushAccess: true,
      }],
      page: 1,
      hasNextPage: false,
    },
    isLoading: false,
    isFetching: false,
  }),
  usePreviewGitHubPull: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApplyGitHubPull: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewGitHubPush: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApplyGitHubPush: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewGitHubPageOneSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApplyGitHubPageOneSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewGitHubMediaTransfer: () => ({
    mutateAsync: mocks.previewMediaTransfer,
    isPending: false,
  }),
  useApplyGitHubMediaTransfer: () => ({
    mutateAsync: mocks.applyMediaTransfer,
    isPending: false,
  }),
  useListGitHubMediaRestores: () => mocks.restoreHistory,
  useImportIssue: () => ({ mutateAsync: vi.fn(), isPending: false }),
  getGetGitHubConnectionStatusQueryKey: () => ['github-connection'],
  getListGitHubRepositoriesQueryKey: (page: number) => ['github-repositories', page],
  getListGitHubMediaRestoresQueryKey: () => ['github-media-restores'],
  getGetIssueQueryKey: () => ['issue'],
  getGetReadinessQueryKey: () => ['readiness'],
  getListVersionsQueryKey: () => ['versions'],
  exportIssue: vi.fn(),
}));

const mediaPreview = {
  direction: 'from_repository',
  owner: 'press',
  repo: 'issue-files',
  branch: 'main',
  issuePath: 'issue.json',
  mediaDirectory: 'issue.media',
  localRevision: 4,
  headSha: '1234567890abcdef',
  pushAccess: true,
  repositoryPrivate: true,
  maxFileBytes: 100_000,
  maxFiles: 1,
  maxTransferBytes: 100_000,
  blockers: [],
  files: [
    {
      assetId: 'cover-art',
      assetName: 'Cover art',
      path: 'issue.media/cover.png',
      contentType: 'image/png',
      size: 120,
      localSize: null,
      remoteSize: 120,
      status: 'ready',
      localSha256: null,
      remoteSha256: 'remote-cover-hash',
      remoteBlobSha: 'remote-cover-blob',
      message: null,
    },
    {
      assetId: 'alternate-art',
      assetName: 'Alternate cover',
      path: 'issue.media/alternate.png',
      contentType: 'image/png',
      size: 80,
      localSize: null,
      remoteSize: 80,
      status: 'ready',
      localSha256: null,
      remoteSha256: 'remote-alternate-hash',
      remoteBlobSha: 'remote-alternate-blob',
      message: null,
    },
  ],
};

describe('Repository media restore recovery', () => {
  beforeEach(() => {
    mocks.queryClient.invalidateQueries.mockClear();
    mocks.restoreHistory = {
      data: {
        restores: [{
          id: 12,
          at: '2026-10-09T12:34:00.000Z',
          owner: 'press',
          repo: 'issue-files',
          branch: 'release',
          issuePath: 'issues/october.json',
          assetId: 'cover-art',
          fileName: 'Cover art',
          filePath: 'issues/october.media/cover.png',
          actorDisplayName: 'Media Editor',
          outcome: 'failed',
          failureReason: 'GitHub returned HTTP 503 while delivering the selected file.',
        }],
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.pressState = {
      issue: {
        schemaVersion: 1,
        number: 1,
        name: 'Test issue',
        revision: 4,
        motto: '',
        attribution: '',
        advertisers: [],
        githubSync: 'inactive',
        pages: Array.from({ length: 10 }, (_, index) => ({
          number: index + 1,
          title: `Page ${index + 1}`,
          section: '',
          copy: '',
        })),
        assets: [],
        puzzles: [],
        checklist: [],
        proofs: [],
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      readiness: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      canWrite: true,
      auth: { user: { id: 'editor-account' }, login: vi.fn() },
    };
    mocks.previewMediaTransfer.mockResolvedValue(mediaPreview);
    mocks.applyMediaTransfer.mockRejectedValue({
      status: 422,
      data: {
        code: 'GITHUB_MEDIA_TYPE_MISMATCH',
        error: 'Cannot restore “Cover art”: downloaded GitHub bytes do not match the asset’s declared type (image/png). Nothing was written.',
      },
    });
  });

  afterEach(() => cleanup());

  it('shows persistent restore history and supports refreshing it', () => {
    render(<Repository />);

    const record = screen.getByTestId('media-restore-history-record-12');
    expect(record.textContent).toContain('press/issue-files');
    expect(record.textContent).toContain('release');
    expect(record.textContent).toContain('issues/october.media/cover.png');
    expect(record.textContent).toContain('Failed');
    expect(record.textContent).toContain('Restored by: Media Editor');
    expect(record.textContent).toContain('GitHub returned HTTP 503');
    expect(record.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-09T12:34:00.000Z');

    fireEvent.click(screen.getByTestId('button-refresh-media-restore-history'));
    expect((mocks.restoreHistory as { refetch: ReturnType<typeof vi.fn> }).refetch).toHaveBeenCalledOnce();
  });

  it('keeps the media preview editable after GitHub rejects a mismatched file type', async () => {
    render(<Repository />);

    fireEvent.click(screen.getByTestId('button-select-repository-22'));
    fireEvent.change(screen.getByTestId('input-github-path'), {
      target: { value: 'issue.json' },
    });
    fireEvent.click(screen.getByTestId('button-preview-media-restore'));

    const coverCheckbox = await screen.findByRole('checkbox', { name: 'Select Cover art' });
    const alternateCheckbox = screen.getByRole('checkbox', { name: 'Select Alternate cover' });
    expect((coverCheckbox as HTMLInputElement).checked).toBe(true);
    expect((alternateCheckbox as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByTestId('checkbox-authorize-media-transfer'));
    fireEvent.click(screen.getByTestId('button-confirm-media-transfer'));

    const mismatchAlert = await screen.findByTestId('media-transfer-apply-error');
    expect(mismatchAlert.textContent).toContain('GitHub file type mismatch');
    expect(mismatchAlert.textContent).toContain('do not match the asset’s declared type (image/png)');
    expect(mismatchAlert.textContent).toContain('Nothing was written.');
    expect(mismatchAlert.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('panel-media-transfer-preview')).not.toBeNull();
    expect(screen.getByText('Preview only')).not.toBeNull();
    expect(screen.queryByText('Stale preview')).toBeNull();
    expect(screen.queryByText(/selected repository, branch, JSON path, or local issue revision changed/i)).toBeNull();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({
      title: 'Stale repository preview',
    }));

    await waitFor(() => {
      expect(mocks.applyMediaTransfer).toHaveBeenCalledWith({
        data: expect.objectContaining({ selectedAssetIds: ['cover-art'] }),
      });
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Restore stopped: GitHub file type mismatch',
        variant: 'destructive',
      }));
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['github-media-restores', 'editor-account'],
      });
    });

    fireEvent.click(coverCheckbox);
    expect((coverCheckbox as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('panel-media-transfer-preview')).not.toBeNull();

    fireEvent.click(alternateCheckbox);
    expect((alternateCheckbox as HTMLInputElement).checked).toBe(true);
    expect((coverCheckbox as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('panel-media-transfer-preview')).not.toBeNull();
    expect((screen.getByTestId('checkbox-authorize-media-transfer') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('button-confirm-media-transfer') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the safe GitHub rate-limit wait interval while keeping the preview available', async () => {
    mocks.applyMediaTransfer.mockRejectedValueOnce({
      status: 429,
      data: {
        code: 'GITHUB_MEDIA_RATE_LIMITED',
        retryAfterSeconds: 125,
        error: 'Cannot restore “Cover art”: GitHub is temporarily limiting media downloads. Nothing was written.',
      },
    });
    render(<Repository />);

    fireEvent.click(screen.getByTestId('button-select-repository-22'));
    fireEvent.change(screen.getByTestId('input-github-path'), {
      target: { value: 'issue.json' },
    });
    fireEvent.click(screen.getByTestId('button-preview-media-restore'));
    await screen.findByRole('checkbox', { name: 'Select Cover art' });

    fireEvent.click(screen.getByTestId('checkbox-authorize-media-transfer'));
    fireEvent.click(screen.getByTestId('button-confirm-media-transfer'));

    const rateLimitAlert = await screen.findByTestId('media-transfer-apply-error');
    expect(rateLimitAlert.textContent).toContain('GitHub is limiting downloads');
    expect(rateLimitAlert.textContent).toContain('Wait at least 2 minutes and 5 seconds');
    expect(rateLimitAlert.textContent).toContain('Nothing was written.');
    expect(rateLimitAlert.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('panel-media-transfer-preview')).not.toBeNull();
    expect(screen.getByText('Preview only')).not.toBeNull();
    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Restore paused: GitHub is limiting downloads',
        variant: 'destructive',
      }));
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['github-media-restores', 'editor-account'],
      });
    });
  });
});
