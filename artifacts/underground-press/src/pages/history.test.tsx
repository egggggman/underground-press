import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import History from './history';

const mocks = vi.hoisted(() => ({
  issue: null as null | Record<string, unknown>,
  run: vi.fn(),
}));

vi.mock('@workspace/replit-auth-web', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('@workspace/api-client-react', () => ({
  useListVersions: () => ({ data: [], isLoading: false, error: null }),
  getListVersionsQueryKey: () => ['versions'],
  useGetVersion: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
  getGetVersionQueryKey: (id: number) => ['version', id],
  useGetIssue: () => ({ data: mocks.issue, isLoading: false, error: null }),
  getGetIssueQueryKey: () => ['issue'],
}));

vi.mock('@/lib/press', () => ({
  usePress: () => ({
    auth: { roles: ['myrtle_editor'], login: vi.fn() },
    canWrite: true,
    run: mocks.run,
    pending: false,
  }),
  downloadJson: vi.fn(),
  fmt: (value: string) => value,
}));

const oldReference = {
  id: 'original-reference',
  version: 2,
  kind: 'front_page',
  title: 'Original cover reference',
  assetId: 'original-cover',
  url: '',
  sourceIdentity: 'Archive ledger, page 1',
  assetSnapshot: { id: 'original-cover', name: 'Original cover scan', objectPath: '/objects/original-cover' },
};

const currentReference = {
  id: 'current-reference',
  version: 3,
  kind: 'front_page',
  title: 'Current cover reference',
  assetId: '',
  url: 'https://example.org/current-cover',
  sourceIdentity: 'Updated archive record',
  approval: { reviewerRole: 'myrtle_editor', reviewerAccountId: 'editor-1', notes: 'Confirmed the original.' },
};

beforeEach(() => {
  mocks.run.mockReset();
  mocks.issue = {
    revision: 14,
    pages: [{
      number: 1,
      title: 'Locked cover',
      copy: 'Preserved Page 1 source text.',
      locked: true,
      provenance: 'repository_reference',
      sourceIdentity: 'press/issue:issue.json@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }],
    artDirection: {
      references: [currentReference],
      history: [oldReference],
    },
    pageOneApprovalHistory: [{
      id: 'review-1',
      issueRevision: 9,
      at: '2026-01-01T00:00:00.000Z',
      decision: 'verified',
      reviewer: 'Myrtle Editor',
      reviewerAccountId: 'editor-1',
      reviewerRole: 'myrtle_editor',
      approvalDocumentIdentity: 'Archive volume 1, entry 7',
      notes: 'Compared the original cover title to the dated approval entry.',
      sourceIdentity: 'press/issue:issue.json@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sourceFingerprint: 'old-cover-fingerprint',
      referenceId: oldReference.id,
      referenceVersion: oldReference.version,
      referenceSourceIdentity: oldReference.sourceIdentity,
      referenceFingerprint: 'old-reference-fingerprint',
      isCurrent: false,
      staleReasons: ['source_content_changed', 'reference_version_changed', 'reference_image_changed'],
    }],
    pageSnapshots: [],
  };
});

afterEach(cleanup);

describe('Page 1 document review history', () => {
  it('warns when the confirmed reference image is unavailable and blocks a new review', () => {
    const issue = structuredClone(mocks.issue!);
    const artDirection = issue.artDirection as { references: Array<Record<string, unknown>>; history: unknown[] };
    artDirection.references[0].imageAvailable = false;
    mocks.issue = issue;

    render(<History />);

    expect(screen.getByTestId('notice-page-one-reference-image-unavailable').textContent)
      .toMatch(/exact confirmed reference image is unavailable/i);
    expect(screen.getByText('Exact reference image unavailable')).toBeTruthy();
    expect(screen.getByTestId('button-begin-page-one-document-review').hasAttribute('disabled')).toBe(true);
  });

  it('explains stale source and image bindings and links to current records without editing the review', () => {
    render(<History />);

    const detail = screen.getByTestId('notice-page-one-review-stale-review-1');
    const text = detail.textContent || '';
    expect(text).toMatch(/Page 1 content or a source-bound Page 1 asset changed/i);
    expect(text).toMatch(/reference is a different record or version/i);
    expect(text).toMatch(/registered reference image binding/i);
    expect(text).toContain('Current cover reference · current-reference / v3');
    expect(screen.getByRole('link', { name: /current Page 1 source in Repository/i }).getAttribute('href')).toBe('/repository');
    expect(screen.getByRole('link', { name: /current front-page reference in Style Guide/i }).getAttribute('href')).toBe('/style-guide');
    expect(text).toMatch(/historical review and locked Page 1 remain unchanged/i);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
