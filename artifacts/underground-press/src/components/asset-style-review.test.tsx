import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { Asset, ArtDirection, ArtReference, Issue } from '@workspace/api-client-react';
import { formatStyleReviewDate, styleStatus, bothConfirmed, StyleBadge, StyleReviewDialog } from './asset-style-review';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  toast: vi.fn(),
  pressState: null as null | Record<string, unknown>,
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/press', () => ({ usePress: () => mocks.pressState }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const ap = { reviewer: 'Myrtle', at: 'x', notes: 'n', reviewerRole: 'myrtle_editor' as const, reviewerAccountId: 'test-myrtle' };
const ref = (id: string, kind: ArtReference['kind'], ok: boolean): ArtReference => ({ id, version: 1, kind, title: id, assetId: '', url: '', sourceIdentity: 's', at: '', suppliedBy: '', approval: ok ? ap : null });
type ArtReferenceWithAvailability = ArtReference & { imageAvailable?: boolean };
const checks = { referenceMatch: true, spotInks: true, typography: true, inkIllustration: true, halftoneRegistration: true, boxedComposition: true, legibilityPrint: true, provenancePreserved: true };
const asset = (ids: string[], d: 'passed' | 'failed'): Asset => ({ id: 'a', styleReview: { decision: d, checks, reviewer: 'r', reviewerAccountId: 'u', notes: 'Human comparison evidence — test only', at: '', referenceIds: ids } } as Asset);
const ad = (ok: boolean): ArtDirection => ({ references: [ref('g', 'golden_image', ok), ref('f', 'front_page', ok)], history: [] });
const badgeText = (reviewedIds: string[], direction: ArtDirection | undefined) => {
  const view = render(<StyleBadge asset={asset(reviewedIds, 'passed')} issue={{ id: 'issue', artDirection: direction } as unknown as Issue} />);
  return view.getByTestId('badge-style-a').textContent;
};
const reviewAsset = {
  ...asset(['g', 'f'], 'failed'),
  name: 'Test artwork',
  contentType: 'image/png',
  objectPath: '/objects/test-artwork',
} as Asset;
const reviewIssue = (revision: number, references: ArtReference[]): Issue => ({
  id: 'issue',
  revision,
  artDirection: { references, history: [] },
} as unknown as Issue);
const makeReference = (id: string, title: string, version: number, kind: ArtReference['kind']): ArtReference => ({
  id, title, version, kind, assetId: '', url: `https://example.org/${id}`, sourceIdentity: `Archive/${id}`,
  at: '', suppliedBy: 'test-editor', approval: null,
});

beforeEach(() => {
  mocks.run.mockReset().mockResolvedValue(true);
  mocks.toast.mockReset();
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
  mocks.pressState = {
    run: mocks.run,
    pending: false,
    auth: { user: { id: 'test-account' } },
    canWrite: true,
  };
});

describe('style state', () => {
  it('formats valid style-review timestamps and rejects missing or invalid dates', () => {
    expect(formatStyleReviewDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026, 12:00 AM UTC');
    expect(formatStyleReviewDate('')).toBeNull();
    expect(formatStyleReviewDate('not-a-date')).toBeNull();
  });

  it('typed Myrtle names alone cannot confirm references', () => {
    const direction = ad(true);
    direction.references[0].approval = { reviewer: 'Myrtle', at: 'x', notes: 'Typed name only' };
    expect(bothConfirmed(direction)).toBe(false);
    expect(styleStatus(asset(['g', 'f'], 'passed'), direction).kind).toBe('warn');
  });
  it('an incomplete checklist cannot display a successful style pass', () => {
    const reviewed = asset(['g', 'f'], 'passed');
    reviewed.styleReview!.checks = { ...checks, legibilityPrint: false };
    expect(styleStatus(reviewed, ad(true)).kind).toBe('warn');
  });
  it('missing references are never confirmed', () => { expect(bothConfirmed(undefined)).toBe(false); expect(bothConfirmed({ references: [], history: [] })).toBe(false); });
  it('unreviewed asset', () => expect(styleStatus({ id: 'a' } as Asset, ad(true)).label).toMatch(/unreviewed/));
  it('names the Golden Image when its historical identity is known', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    expect(badgeText(['g-old', 'f'], direction)).toBe('Style: passed (stale evidence, Golden Image changed)');
  });
  it('names the front-page benchmark when it changed', () => {
    const direction = ad(true);
    direction.history.push(ref('f-old', 'front_page', false));
    expect(badgeText(['g', 'f-old'], direction)).toBe('Style: passed (stale evidence, front-page benchmark changed)');
  });
  it('names both references when both changed', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false), ref('f-old', 'front_page', false));
    expect(badgeText(['g-old', 'f-old'], direction)).toBe('Style: passed (stale evidence, Golden Image and front-page benchmark changed)');
  });
  it('uses a general explanation when history cannot identify the changed reference', () => {
    expect(badgeText(['g', 'old'], ad(true))).toBe('Style: passed (stale evidence, references changed; specific reference cannot be identified)');
    expect(styleStatus(asset(['g', 'old'], 'passed'), ad(true)).kind).toBe('warn');
  });
  it('offers a direct checklist action for stale evidence only to writers', () => {
    const staleAsset = asset(['g-old', 'f'], 'passed');
    const issue = { id: 'issue', artDirection: ad(true) } as unknown as Issue;
    const onReview = vi.fn();
    const writerView = render(<StyleBadge asset={staleAsset} issue={issue} canReview onReview={onReview} />);
    fireEvent.click(writerView.getByTestId('button-review-stale-style-a'));
    expect(onReview).toHaveBeenCalledOnce();
    writerView.unmount();

    const readOnlyView = render(<StyleBadge asset={staleAsset} issue={issue} onReview={onReview} />);
    expect(readOnlyView.queryByTestId('button-review-stale-style-a')).toBeNull();
  });
  it('does not add a checklist action to current evidence', () => {
    const onReview = vi.fn();
    const view = render(<StyleBadge asset={asset(['g', 'f'], 'passed')} issue={{ id: 'issue', artDirection: ad(true) } as unknown as Issue} canReview onReview={onReview} />);
    expect(view.queryByTestId('button-review-stale-style-a')).toBeNull();
  });
  it('shows the saved artwork beside the current changed reference', () => {
    const direction = ad(true);
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Historical Golden Image',
      assetSnapshot: { name: 'old-golden.png', objectPath: '/private/old-golden.png', contentType: 'image/png' } as Asset,
    });
    direction.references[0] = {
      ...ref('g-new', 'golden_image', true),
      title: 'Current Golden Image',
      assetSnapshot: { name: 'golden.png', objectPath: '/private/golden.png', contentType: 'image/png' } as Asset,
      imageAvailable: true,
    } as ArtReferenceWithAvailability;
    const reviewed = {
      ...asset(['g-old', 'f'], 'passed'),
      name: 'Saved cover.png',
      objectPath: '/private/saved-cover.png',
      contentType: 'image/png',
    } as Asset;
    const view = render(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('img-comparison-saved-artwork-a').getAttribute('src')).toContain('/private/saved-cover.png');
    expect(view.getByTestId('img-comparison-historical-reference-golden_image').getAttribute('src')).toContain('/private/old-golden.png');
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toContain('/private/golden.png');
    expect(view.getByTestId('img-comparison-historical-reference-golden_image').getAttribute('referrerpolicy')).toBeNull();
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('referrerpolicy')).toBeNull();
    expect(view.getByText('Historical reference: Golden Image')).toBeTruthy();
    expect(view.getByText('Current reference: Golden Image')).toBeTruthy();
    expect(view.getByText(/Historical and current references are read-only previews/)).toBeTruthy();
    expect(view.getByText(/changed since this review/)).toBeTruthy();
    expect(view.queryByTestId('comparison-reference-front_page')).toBeNull();
  });
  it('calls out missing historical artwork without hiding the current reference', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = {
      ...direction.references[0],
      assetSnapshot: { name: 'current-golden.png', objectPath: '/private/current-golden.png', contentType: 'image/png' } as Asset,
      imageAvailable: true,
    } as ArtReferenceWithAvailability;
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('notice-historical-reference-unavailable-golden_image').textContent).toMatch(/No historical reference artwork is available/);
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toContain('/private/current-golden.png');
  });
  it('keeps the current reference visible when the saved predecessor record is missing', () => {
    const direction = ad(true);
    direction.references[0] = {
      ...direction.references[0],
      assetSnapshot: { name: 'current-golden.png', objectPath: '/private/current-golden.png', contentType: 'image/png' } as Asset,
      imageAvailable: true,
    } as ArtReferenceWithAvailability;
    const view = render(<StyleReviewDialog asset={asset(['g-missing', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('notice-historical-reference-missing-golden_image').textContent).toMatch(/historical Golden Image artwork is unavailable/);
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toContain('/private/current-golden.png');
  });
  it('waits for explicit approval before loading an external historical image', () => {
    const direction = ad(true);
    const sourceUrl = 'https://images.example.test/archive/old-cover.webp?edition=4';
    direction.history.push({ ...ref('g-old', 'golden_image', false), url: sourceUrl });
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    expect(view.queryByTestId('img-comparison-historical-reference-golden_image')).toBeNull();
    expect(view.getByTestId('notice-historical-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-historical-reference-golden_image').getAttribute('src')).toBe(sourceUrl);
    expect(view.getByTestId('img-comparison-historical-reference-golden_image').getAttribute('referrerpolicy')).toBe('no-referrer');
  });
  it('clearly identifies a changed reference that is no longer registered', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references = [direction.references[1]];
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('notice-reference-missing-golden_image').textContent).toMatch(/No current Golden Image is registered/);
  });
  it('shows both references when history cannot identify which one changed', () => {
    const view = render(<StyleReviewDialog asset={asset(['g', 'unknown'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: ad(true) } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('notice-reference-change-unknown').textContent).toMatch(/does not identify which reference changed/);
    expect(view.getByTestId('comparison-reference-golden_image')).toBeTruthy();
    expect(view.getByTestId('comparison-reference-front_page')).toBeTruthy();
  });
  it('shows a clear unavailable state when current reference storage is unavailable', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = { ...direction.references[0], imageAvailable: false } as ArtReferenceWithAvailability;
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('notice-reference-unavailable-golden_image').textContent).toMatch(/unavailable from protected storage/);
  });
  it('waits for explicit approval before loading direct image URLs and lets editors cancel', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://images.example.test/archive/cover.webp?edition=4';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const reviewed = {
      ...asset(['g-old', 'f'], 'failed'),
      name: 'Saved cover.png',
      objectPath: '/private/saved-cover.png',
      contentType: 'image/png',
    } as Asset;
    const view = render(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('img-comparison-saved-artwork-a')).toBeTruthy();
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(view.getByTestId('notice-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    expect(view.getByText('Open image source').getAttribute('href')).toBe(sourceUrl);
    expect(view.queryByTestId('notice-reference-external-golden_image')).toBeNull();

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(sourceUrl);
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('referrerpolicy')).toBe('no-referrer');
    const loadingStatus = view.getByTestId('img-comparison-reference-golden_image-loading');
    expect(loadingStatus.getAttribute('role')).toBe('status');
    expect(loadingStatus.textContent).toMatch(/loading external image preview/i);
    expect(direction.references[0].url).toBe(sourceUrl);

    fireEvent.click(view.getByTestId('button-hide-reference-preview-golden_image'));
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(view.queryByTestId('img-comparison-reference-golden_image-loading')).toBeNull();
    expect(view.getByText('Open image source').getAttribute('href')).toBe(sourceUrl);
    expect(direction.references[0].url).toBe(sourceUrl);
  });
  it.each([
    ['loaded', false],
    ['failed', true],
  ])('politely announces when a %s Page 1 preview is hidden without repeating on other preview updates', (_state, failPreview) => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false), ref('f-old', 'front_page', false));
    direction.references[0] = { ...direction.references[0], url: 'https://images.example.org/golden-image.png' };
    direction.references[1] = { ...direction.references[1], url: 'https://images.example.org/page-1.png' };
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f-old'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-reference-preview-front_page'));
    const pageOnePreview = view.getByTestId('img-comparison-reference-front_page');
    if (failPreview) fireEvent.error(pageOnePreview);
    else fireEvent.load(pageOnePreview);

    fireEvent.click(view.getByTestId('button-hide-reference-preview-front_page'));
    expect(view.queryByTestId('img-comparison-reference-front_page')).toBeNull();
    const announcement = view.getByTestId('notice-page-one-preview-hidden');
    expect(announcement.getAttribute('role')).toBe('status');
    expect(announcement.getAttribute('aria-live')).toBe('polite');
    expect(announcement.textContent?.trim()).toBe('Page 1 preview hidden.');

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('notice-page-one-preview-hidden')).toBe(announcement);
    expect(announcement.textContent?.trim()).toBe('Page 1 preview hidden.');
  });
  it.each([
    ['loaded', false],
    ['failed', true],
  ])('politely announces when a %s historical preview is hidden without announcing that Page 1 was hidden', (_state, failPreview) => {
    const direction = ad(true);
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Archived Golden Image',
      url: 'https://images.example.org/archive/golden-image.png',
    });
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    const historicalPreview = view.getByTestId('img-comparison-historical-reference-golden_image');
    if (failPreview) fireEvent.error(historicalPreview);
    else fireEvent.load(historicalPreview);

    fireEvent.click(view.getByTestId('button-hide-historical-reference-preview-golden_image'));
    expect(view.queryByTestId('img-comparison-historical-reference-golden_image')).toBeNull();

    const announcement = view.getByTestId('notice-historical-reference-preview-hidden');
    expect(announcement.getAttribute('role')).toBe('status');
    expect(announcement.getAttribute('aria-live')).toBe('polite');
    expect(announcement.textContent?.trim()).toBe('Historical Golden Image preview hidden.');
    expect(view.getByTestId('notice-page-one-preview-hidden').textContent?.trim()).toBe('');

    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    expect(announcement.textContent?.trim()).toBe('');
    fireEvent.click(view.getByTestId('button-hide-historical-reference-preview-golden_image'));
    expect(announcement.textContent?.trim()).toBe('Historical Golden Image preview hidden.');
  });
  it('identifies both current and historical previews while loading and clears only the completed or failed preview status', () => {
    const direction = ad(true);
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Archived Golden Image',
      url: 'https://images.example.test/archive/old-cover.webp',
    });
    direction.references[0] = {
      ...direction.references[0],
      title: 'Current Golden Image',
      version: 2,
      url: 'https://images.example.test/current/cover.webp',
    };
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));

    const historicalLoading = view.getAllByTestId('img-comparison-historical-reference-golden_image-loading')
      .find((status) => status.textContent?.includes('Loading external image preview'));
    expect(historicalLoading).toBeTruthy();
    const currentLoading = view.getByTestId('img-comparison-reference-golden_image-loading');
    expect(historicalLoading?.textContent).toMatch(/historical Golden Image reference “Archived Golden Image”, version 1/i);
    expect(currentLoading.textContent).toMatch(/current Golden Image reference “Current Golden Image”, version 2/i);
    expect(historicalLoading?.textContent).not.toBe(currentLoading.textContent);

    fireEvent.load(view.getByTestId('img-comparison-reference-golden_image'));
    expect(view.queryByTestId('img-comparison-reference-golden_image-loading')).toBeNull();
    expect(historicalLoading?.textContent).toMatch(/Archived Golden Image/);

    fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
    expect(view.getAllByTestId('img-comparison-historical-reference-golden_image-loading')
      .every((status) => !status.textContent)).toBe(true);
    expect(view.getByTestId('notice-historical-reference-unavailable-golden_image').textContent).toMatch(/external historical image preview is unavailable/i);
    expect(view.queryByTestId('img-comparison-reference-golden_image-loading')).toBeNull();
    expect(view.getByTestId('img-comparison-reference-golden_image')).toBeTruthy();
  });
  it('keeps concurrent archived image retry statuses tied to their own title and version', () => {
    const direction = ad(true);
    direction.history.push(
      {
        ...ref('g-old', 'golden_image', false),
        title: 'Archived Golden Image',
        version: 4,
        assetSnapshot: { name: 'Golden archive.png', objectPath: '/private/golden.png', contentType: 'image/png' } as Asset,
      },
      {
        ...ref('f-old', 'front_page', false),
        title: 'Archived Page 1',
        version: 7,
        assetSnapshot: { name: 'Page 1 archive.png', objectPath: '/private/page-one.png', contentType: 'image/png' } as Asset,
      },
    );
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f-old'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
    fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));

    const goldenLoading = view.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const pageOneLoading = view.getByTestId('img-comparison-historical-reference-front_page-loading');
    const goldenSuccess = view.getByTestId('notice-historical-reference-retry-success-golden_image');
    const pageOneSuccess = view.getByTestId('notice-historical-reference-retry-success-front_page');
    expect(goldenLoading.textContent).toBe('Loading historical Golden Image preview: Archived Golden Image, version 4.');
    expect(pageOneLoading.textContent).toBe('Loading historical front-page benchmark preview: Archived Page 1, version 7.');
    expect(goldenSuccess.textContent).toBe('');
    expect(pageOneSuccess.textContent).toBe('');

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-front_page'));
    expect(pageOneLoading.textContent).toBe('');
    expect(pageOneSuccess.textContent).toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1, version 7.');
    expect(goldenLoading.textContent).toBe('Loading historical Golden Image preview: Archived Golden Image, version 4.');
    expect(goldenSuccess.textContent).toBe('');

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-golden_image'));
    expect(goldenLoading.textContent).toBe('');
    expect(goldenSuccess.textContent).toBe('Historical Golden Image preview loaded successfully: Archived Golden Image, version 4.');
    expect(pageOneSuccess.textContent).toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1, version 7.');
  });
  it('announces a slow external preview while keeping the saved artwork and reference details available', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://images.example.test/archive/slow-cover.webp';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const reviewed = {
      ...asset(['g-old', 'f'], 'failed'),
      name: 'Saved cover.png',
      objectPath: '/private/saved-cover.png',
      contentType: 'image/png',
    } as Asset;
    const view = render(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    const image = view.getByTestId('img-comparison-reference-golden_image');
    expect(view.getByTestId('img-comparison-reference-golden_image-loading').getAttribute('role')).toBe('status');
    act(() => vi.advanceTimersByTime(8_000));

    const slowNotice = view.getByTestId('img-comparison-reference-golden_image-slow');
    expect(slowNotice.getAttribute('role')).toBe('status');
    expect(slowNotice.textContent).toMatch(/taking longer than expected/i);
    expect(view.getByTestId('img-comparison-saved-artwork-a')).toBeTruthy();
    expect(view.getByText(/g · v1/)).toBeTruthy();
    expect(view.getByTestId('button-hide-reference-preview-golden_image')).toBeTruthy();

    fireEvent.load(image);
    expect(view.queryByTestId('img-comparison-reference-golden_image-loading')).toBeNull();
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
  });
  it('starts a fresh slow-preview wait after hiding and loading the same reference again', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = {
      ...direction.references[0],
      url: 'https://images.example.test/archive/retried-cover.webp',
    };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    act(() => vi.advanceTimersByTime(6_000));
    fireEvent.click(view.getByTestId('button-hide-reference-preview-golden_image'));
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image')).toBeTruthy();

    act(() => vi.advanceTimersByTime(2_000));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    act(() => vi.advanceTimersByTime(5_999));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow')).toBeTruthy();
  });
  it.each([
    ['URL', (reference: ArtReference) => ({ ...reference, url: 'https://images.example.test/archive/replacement-cover.webp' })],
    ['version', (reference: ArtReference) => ({ ...reference, version: reference.version + 1 })],
  ])('starts the slow-preview wait over when the current reference changes by %s', (_change, replaceReference) => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = {
      ...direction.references[0],
      url: 'https://images.example.test/archive/original-cover.webp',
    };
    const reviewed = asset(['g-old', 'f'], 'failed');
    const view = render(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    act(() => vi.advanceTimersByTime(6_000));

    const replacement = replaceReference(direction.references[0]);
    const updatedDirection = {
      ...direction,
      references: direction.references.map((reference) =>
        reference.kind === 'golden_image' ? replacement : reference,
      ),
    };
    view.rerender(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 3, artDirection: updatedDirection } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    act(() => vi.advanceTimersByTime(2_000));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    expect(view.getByTestId('notice-reference-preview-pending-golden_image')).toBeTruthy();

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(replacement.url);
    act(() => vi.advanceTimersByTime(7_999));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow')).toBeTruthy();
  });
  it('does not show a late slow-preview alert after the external image loads quickly', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = {
      ...direction.references[0],
      url: 'https://images.example.test/archive/quick-cover.webp',
    };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    fireEvent.load(view.getByTestId('img-comparison-reference-golden_image'));
    act(() => vi.advanceTimersByTime(8_001));

    expect(view.getByTestId('img-comparison-reference-golden_image')).toBeTruthy();
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
  });
  it('cancels the pending slow alert when a preview is hidden and starts a fresh wait when loaded again', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://images.example.test/archive/hidden-cover.webp';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const timeoutCallsBeforePreview = setTimeoutSpy.mock.calls.length;
    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    const previewTimeoutIndex = setTimeoutSpy.mock.calls.findIndex(
      (call, index) => index >= timeoutCallsBeforePreview && call[1] === 8_000,
    );
    expect(previewTimeoutIndex).toBeGreaterThanOrEqual(0);
    const previewTimeoutId = setTimeoutSpy.mock.results[previewTimeoutIndex].value;

    act(() => vi.advanceTimersByTime(4_000));
    fireEvent.click(view.getByTestId('button-hide-reference-preview-golden_image'));
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(previewTimeoutId);

    act(() => vi.advanceTimersByTime(4_000));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    act(() => vi.advanceTimersByTime(7_999));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow').textContent).toMatch(/taking longer than expected/i);
  });
  it('replaces a slow-preview alert with the unavailable status and source link after an error', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://images.example.test/archive/failed-cover.webp';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    const image = view.getByTestId('img-comparison-reference-golden_image');
    expect(view.getByTestId('img-comparison-reference-golden_image-loading')).toBeTruthy();
    act(() => vi.advanceTimersByTime(8_000));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow')).toBeTruthy();

    fireEvent.error(image);
    expect(view.queryByTestId('img-comparison-reference-golden_image-loading')).toBeNull();
    expect(view.getByTestId('notice-reference-unavailable-golden_image').textContent).toMatch(/external image preview is unavailable/i);
    expect(view.getByText('Open reference source').getAttribute('href')).toBe(sourceUrl);
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();

    act(() => vi.advanceTimersByTime(8_000));
    expect(view.getByTestId('notice-reference-unavailable-golden_image')).toBeTruthy();
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();

    fireEvent.click(view.getByTestId('button-retry-reference-preview-golden_image'));
    expect(view.queryByTestId('notice-reference-unavailable-golden_image')).toBeNull();
    expect(view.getByTestId('img-comparison-reference-golden_image-loading').textContent).toMatch(/loading external image preview/i);
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(sourceUrl);
    expect(view.getByTestId('button-hide-reference-preview-golden_image')).toBeTruthy();

    act(() => vi.advanceTimersByTime(8_000));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow')).toBeTruthy();
  });
  it('does not show a slow-preview alert when the external image fails before the timeout', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://images.example.test/archive/quick-failure.webp';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    fireEvent.error(view.getByTestId('img-comparison-reference-golden_image'));
    expect(view.getByTestId('notice-reference-unavailable-golden_image').textContent).toMatch(/external image preview is unavailable/i);
    expect(view.getByText('Open reference source').getAttribute('href')).toBe(sourceUrl);

    act(() => vi.advanceTimersByTime(8_000));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    expect(view.getByTestId('notice-reference-unavailable-golden_image')).toBeTruthy();
  });
  it.each([
    { finishedSide: 'current', outcome: 'loads', waitingSide: 'historical' },
    { finishedSide: 'historical', outcome: 'loads', waitingSide: 'current' },
    { finishedSide: 'current', outcome: 'fails', waitingSide: 'historical' },
    { finishedSide: 'historical', outcome: 'fails', waitingSide: 'current' },
  ] as const)(
    'keeps the $waitingSide slow notice independent when the $finishedSide preview $outcome early',
    ({ finishedSide, outcome, waitingSide }) => {
      vi.useFakeTimers();
      const direction = ad(true);
      direction.history.push({
        ...ref('g-old', 'golden_image', false),
        url: 'https://images.example.test/archive/old-cover.webp',
      });
      direction.references[0] = {
        ...direction.references[0],
        url: 'https://images.example.test/archive/current-cover.webp',
      };
      const view = render(
        <StyleReviewDialog
          asset={asset(['g-old', 'f'], 'failed')}
          issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
          onClose={vi.fn()}
        />,
      );
      const imageTestId = (side: 'current' | 'historical') =>
        side === 'current'
          ? 'img-comparison-reference-golden_image'
          : 'img-comparison-historical-reference-golden_image';
      const slowNoticeTestId = (side: 'current' | 'historical') => `${imageTestId(side)}-slow`;
      const loadButtonTestId = (side: 'current' | 'historical') =>
        side === 'current'
          ? 'button-load-reference-preview-golden_image'
          : 'button-load-historical-reference-preview-golden_image';
      const unavailableNoticeTestId = (side: 'current' | 'historical') =>
        side === 'current'
          ? 'notice-reference-unavailable-golden_image'
          : 'notice-historical-reference-unavailable-golden_image';

      fireEvent.click(view.getByTestId(loadButtonTestId(finishedSide)));
      fireEvent.click(view.getByTestId(loadButtonTestId(waitingSide)));
      const finishedImage = view.getByTestId(imageTestId(finishedSide));
      if (outcome === 'loads') {
        fireEvent.load(finishedImage);
      } else {
        fireEvent.error(finishedImage);
      }

      act(() => vi.advanceTimersByTime(8_000));

      expect(view.getByTestId(slowNoticeTestId(waitingSide)).textContent).toMatch(/taking longer than expected/i);
      expect(view.queryByTestId(slowNoticeTestId(finishedSide))).toBeNull();
      if (outcome === 'fails') {
        expect(view.getByTestId(unavailableNoticeTestId(finishedSide)).textContent).toMatch(/external.*image preview is unavailable/i);
      } else {
        expect(view.getByTestId(imageTestId(finishedSide))).toBeTruthy();
      }
    },
  );
  it('announces a slow archived preview while keeping the saved artwork and both reference details available', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Archived Golden Image',
      url: 'https://images.example.test/archive/old-cover.webp',
    });
    direction.references[0] = { ...direction.references[0], title: 'Current Golden Image' };
    const reviewed = {
      ...asset(['g-old', 'f'], 'failed'),
      name: 'Saved cover.png',
      objectPath: '/private/saved-cover.png',
      contentType: 'image/png',
    } as Asset;
    const view = render(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-historical-reference-golden_image').getAttribute('src')).toBe('https://images.example.test/archive/old-cover.webp');
    expect(view.getAllByTestId('img-comparison-historical-reference-golden_image-loading')
      .some((status) => status.getAttribute('role') === 'status' &&
        status.textContent?.includes('Loading external image preview'))).toBe(true);
    act(() => vi.advanceTimersByTime(8_000));

    const slowNotice = view.getByTestId('img-comparison-historical-reference-golden_image-slow');
    expect(slowNotice.getAttribute('role')).toBe('status');
    expect(slowNotice.textContent).toMatch(/taking longer than expected/i);
    expect(view.getByTestId('img-comparison-saved-artwork-a')).toBeTruthy();
    expect(view.getByText('Archived Golden Image · v1 · saved predecessor')).toBeTruthy();
    expect(view.getByText('Current Golden Image · v1 · changed since this review')).toBeTruthy();
    expect(view.getByTestId('button-hide-historical-reference-preview-golden_image')).toBeTruthy();

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-golden_image'));
    expect(view.getAllByTestId('img-comparison-historical-reference-golden_image-loading')
      .every((status) => !status.textContent)).toBe(true);
    expect(view.queryByTestId('img-comparison-historical-reference-golden_image-slow')).toBeNull();
  });
  it('does not let a late archived image response replace a newer historical comparison choice', () => {
    vi.useFakeTimers();
    const oldUrl = 'https://images.example.test/archive/old-cover.webp';
    const newerUrl = 'https://images.example.test/archive/newer-cover.webp';
    const direction = ad(true);
    direction.history.push(
      { ...ref('g-old', 'golden_image', false), title: 'Older Golden Image', url: oldUrl },
      { ...ref('g-newer', 'golden_image', false), title: 'Newer Golden Image', url: newerUrl },
    );
    direction.references[0] = { ...direction.references[0], title: 'Current Golden Image' };
    const reviewed = {
      ...asset(['g-old', 'f'], 'failed'),
      name: 'Saved cover.png',
      objectPath: '/private/saved-cover.png',
      contentType: 'image/png',
    } as Asset;
    const view = render(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    const oldImage = view.getByTestId('img-comparison-historical-reference-golden_image');
    act(() => vi.advanceTimersByTime(8_000));
    expect(view.getByTestId('img-comparison-historical-reference-golden_image-slow')).toBeTruthy();

    const newerReviewed = { ...reviewed, styleReview: { ...reviewed.styleReview!, referenceIds: ['g-newer', 'f'] } };
    view.rerender(<StyleReviewDialog asset={newerReviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    expect(view.queryByTestId('img-comparison-historical-reference-golden_image')).toBeNull();
    expect(view.getByText('Newer Golden Image · v1 · saved predecessor')).toBeTruthy();
    expect(view.getByTestId('notice-historical-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    fireEvent.load(oldImage);

    expect(view.queryByTestId('img-comparison-historical-reference-golden_image')).toBeNull();
    expect(view.getByText('Newer Golden Image · v1 · saved predecessor')).toBeTruthy();
    expect(view.getByTestId('notice-historical-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    expect(view.getByTestId('img-comparison-saved-artwork-a')).toBeTruthy();
    expect(view.getByText('Current Golden Image · v1 · changed since this review')).toBeTruthy();
    expect(view.getByText('Open historical image source').getAttribute('href')).toBe(newerUrl);
  });
  it('does not let a late image response replace a newer reference choice', () => {
    vi.useFakeTimers();
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const oldUrl = 'https://images.example.test/archive/slow-cover.webp';
    direction.references[0] = { ...direction.references[0], url: oldUrl };
    const reviewed = {
      ...asset(['g-old', 'f'], 'failed'),
      name: 'Saved cover.png',
      objectPath: '/private/saved-cover.png',
      contentType: 'image/png',
    } as Asset;
    const view = render(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    const oldImage = view.getByTestId('img-comparison-reference-golden_image');
    act(() => vi.advanceTimersByTime(8_000));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow')).toBeTruthy();

    const updatedReference = { ...direction.references[0], id: 'g-new', title: 'New Golden Image', version: 2, url: 'https://images.example.test/archive/new-cover.webp' };
    const updatedDirection = {
      ...direction,
      references: direction.references.map((reference) =>
        reference.kind === 'golden_image' ? updatedReference : reference,
      ),
    };
    view.rerender(<StyleReviewDialog asset={reviewed} issue={{ id: 'issue', revision: 3, artDirection: updatedDirection } as unknown as Issue} onClose={vi.fn()} />);

    fireEvent.load(oldImage);
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(view.getByText(/New Golden Image · v2/)).toBeTruthy();
    expect(view.getByTestId('notice-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    expect(view.getByTestId('img-comparison-saved-artwork-a')).toBeTruthy();
  });
  it('gives a replacement external reference its own full slow-notice wait', () => {
    vi.useFakeTimers();
    const oldUrl = 'https://images.example.test/archive/old-cover.webp';
    const newUrl = 'https://images.example.test/archive/new-cover.webp';
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = { ...direction.references[0], url: oldUrl };
    const reviewed = asset(['g-old', 'f'], 'failed');
    const view = render(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    const oldImage = view.getByTestId('img-comparison-reference-golden_image');
    act(() => vi.advanceTimersByTime(5_000));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();

    const updatedReference = { ...direction.references[0], url: newUrl };
    const updatedDirection = {
      ...direction,
      references: direction.references.map((reference) =>
        reference.kind === 'golden_image' ? updatedReference : reference,
      ),
    };
    view.rerender(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 3, artDirection: updatedDirection } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    expect(view.getByTestId('notice-reference-preview-pending-golden_image')).toBeTruthy();
    fireEvent.load(oldImage);
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(newUrl);
    act(() => vi.advanceTimersByTime(3_000));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    act(() => vi.advanceTimersByTime(4_999));
    expect(view.queryByTestId('img-comparison-reference-golden_image-slow')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(view.getByTestId('img-comparison-reference-golden_image-slow')).toBeTruthy();
  });
  it.each([
    ['URL', 1, 'https://cdn.example.test/archive/cover.webp'],
    ['version', 2, 'https://images.example.test/archive/cover-v1.webp'],
  ])('requires a fresh preview decision when the registered reference %s changes', (_change, updatedVersion, updatedUrl) => {
    const initialUrl = 'https://images.example.test/archive/cover-v1.webp';
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = { ...direction.references[0], url: initialUrl };
    const initialReference = direction.references[0];
    const reviewed = asset(['g-old', 'f'], 'failed');
    const initialIssue = { id: 'issue', revision: 2, artDirection: direction } as unknown as Issue;
    const view = render(<StyleReviewDialog asset={reviewed} issue={initialIssue} onClose={vi.fn()} />);

    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(initialUrl);
    fireEvent.error(view.getByTestId('img-comparison-reference-golden_image'));
    expect(view.getByTestId('notice-reference-unavailable-golden_image').textContent).toMatch(/external image preview is unavailable/);

    const updatedReference = { ...initialReference, version: updatedVersion, url: updatedUrl };
    const updatedDirection = {
      ...direction,
      references: direction.references.map((reference) =>
        reference.kind === 'golden_image' ? updatedReference : reference,
      ),
    };
    view.rerender(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 3, artDirection: updatedDirection } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(view.getByTestId('notice-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    expect(view.getByText('Open image source').getAttribute('href')).toBe(updatedUrl);
    expect(initialReference.url).toBe(initialUrl);
    expect(updatedReference.url).toBe(updatedUrl);
    expect(direction.references[0].url).toBe(initialUrl);
    expect(updatedDirection.references[0].url).toBe(updatedUrl);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(updatedUrl);
    expect(initialReference.url).toBe(initialUrl);
    expect(updatedReference.url).toBe(updatedUrl);
  });
  it('requires a fresh preview decision when the registered reference identity changes but its URL stays the same', () => {
    const sourceUrl = 'https://images.example.test/archive/cover-v1.webp';
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const initialReference = direction.references[0];
    const initialReferenceSnapshot = { ...initialReference };
    const reviewed = asset(['g-old', 'f'], 'failed');
    const view = render(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(sourceUrl);

    const updatedReference = { ...initialReference, id: 'g-replacement' };
    const updatedReferenceSnapshot = { ...updatedReference };
    const updatedDirection = {
      ...direction,
      references: direction.references.map((reference) =>
        reference.kind === 'golden_image' ? updatedReference : reference,
      ),
    };
    view.rerender(
      <StyleReviewDialog
        asset={reviewed}
        issue={{ id: 'issue', revision: 3, artDirection: updatedDirection } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    expect(view.getByTestId('notice-reference-preview-pending-golden_image').textContent).toMatch(/Loading it will contact the image host/);
    expect(view.getByText('Open image source').getAttribute('href')).toBe(sourceUrl);
    expect(initialReference).toEqual(initialReferenceSnapshot);
    expect(updatedReference).toEqual(updatedReferenceSnapshot);

    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    expect(view.getByTestId('img-comparison-reference-golden_image').getAttribute('src')).toBe(sourceUrl);
    expect(initialReference).toEqual(initialReferenceSnapshot);
    expect(updatedReference).toEqual(updatedReferenceSnapshot);
  });
  it.each([
    ['an unsupported protocol', 'ftp://images.example.test/archive/cover.png'],
    ['embedded credentials', 'https://editor:secret@images.example.test/archive/cover.png'],
  ])('keeps image-looking URLs with %s external', (_case, sourceUrl) => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);

    expect(view.getByTestId('notice-reference-external-golden_image').textContent).toMatch(/not locally imported for preview/);
    expect(view.getByText('Open reference source').getAttribute('href')).toBe(sourceUrl);
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
  });
  it('keeps non-image URLs identified as external links', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://archive.example.test/collection/cover';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.getByTestId('notice-reference-external-golden_image').textContent).toMatch(/not locally imported for preview/);
    expect(view.getByText('Open reference source').getAttribute('href')).toBe(sourceUrl);
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
  });
  it('shows an unavailable message and source link when a direct image URL fails', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    const sourceUrl = 'https://images.example.test/cover.jpg';
    direction.references[0] = { ...direction.references[0], url: sourceUrl };
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    expect(view.queryByTestId('img-comparison-reference-golden_image')).toBeNull();
    fireEvent.click(view.getByTestId('button-load-reference-preview-golden_image'));
    fireEvent.error(view.getByTestId('img-comparison-reference-golden_image'));
    expect(view.getByTestId('notice-reference-unavailable-golden_image').textContent).toMatch(/external image preview is unavailable/);
    expect(view.getByText('Open reference source').getAttribute('href')).toBe(sourceUrl);
    expect(view.getByTestId('comparison-reference-golden_image')).toBeTruthy();
  });
  it('retries a failed historical external preview and returns to loading status', () => {
    const direction = ad(true);
    const sourceUrl = 'https://images.example.test/archive/old-cover.webp';
    direction.history.push({ ...ref('g-old', 'golden_image', false), url: sourceUrl });
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(view.getByTestId('button-load-historical-reference-preview-golden_image'));
    fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
    expect(view.getByTestId('notice-historical-reference-unavailable-golden_image').textContent).toMatch(/external historical image preview is unavailable/i);
    expect(view.getByText('Open historical image source').getAttribute('href')).toBe(sourceUrl);

    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
    expect(view.queryByTestId('notice-historical-reference-unavailable-golden_image')).toBeNull();
    expect(view.getAllByTestId('img-comparison-historical-reference-golden_image-loading')
      .some((status) => status.textContent?.match(/loading external image preview/i))).toBe(true);
    expect(view.getByTestId('img-comparison-historical-reference-golden_image').getAttribute('src')).toBe(sourceUrl);
    expect(view.getByTestId('button-hide-historical-reference-preview-golden_image')).toBeTruthy();
  });
  it('announces a saved historical image retry while loading and clears the status after success', () => {
    const direction = ad(true);
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Archived Golden Image',
      assetSnapshot: {
        name: 'archived-golden.png',
        objectPath: '/private/archived-golden.png',
        contentType: 'image/png',
      } as Asset,
      imageAvailable: true,
    } as ArtReference & { imageAvailable: boolean });
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
    const loading = view.getByTestId('img-comparison-historical-reference-golden_image-loading');
    expect(loading.textContent).toBe('');
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));

    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    expect(loading.textContent).toBe('Loading historical Golden Image preview: Archived Golden Image, version 1.');

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-golden_image'));

    expect(loading.textContent).toBe('');
    const success = view.getByTestId('notice-historical-reference-retry-success-golden_image');
    expect(success.getAttribute('role')).toBe('status');
    expect(success.getAttribute('aria-live')).toBe('polite');
    expect(success.textContent).toBe('Historical Golden Image preview loaded successfully: Archived Golden Image, version 1.');
  });
  it('keeps current Golden Image and saved historical Page 1 retry messages independent', () => {
    const direction = ad(true);
    direction.references[0] = {
      ...direction.references[0],
      title: 'Current Golden Image',
      url: 'https://images.example.test/current-golden.png',
    };
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Archived Golden Image',
    });
    direction.history.push({
      ...ref('page-one-old', 'front_page', false),
      title: 'Archived Page 1 cover',
      assetSnapshot: {
        name: 'archived-page-one.png',
        objectPath: '/private/archived-page-one.png',
        contentType: 'image/png',
      } as Asset,
      imageAvailable: true,
    } as ArtReferenceWithAvailability);
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'page-one-old'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    const currentLoad = view.getByTestId('button-load-reference-preview-golden_image');
    fireEvent.click(currentLoad);
    fireEvent.error(view.getByTestId('img-comparison-reference-golden_image'));
    fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));

    const currentFailure = view.getByTestId('img-comparison-reference-golden_image-retry-failed');
    const historicalFailure = view.getByTestId('notice-historical-reference-retry-failure-front_page');
    const currentSuccess = currentFailure;
    const historicalSuccess = view.getByTestId('notice-historical-reference-retry-success-front_page');
    fireEvent.click(view.getByTestId('button-retry-reference-preview-golden_image'));
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
    expect(view.getByTestId('img-comparison-reference-golden_image-loading').textContent)
      .toBe('Loading external image preview for current Golden Image reference “Current Golden Image”, version 1.');
    expect(view.getByTestId('img-comparison-historical-reference-front_page-loading').textContent)
      .toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    expect(currentFailure.textContent).toBe('');
    expect(historicalFailure.textContent).toBe('');

    fireEvent.error(view.getByTestId('img-comparison-reference-golden_image'));
    expect(currentFailure.textContent).toBe('Golden Image preview retry failed. The preview is still unavailable.');
    expect(view.getByTestId('img-comparison-historical-reference-front_page-loading').textContent)
      .toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    expect(historicalFailure.textContent).toBe('');

    fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));
    expect(historicalFailure.textContent)
      .toBe('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    expect(currentFailure.textContent).toBe('Golden Image preview retry failed. The preview is still unavailable.');

    fireEvent.click(view.getByTestId('button-retry-reference-preview-golden_image'));
    fireEvent.load(view.getByTestId('img-comparison-reference-golden_image'));
    expect(currentSuccess.textContent).toBe('Golden Image preview loaded successfully.');
    expect(historicalFailure.textContent)
      .toBe('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    expect(historicalSuccess.textContent).toBe('');

    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
    expect(view.getByTestId('img-comparison-historical-reference-front_page-loading').textContent)
      .toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    expect(currentSuccess.textContent).toBe('Golden Image preview loaded successfully.');
    fireEvent.load(view.getByTestId('img-comparison-historical-reference-front_page'));
    expect(historicalSuccess.textContent).toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    expect(currentSuccess.textContent).toBe('Golden Image preview loaded successfully.');
  });
  it('keeps a saved historical Page 1 first load silent and announces a later retry success', () => {
    const direction = ad(true);
    direction.history.push({
      ...ref('page-one-old', 'front_page', false),
      title: 'Archived Page 1 cover',
      version: 1,
      assetSnapshot: {
        name: 'archived-page-one.png',
        objectPath: '/private/archived-page-one.png',
        contentType: 'image/png',
      } as Asset,
      imageAvailable: true,
    } as ArtReference & { imageAvailable: boolean });
    const view = render(
      <StyleReviewDialog
        asset={asset(['g', 'page-one-old'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    const image = view.getByTestId('img-comparison-historical-reference-front_page');
    const success = view.getByTestId('notice-historical-reference-retry-success-front_page');
    fireEvent.load(image);
    expect(success.textContent).toBe('');

    fireEvent.error(image);
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));

    const loading = view.getByTestId('img-comparison-historical-reference-front_page-loading');
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    expect(loading.textContent).toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    expect(loading.textContent).not.toContain('Golden Image');

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-front_page'));

    expect(loading.textContent).toBe('');
    expect(success.getAttribute('role')).toBe('status');
    expect(success.getAttribute('aria-live')).toBe('polite');
    expect(success.textContent).toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
  });
  it('announces a saved historical Page 1 retry failure but not its first-load failure', () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    try {
      const direction = ad(true);
      direction.history.push({
        ...ref('page-one-old', 'front_page', false),
        title: 'Archived Page 1 cover',
        version: 1,
        assetSnapshot: {
          name: 'archived-page-one.png',
          objectPath: '/private/archived-page-one.png',
          contentType: 'image/png',
        } as Asset,
        imageAvailable: true,
      } as ArtReference & { imageAvailable: boolean });
      const view = render(
        <StyleReviewDialog
          asset={asset(['g', 'page-one-old'], 'failed')}
          issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
          onClose={vi.fn()}
        />,
      );
      const failure = view.getByTestId('notice-historical-reference-retry-failure-front_page');
      expect(failure.getAttribute('role')).toBe('status');
      expect(failure.getAttribute('aria-live')).toBe('polite');
      expect(failure.textContent).toBe('');

      fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));
      expect(failure.textContent).toBe('');
      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
      expect(failure.textContent).toBe('');
      expect(view.getByTestId('img-comparison-historical-reference-front_page-loading').textContent)
        .toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');

      fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));
      expect(failure.textContent)
        .toBe('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
    }
  });
  it('clears a saved historical Page 1 retry failure when a later retry succeeds', () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    try {
      const direction = ad(true);
      direction.history.push({
        ...ref('page-one-old', 'front_page', false),
        title: 'Archived Page 1 cover',
        version: 1,
        assetSnapshot: {
          name: 'archived-page-one.png',
          objectPath: '/private/archived-page-one.png',
          contentType: 'image/png',
        } as Asset,
        imageAvailable: true,
      } as ArtReference & { imageAvailable: boolean });
      const view = render(
        <StyleReviewDialog
          asset={asset(['g', 'page-one-old'], 'failed')}
          issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
          onClose={vi.fn()}
        />,
      );
      const failure = view.getByTestId('notice-historical-reference-retry-failure-front_page');
      const success = view.getByTestId('notice-historical-reference-retry-success-front_page');
      const imageTestId = 'img-comparison-historical-reference-front_page';

      fireEvent.error(view.getByTestId(imageTestId));
      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
      fireEvent.error(view.getByTestId(imageTestId));
      expect(failure.textContent)
        .toBe('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
      expect(success.textContent).toBe('');

      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
      expect(failure.textContent).toBe('');
      expect(view.getByTestId(`${imageTestId}-loading`).textContent)
        .toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
      expect(success.textContent).toBe('');

      fireEvent.load(view.getByTestId(imageTestId));
      expect(failure.textContent).toBe('');
      expect(success.textContent)
        .toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
    }
  });
  it('keeps saved Golden Image and Page 1 retry announcements independent', () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    try {
      const direction = ad(true);
      const sharedHistorical = {
        id: 'shared-history-id',
        version: 1,
        assetId: '',
        url: '',
        sourceIdentity: 'archive',
        at: '',
        suppliedBy: '',
        approval: null,
        assetSnapshot: {
          name: 'archived-reference.png',
          objectPath: '/private/archived-reference.png',
          contentType: 'image/png',
        } as Asset,
        imageAvailable: true,
      };
      direction.history.push(
        { ...sharedHistorical, kind: 'golden_image', title: 'Archived Golden Image' } as ArtReference & { imageAvailable: boolean },
        { ...sharedHistorical, kind: 'front_page', title: 'Archived Page 1 cover' } as ArtReference & { imageAvailable: boolean },
      );
      const view = render(
        <StyleReviewDialog
          asset={asset(['shared-history-id', 'shared-history-id'], 'failed')}
          issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
          onClose={vi.fn()}
        />,
      );

      const goldenLoading = view.getByTestId('img-comparison-historical-reference-golden_image-loading');
      const pageOneLoading = view.getByTestId('img-comparison-historical-reference-front_page-loading');
      const goldenFailure = view.getByTestId('notice-historical-reference-retry-failure-golden_image');
      const pageOneFailure = view.getByTestId('notice-historical-reference-retry-failure-front_page');
      const goldenSuccess = view.getByTestId('notice-historical-reference-retry-success-golden_image');
      const pageOneSuccess = view.getByTestId('notice-historical-reference-retry-success-front_page');

      fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
      fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));
      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
      expect(goldenLoading.textContent).toBe('Loading historical Golden Image preview: Archived Golden Image, version 1.');
      expect(pageOneLoading.textContent).toBe('');
      expect(pageOneFailure.textContent).toBe('');

      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
      expect(goldenLoading.textContent).toBe('Loading historical Golden Image preview: Archived Golden Image, version 1.');
      expect(pageOneLoading.textContent).toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
      expect(goldenFailure.textContent).toBe('');
      expect(pageOneFailure.textContent).toBe('');

      fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
      expect(goldenFailure.textContent)
        .toBe('Historical Golden Image preview retry failed. The preview is still unavailable.');
      expect(pageOneLoading.textContent).toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
      expect(pageOneFailure.textContent).toBe('');

      fireEvent.error(view.getByTestId('img-comparison-historical-reference-front_page'));
      expect(pageOneFailure.textContent)
        .toBe('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
      expect(goldenFailure.textContent)
        .toBe('Historical Golden Image preview retry failed. The preview is still unavailable.');

      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
      fireEvent.load(view.getByTestId('img-comparison-historical-reference-golden_image'));
      expect(goldenSuccess.textContent)
        .toBe('Historical Golden Image preview loaded successfully: Archived Golden Image, version 1.');
      expect(pageOneFailure.textContent)
        .toBe('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
      expect(pageOneSuccess.textContent).toBe('');

      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));
      fireEvent.load(view.getByTestId('img-comparison-historical-reference-front_page'));
      expect(pageOneSuccess.textContent)
        .toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
      expect(goldenSuccess.textContent)
        .toBe('Historical Golden Image preview loaded successfully: Archived Golden Image, version 1.');
      expect(goldenFailure.textContent).toBe('');
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
    }
  });
  it('keeps concurrent saved historical image retry announcements tied to their own references', () => {
    const direction = ad(true);
    direction.history.push(
      {
        ...ref('g-old', 'golden_image', false),
        title: 'Archived Golden Image',
        version: 3,
        assetSnapshot: {
          name: 'archived-golden.png',
          objectPath: '/private/archived-golden.png',
          contentType: 'image/png',
        } as Asset,
        imageAvailable: true,
      } as ArtReferenceWithAvailability,
      {
        ...ref('f-old', 'front_page', false),
        title: 'Archived Page 1 cover',
        version: 5,
        assetSnapshot: {
          name: 'archived-page-one.png',
          objectPath: '/private/archived-page-one.png',
          contentType: 'image/png',
        } as Asset,
        imageAvailable: true,
      } as ArtReferenceWithAvailability,
    );
    const view = render(
      <StyleReviewDialog
        asset={asset(['g-old', 'f-old'], 'failed')}
        issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue}
        onClose={vi.fn()}
      />,
    );

    const goldenImage = view.getByTestId('img-comparison-historical-reference-golden_image');
    const pageOneImage = view.getByTestId('img-comparison-historical-reference-front_page');
    fireEvent.error(goldenImage);
    fireEvent.error(pageOneImage);

    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-front_page'));

    const goldenLoading = view.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const pageOneLoading = view.getByTestId('img-comparison-historical-reference-front_page-loading');
    const goldenSuccess = view.getByTestId('notice-historical-reference-retry-success-golden_image');
    const pageOneSuccess = view.getByTestId('notice-historical-reference-retry-success-front_page');
    expect(goldenLoading.getAttribute('role')).toBe('status');
    expect(goldenLoading.getAttribute('aria-live')).toBe('polite');
    expect(goldenLoading.textContent).toBe('Loading historical Golden Image preview: Archived Golden Image, version 3.');
    expect(pageOneLoading.getAttribute('role')).toBe('status');
    expect(pageOneLoading.getAttribute('aria-live')).toBe('polite');
    expect(pageOneLoading.textContent).toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 5.');
    expect(goldenSuccess.textContent).toBe('');
    expect(pageOneSuccess.textContent).toBe('');

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-golden_image'));

    expect(goldenLoading.textContent).toBe('');
    expect(goldenSuccess.getAttribute('role')).toBe('status');
    expect(goldenSuccess.getAttribute('aria-live')).toBe('polite');
    expect(goldenSuccess.textContent)
      .toBe('Historical Golden Image preview loaded successfully: Archived Golden Image, version 3.');
    expect(pageOneLoading.textContent).toBe('Loading historical front-page benchmark preview: Archived Page 1 cover, version 5.');
    expect(pageOneSuccess.textContent).toBe('');

    fireEvent.load(view.getByTestId('img-comparison-historical-reference-front_page'));

    expect(pageOneLoading.textContent).toBe('');
    expect(pageOneSuccess.getAttribute('role')).toBe('status');
    expect(pageOneSuccess.getAttribute('aria-live')).toBe('polite');
    expect(pageOneSuccess.textContent)
      .toBe('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 5.');
  });
  it.each(['failure', 'success'] as const)(
    'clears a historical retry %s when a different saved review is opened',
    (outcome) => {
      const direction = ad(true);
      direction.history.push({
        ...ref('g-old', 'golden_image', false),
        title: 'Archived Golden Image',
        assetSnapshot: {
          name: 'archived-golden.png',
          objectPath: '/private/archived-golden.png',
          contentType: 'image/png',
        } as Asset,
        imageAvailable: true,
      } as ArtReferenceWithAvailability);
      const firstReview = {
        ...asset(['g-old', 'f'], 'failed'),
        name: 'First saved review',
        objectPath: '/private/first-review.png',
        contentType: 'image/png',
      } as Asset;
      const secondReview = {
        ...firstReview,
        id: 'second-review',
        name: 'Second saved review',
        objectPath: '/private/second-review.png',
      } as Asset;
      const issue = { id: 'issue', revision: 2, artDirection: direction } as unknown as Issue;
      const view = render(<StyleReviewDialog asset={firstReview} issue={issue} onClose={vi.fn()} />);

      fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
      fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
      const retryImage = view.getByTestId('img-comparison-historical-reference-golden_image');
      if (outcome === 'failure') fireEvent.error(retryImage);
      else fireEvent.load(retryImage);

      const announcementTestId = outcome === 'failure'
        ? 'notice-historical-reference-retry-failure-golden_image'
        : 'notice-historical-reference-retry-success-golden_image';
      expect(view.getByTestId(announcementTestId).textContent).not.toBe('');

      view.rerender(<StyleReviewDialog asset={secondReview} issue={issue} onClose={vi.fn()} />);

      expect(view.getByTestId('notice-historical-reference-retry-failure-golden_image').textContent).toBe('');
      expect(view.getByTestId('notice-historical-reference-retry-success-golden_image').textContent).toBe('');
      expect(view.getByTestId('comparison-saved-artwork-second-review')).toBeTruthy();
    },
  );
  it('ignores a late historical image event from the previous saved review', () => {
    const direction = ad(true);
    direction.history.push({
      ...ref('g-old', 'golden_image', false),
      title: 'Archived Golden Image',
      assetSnapshot: {
        name: 'archived-golden.png',
        objectPath: '/private/archived-golden.png',
        contentType: 'image/png',
      } as Asset,
      imageAvailable: true,
    } as ArtReferenceWithAvailability);
    const firstReview = {
      ...asset(['g-old', 'f'], 'failed'),
      name: 'First saved review',
      objectPath: '/private/first-review.png',
      contentType: 'image/png',
    } as Asset;
    const secondReview = { ...firstReview, id: 'second-review', name: 'Second saved review' } as Asset;
    const issue = { id: 'issue', revision: 2, artDirection: direction } as unknown as Issue;
    const view = render(<StyleReviewDialog asset={firstReview} issue={issue} onClose={vi.fn()} />);

    fireEvent.error(view.getByTestId('img-comparison-historical-reference-golden_image'));
    fireEvent.click(view.getByTestId('button-retry-historical-reference-preview-golden_image'));
    const pendingImage = view.getByTestId('img-comparison-historical-reference-golden_image');

    view.rerender(<StyleReviewDialog asset={secondReview} issue={issue} onClose={vi.fn()} />);
    fireEvent.error(pendingImage);
    fireEvent.load(pendingImage);

    expect(view.getByTestId('notice-historical-reference-retry-failure-golden_image').textContent).toBe('');
    expect(view.getByTestId('notice-historical-reference-retry-success-golden_image').textContent).toBe('');
    expect(view.getByTestId('img-comparison-historical-reference-golden_image')).toBeTruthy();
  });
  it('reports a current reference image that fails to load', () => {
    const direction = ad(true);
    direction.history.push(ref('g-old', 'golden_image', false));
    direction.references[0] = {
      ...direction.references[0],
      assetSnapshot: { name: 'golden.png', objectPath: '/private/golden.png', contentType: 'image/png' } as Asset,
      imageAvailable: true,
    } as ArtReferenceWithAvailability;
    const view = render(<StyleReviewDialog asset={asset(['g-old', 'f'], 'failed')} issue={{ id: 'issue', revision: 2, artDirection: direction } as unknown as Issue} onClose={vi.fn()} />);
    fireEvent.error(view.getByTestId('img-comparison-reference-golden_image'));
    expect(view.getByTestId('notice-reference-unavailable-golden_image').textContent).toMatch(/unavailable from protected storage/);
  });
  it('passed with unconfirmed refs is not ok', () => expect(styleStatus(asset(['g', 'f'], 'passed'), ad(false)).kind).toBe('warn'));
  it('passed with both confirmed', () => expect(styleStatus(asset(['g', 'f'], 'passed'), ad(true)).kind).toBe('ok'));
  it('failed stays failed without refs', () => expect(styleStatus(asset([], 'failed'), undefined).kind).toBe('bad'));
});

describe('style checklist freshness', () => {
  it('refreshes the open checklist to a concurrent reference revision and allows a retry with the new revision', () => {
    const initialReferences = [
      makeReference('golden-v1', 'Golden Image', 1, 'golden_image'),
      makeReference('front-v1', 'Front-page benchmark', 1, 'front_page'),
    ];
    const updatedReferences = [
      makeReference('golden-v2', 'Updated Golden Image', 2, 'golden_image'),
      initialReferences[1],
    ];
    const onClose = vi.fn();
    const view = render(<StyleReviewDialog asset={reviewAsset} issue={reviewIssue(7, initialReferences)} onClose={onClose} />);

    expect(view.getByTestId('style-review-references').textContent).toContain('Golden Image (v1)');
    fireEvent.click(view.getByTestId('check-style-spotInks'));
    expect((view.getByTestId('check-style-spotInks') as HTMLInputElement).checked).toBe(false);
    fireEvent.change(view.getByLabelText('Reviewer name'), { target: { value: 'Editor' } });
    fireEvent.change(view.getByLabelText('Notes'), { target: { value: 'Compared the original artwork.' } });
    fireEvent.click(view.getByTestId('check-style-ack'));

    view.rerender(<StyleReviewDialog asset={reviewAsset} issue={reviewIssue(8, updatedReferences)} onClose={onClose} />);

    expect(view.getByTestId('notice-style-checklist-refreshed').textContent).toContain('refreshed to revision 8');
    expect(view.getByTestId('style-review-references').textContent).toContain('Updated Golden Image (v2)');
    expect(view.getByTestId('style-review-references').textContent).not.toContain('Golden Image (v1)');
    expect((view.getByTestId('check-style-spotInks') as HTMLInputElement).checked).toBe(false);
    expect((view.getByTestId('check-style-ack') as HTMLInputElement).checked).toBe(false);
    expect((view.getByLabelText('Reviewer name') as HTMLInputElement).value).toBe('');
    expect((view.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('');

    fireEvent.change(view.getByLabelText('Reviewer name'), { target: { value: 'Editor' } });
    fireEvent.change(view.getByLabelText('Notes'), { target: { value: 'Rechecked against the updated original artwork.' } });
    fireEvent.click(view.getByTestId('check-style-ack'));
    fireEvent.click(view.getByTestId('button-style-fail'));
    expect(mocks.run).toHaveBeenCalledWith(
      { action: 'review_asset_style', id: 'a', styleChecks: expect.objectContaining({ spotInks: false }), decision: 'failed', reviewer: 'Editor', notes: 'Rechecked against the updated original artwork.', checked: true },
      'Style review failed',
      8,
    );
  });
});
