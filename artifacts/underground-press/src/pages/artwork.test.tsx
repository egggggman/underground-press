import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ArtDirection, Asset, Issue } from '@workspace/api-client-react';
import Artwork from './artwork';

const mocks = vi.hoisted(() => ({ pressState: null as null | Record<string, unknown> }));

vi.mock('@/lib/press', () => ({ usePress: () => mocks.pressState }));
vi.mock('@/components/asset-style-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/asset-style-review')>();
  return { ...actual, StyleReviewDialog: () => null };
});
vi.mock('@/components/bits', () => ({
  Head: ({ title }: { title: string }) => <h1>{title}</h1>,
  Loading: () => <p>Loading</p>,
  ErrorState: () => <p>Error</p>,
  Tag: ({ children }: { children: unknown }) => <span>{children as string}</span>,
  statusKind: () => 'ok',
  Empty: ({ title, body }: { title: string; body: string }) => <p>{title}: {body}</p>,
  ApprovalDialog: () => null,
  WriteNote: () => null,
}));

afterEach(cleanup);

const styleReview = (referenceIds: string[], decision: 'passed' | 'failed' = 'passed') => ({
  decision,
  checks: {},
  reviewer: 'TEST reviewer',
  reviewerAccountId: 'TEST account',
  notes: 'TEST style review notes',
  at: '2026-01-01T00:00:00.000Z',
  referenceIds,
});
const asset = (id: string, referenceIds?: string[], decision: 'passed' | 'failed' = 'passed') => ({
  id,
  name: `TEST asset ${id}`,
  caption: 'TEST caption',
  contentType: 'application/pdf',
  objectPath: '',
  provenance: 'uploaded_unverified',
  dpi: 0,
  pages: [],
  review: 'pending',
  reviewer: '',
  reviewNotes: '',
  ...(referenceIds ? { styleReview: styleReview(referenceIds, decision) } : {}),
}) as unknown as Asset;
const makeIssue = (referenceIds: string[]): Issue => ({
  id: 'TEST issue',
  revision: 1,
  assets: [
    asset('current', ['golden-image', 'front-page']),
    asset('stale', ['old-golden-image', referenceIds[1]]),
    asset('unreviewed'),
    asset('current-failed', ['golden-image', 'front-page'], 'failed'),
    asset('stale-failed', ['old-golden-image', referenceIds[1]], 'failed'),
  ],
  artDirection: { references: referenceIds.map((id) => ({ id })), history: [] } as unknown as ArtDirection,
} as unknown as Issue);

beforeEach(() => {
  mocks.pressState = {
    issue: makeIssue(['golden-image', 'front-page']),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    run: vi.fn(),
    pending: false,
    canWrite: true,
    auth: { login: vi.fn(), user: { id: 'TEST account' } },
  };
});

it('filters by freshness and decision while keeping live counts and full asset actions', () => {
  const view = render(<Artwork />);

  expect(screen.getByTestId('button-style-filter-all').textContent).toBe('All assets (5)');
  expect(screen.getByTestId('button-style-filter-current').textContent).toBe('Current (2)');
  expect(screen.getByTestId('button-style-filter-stale').textContent).toBe('Stale (2)');
  expect(screen.getByTestId('button-style-filter-unreviewed').textContent).toBe('Unreviewed (1)');
  expect(screen.getByTestId('button-style-decision-filter-all').textContent).toBe('All decisions (5)');
  expect(screen.getByTestId('button-style-decision-filter-passed').textContent).toBe('Passed (2)');
  expect(screen.getByTestId('button-style-decision-filter-failed').textContent).toBe('Failed (2)');

  fireEvent.click(screen.getByTestId('button-style-filter-current'));
  expect(screen.getByTestId('card-art-current')).toBeTruthy();
  expect(screen.getByTestId('card-art-current-failed')).toBeTruthy();
  expect(screen.queryByTestId('card-art-stale')).toBeNull();
  expect(screen.queryByTestId('card-art-unreviewed')).toBeNull();
  expect(screen.getByTestId('button-style-decision-filter-all').textContent).toBe('All decisions (2)');
  expect(screen.getByTestId('button-style-decision-filter-passed').textContent).toBe('Passed (1)');
  expect(screen.getByTestId('button-style-decision-filter-failed').textContent).toBe('Failed (1)');

  fireEvent.click(screen.getByTestId('button-style-decision-filter-failed'));
  expect(screen.queryByTestId('card-art-current')).toBeNull();
  expect(screen.getByTestId('card-art-current-failed')).toBeTruthy();
  expect(screen.getByTestId('button-style-decision-filter-failed').getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(screen.getByTestId('button-style-filter-stale'));
  expect(screen.queryByTestId('card-art-stale')).toBeNull();
  expect(screen.getByTestId('card-art-stale-failed')).toBeTruthy();
  expect(screen.queryByTestId('card-art-current')).toBeNull();
  expect(screen.queryByTestId('card-art-unreviewed')).toBeNull();
  expect(screen.getByTestId('button-style-decision-filter-all').textContent).toBe('All decisions (2)');
  expect(screen.getByTestId('button-style-decision-filter-passed').textContent).toBe('Passed (1)');
  expect(screen.getByTestId('button-style-decision-filter-failed').textContent).toBe('Failed (1)');
  fireEvent.click(screen.getByTestId('button-style-decision-filter-passed'));
  expect(screen.getByTestId('card-art-stale')).toBeTruthy();
  expect(screen.queryByTestId('card-art-stale-failed')).toBeNull();
  expect(screen.getByText(/Style review by TEST reviewer.*TEST style review notes/)).toBeTruthy();
  expect(screen.getByTestId('button-review-stale-style-stale')).toBeTruthy();
  expect(screen.getByTestId('button-approve-art-stale')).toBeTruthy();
  expect(screen.getByTestId('button-reject-art-stale')).toBeTruthy();

  mocks.pressState = {
    ...mocks.pressState,
    issue: makeIssue(['replacement-golden-image', 'front-page']),
  };
  view.rerender(<Artwork />);
  expect(screen.getByTestId('button-style-filter-current').textContent).toBe('Current (0)');
  expect(screen.getByTestId('button-style-filter-stale').textContent).toBe('Stale (4)');
  expect(screen.getByTestId('card-art-current')).toBeTruthy();
  expect(screen.getByTestId('card-art-stale')).toBeTruthy();
  expect(screen.getByTestId('button-style-decision-filter-passed').textContent).toBe('Passed (2)');
  expect(screen.getByTestId('button-style-decision-filter-failed').textContent).toBe('Failed (2)');
  expect(screen.getByTestId('text-artwork-filter-results').textContent).toBe('Showing 2 of 5 assets');

  fireEvent.click(screen.getByTestId('button-style-filter-unreviewed'));
  fireEvent.click(screen.getByTestId('button-style-decision-filter-all'));
  expect(screen.getByTestId('card-art-unreviewed')).toBeTruthy();
  expect(screen.queryByTestId('card-art-current')).toBeNull();
  expect(screen.queryByTestId('card-art-stale')).toBeNull();
  expect(screen.getByTestId('button-style-decision-filter-all').textContent).toBe('All decisions (1)');
  expect(screen.getByTestId('button-style-decision-filter-failed').textContent).toBe('Failed (0)');
  fireEvent.click(screen.getByTestId('button-style-decision-filter-failed'));
  expect(screen.queryByTestId('card-art-unreviewed')).toBeNull();
  expect(screen.getByTestId('text-artwork-filter-results').textContent).toBe('Showing 0 of 5 assets');
});

it('shows recorded dates separately from assets with no style review', () => {
  render(<Artwork />);

  expect(screen.getByTestId('text-style-review-date-current').textContent).toBe('Style review recorded Jan 1, 2026, 12:00 AM UTC');
  expect(screen.getByTestId('text-style-review-date-unreviewed').textContent).toBe('No style review recorded');
});

it('sorts by review date without clearing the selected status filter', () => {
  const older = asset('stale-older', ['old-golden-image', 'front-page']);
  older.styleReview!.at = '2025-01-01T00:00:00.000Z';
  const newer = asset('stale-newer', ['old-golden-image', 'front-page']);
  newer.styleReview!.at = '2026-06-01T00:00:00.000Z';
  mocks.pressState = {
    ...mocks.pressState,
    issue: {
      ...makeIssue(['golden-image', 'front-page']),
      assets: [newer, asset('unreviewed'), older],
    },
  };
  render(<Artwork />);

  fireEvent.click(screen.getByTestId('button-style-filter-stale'));
  const sort = screen.getByTestId('select-artwork-style-sort');
  fireEvent.change(sort, { target: { value: 'newest' } });

  const visibleIds = screen.getAllByTestId(/^card-art-/).map((card) => card.getAttribute('data-testid'));
  expect(visibleIds).toEqual(['card-art-stale-newer', 'card-art-stale-older']);
  expect(screen.queryByTestId('card-art-unreviewed')).toBeNull();

  fireEvent.change(sort, { target: { value: 'oldest' } });
  const oldestFirstIds = screen.getAllByTestId(/^card-art-/).map((card) => card.getAttribute('data-testid'));
  expect(oldestFirstIds).toEqual(['card-art-stale-older', 'card-art-stale-newer']);
  expect(screen.getByTestId('button-style-filter-stale').getAttribute('aria-pressed')).toBe('true');
});
