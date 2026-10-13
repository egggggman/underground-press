import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtReference, Issue } from '@workspace/api-client-react';
import StyleGuide from './style-guide';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  queryClient: {
    getQueryData: vi.fn(),
  },
  pressState: null as null | Record<string, unknown>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/press', () => ({
  usePress: () => mocks.pressState,
  errMsg: (error: { message?: string }) => error?.message || 'Request failed',
  fmt: (date?: string) => date ?? '-',
  downloadJson: vi.fn(),
}));

vi.mock('@workspace/api-client-react', () => ({
  getGetIssueQueryKey: () => ['issue'],
  useRequestUploadUrl: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/components/asset-style-review', () => ({
  PROVISIONAL: 'Provisional preview only',
  ensureCondensedFont: vi.fn(),
}));

vi.mock('@/components/bits', () => ({
  Head: ({ title, children }: { title: string; children?: React.ReactNode }) => <header><h1>{title}</h1>{children}</header>,
  Loading: () => <p>Loading</p>,
  ErrorState: () => <p>Error</p>,
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  WriteNote: () => null,
  ApprovalIdentity: () => null,
  ApprovalDialog: ({ open, onSubmit }: { open: boolean; onSubmit: (reviewer: string, notes: string) => void }) =>
    open ? <button data-testid="button-submit-reference-confirmation" onClick={() => onSubmit('', 'Inspected the exact proposed scan.')}>Explicitly confirm this image</button> : null,
}));

const makeReference = (overrides: Partial<ArtReference>): ArtReference => ({
  id: 'confirmed-front-page-v6',
  version: 6,
  kind: 'front_page',
  title: 'Confirmed original front page',
  assetId: 'confirmed-asset',
  url: '',
  sourceIdentity: 'Archive scan, box 2',
  at: '2026-10-09T10:00:00.000Z',
  suppliedBy: 'editor-account',
  registrationNotes: '',
  assetSnapshot: {
    id: 'confirmed-asset',
    name: 'confirmed-original.png',
    objectPath: '/objects/confirmed-original',
    contentType: 'image/png',
    size: 100,
    caption: 'Original',
    credit: 'Archive',
    source: 'Box 2',
    provenance: 'uploaded_unverified',
    pages: [],
    review: 'pending',
    reviewer: '',
    reviewNotes: '',
    dpi: 0,
  },
  approval: {
    reviewer: 'Myrtle Editor',
    reviewerRole: 'myrtle_editor',
    reviewerAccountId: 'editor-account',
    notes: 'Inspected the confirmed original.',
    at: '2026-10-09T10:00:00.000Z',
  },
  ...overrides,
});

describe('Style Guide Page 1 replacement comparison', () => {
  beforeEach(() => {
    const confirmed = makeReference({});
    const proposed = makeReference({
      id: 'proposed-front-page-v7',
      version: 7,
      title: 'Proposed replacement scan',
      assetId: 'proposed-asset',
      sourceIdentity: 'Archive scan, box 4',
      assetSnapshot: {
        ...confirmed.assetSnapshot!,
        id: 'proposed-asset',
        name: 'proposed-replacement.png',
        objectPath: '/objects/proposed-replacement',
      },
      approval: null,
    });
    mocks.run.mockReset();
    mocks.run.mockResolvedValue(true);
    mocks.pressState = {
      issue: {
        revision: 14,
        assets: [],
        artDirection: {
          references: [proposed],
          history: [confirmed, proposed],
        },
      } as unknown as Issue,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      run: mocks.run,
      pending: false,
      canWrite: true,
      auth: {
        roles: ['myrtle_editor'],
        user: { firstName: 'Myrtle', lastName: 'Editor', id: 'editor-account' },
        login: vi.fn(),
      },
    };
  });

  afterEach(() => cleanup());

  it('shows the latest confirmed image beside the exact pending replacement and only confirms after an explicit action', async () => {
    render(<StyleGuide />);

    const comparison = screen.getByTestId('page-one-image-comparison');
    const confirmedPane = within(screen.getByTestId('confirmed-front-page-image'));
    const proposedPane = within(screen.getByTestId('proposed-front-page-image'));
    expect(comparison.textContent).toContain('The proposed image remains unconfirmed');
    expect(confirmedPane.getByText(/Currently confirmed original/)).toBeTruthy();
    expect(proposedPane.getByText(/Proposed replacement — unconfirmed/)).toBeTruthy();
    expect(confirmedPane.getByRole('img').getAttribute('src')).toContain('/objects/confirmed-original');
    expect(proposedPane.getByRole('img').getAttribute('src')).toContain('/objects/proposed-replacement');
    expect(screen.getByTestId('button-confirm-front_page')).toBeTruthy();
    expect(mocks.run).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('button-confirm-front_page'));
    expect(mocks.run).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('button-submit-reference-confirmation'));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith(
      { action: 'confirm_art_reference', id: 'proposed-front-page-v7', notes: 'Inspected the exact proposed scan.', checked: true },
      'Reference confirmed',
      14,
    ));
  });

  it('does not show the private comparison to users without the Myrtle editor role', () => {
    mocks.pressState = {
      ...mocks.pressState!,
      auth: {
        roles: [],
        user: { firstName: 'Reader', id: 'reader-account' },
        login: vi.fn(),
      },
    };

    render(<StyleGuide />);

    expect(screen.queryByTestId('page-one-image-comparison')).toBeNull();
  });

  it('requires a new image before a legacy Page 1 reference without bytes can be confirmed', () => {
    const unavailable = makeReference({
      id: 'unavailable-legacy-reference',
      assetId: '',
      assetSnapshot: undefined,
      approval: null,
    });
    const issue = structuredClone(mocks.pressState!.issue as Issue);
    issue.assets = [{
      id: 'mutable-legacy-asset',
      name: 'Legacy mutable upload',
      objectPath: '/objects/uploads/users/legacy/upload-id',
    } as Issue['assets'][number]];
    mocks.pressState = {
      ...mocks.pressState!,
      issue: { ...issue, artDirection: { references: [unavailable], history: [unavailable] } } as Issue,
    };

    render(<StyleGuide />);

    expect(screen.getByTestId('notice-reference-image-missing-front_page').textContent).toMatch(/Supply a fresh reference/);
    expect((screen.getByTestId('button-confirm-front_page') as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByLabelText('Existing asset')).queryByRole('option', { name: 'Legacy mutable upload' })).toBeNull();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
