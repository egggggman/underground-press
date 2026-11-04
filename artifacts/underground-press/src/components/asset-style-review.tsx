import { useEffect, useRef, useState } from 'react';
import type { Asset, ArtDirection, ArtReference, StyleChecks, Issue } from '@workspace/api-client-react';
import { Modal } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { usePress } from '@/lib/press';

export const PROVISIONAL = 'Provisional: this treatment is user-described and has not been compared against the exact reference artwork.';
export function ensureCondensedFont() {
  if (typeof document === 'undefined' || document.getElementById('pd-font')) return;
  const l = document.createElement('link');
  l.id = 'pd-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap';
  document.head.appendChild(l);
}
ensureCondensedFont();

export const CHECKS: [keyof StyleChecks, string][] = [
  ['referenceMatch', 'Matches both confirmed reference artworks'], ['spotInks', 'Spot inks: black, oxblood, sewer green, mustard'],
  ['typography', 'Condensed headline and editorial serif typography'], ['inkIllustration', 'Hand-drawn ink / vintage-comic illustration'],
  ['halftoneRegistration', 'Restrained halftone and imperfect registration'], ['boxedComposition', 'Boxed modular column composition'],
  ['legibilityPrint', 'Legible at print size'], ['provenancePreserved', 'Provenance preserved; source unaltered'],
];

const emptyStyleChecks = () => Object.fromEntries(CHECKS.map(([key]) => [key, false])) as unknown as StyleChecks;
export type StyleReviewStatus = 'current' | 'stale' | 'unreviewed';

export function formatStyleReviewDate(at?: string | null): string | null {
  if (!at) return null;
  const timestamp = Date.parse(at);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(timestamp) + ' UTC';
}
export type StyleReviewDecision = 'passed' | 'failed';
export function styleReviewStatus(asset: Asset, ad?: ArtDirection): StyleReviewStatus {
  const review = asset.styleReview;
  if (!review) return 'unreviewed';
  const current = (ad?.references ?? []).map((reference) => reference.id).sort().join('|');
  const reviewed = [...review.referenceIds].sort().join('|');
  return current === reviewed ? 'current' : 'stale';
}

export function styleReviewDecision(asset: Asset): StyleReviewDecision | null {
  return asset.styleReview?.decision ?? null;
}
export function bothConfirmed(ad?: ArtDirection) {
  const g = ad?.references.find((r) => r.kind === 'golden_image');
  const f = ad?.references.find((r) => r.kind === 'front_page');
  return !!(g?.approval?.reviewerRole === 'myrtle_editor' && g.approval.reviewerAccountId &&
    f?.approval?.reviewerRole === 'myrtle_editor' && f.approval.reviewerAccountId);
}

const REFERENCE_LABELS = {
  golden_image: 'Golden Image',
  front_page: 'front-page benchmark',
} as const;

const REFERENCE_KINDS = ['golden_image', 'front_page'] as const;
type ArtReferenceWithAvailability = ArtReference & { imageAvailable?: boolean };
function staleReferenceExplanation(referenceIds: string[], ad?: ArtDirection) {
  const changedKinds = staleReferenceKinds(referenceIds, ad);
  if (!changedKinds?.length) return null;
  return changedKinds.map((kind) => REFERENCE_LABELS[kind]).join(' and ');
}

export function styleStatus(a: Asset, ad?: ArtDirection): { label: string; kind: 'ok' | 'warn' | 'bad'; stale: boolean } {
  const r = a.styleReview;
  if (!r) return { label: 'Style: unreviewed', kind: 'warn', stale: false };
  const stale = styleReviewStatus(a, ad) === 'stale';
  if (stale) {
    const changed = staleReferenceExplanation(r.referenceIds, ad);
    const reason = changed ? `${changed} changed` : 'references changed; specific reference cannot be identified';
    return { label: `Style: ${r.decision} (stale evidence, ${reason})`, kind: 'warn', stale: true };
  }
  if (r.decision === 'passed' && !bothConfirmed(ad)) return { label: 'Style: passed record, references unconfirmed', kind: 'warn', stale: false };
  if (r.decision === 'passed' && (!CHECKS.every(([k]) => r.checks[k]) || !r.reviewerAccountId.trim() || !r.notes.trim())) return { label: 'Style: incomplete human evidence', kind: 'warn', stale: false };
  return { label: `Style: ${r.decision}`, kind: r.decision === 'passed' ? 'ok' : 'bad', stale: false };
}

export function StyleBadge({ asset, issue, canReview = false, onReview }: { asset: Asset; issue: Issue; canReview?: boolean; onReview?: () => void }) {
  const s = styleStatus(asset, issue.artDirection);
  return (
    <>
      <span className={`pd-badge pd-badge-${s.kind}`} data-testid={`badge-style-${asset.id}`}>{s.label}</span>
      {s.stale && canReview && onReview && (
        <button
          type="button"
          className="btn btn-mustard text-xs py-1 px-2 ml-2"
          onClick={onReview}
          aria-label={`Open style checklist for ${asset.name}`}
          data-testid={`button-review-stale-style-${asset.id}`}
        >
          Open style checklist
        </button>
      )}
    </>
  );
}

const EXTERNAL_PREVIEW_SLOW_AFTER_MS = 8_000;

let nextExternalPreviewCacheIdentity = 0;
function ExternalReferencePreview({
  src,
  previewIdentity,
  alt,
  imageTestId,
  unavailableTestId,
  unavailableMessage,
  sourceLinkLabel,
  referenceDescription,
  retryTestId,
  onRetryStart,
  autoRetryOnOnline = false,
  keepUnavailableDuringRetry = false,
  retryAccessibleName,
  retryFailureAnnouncement,
  retrySuccessAnnouncement,
  loadingAnnouncement,
  cacheBustOnMount = false,
}: {
  src: string;
  previewIdentity: string;
  alt: string;
  imageTestId: string;
  unavailableTestId: string;
  unavailableMessage: string;
  sourceLinkLabel: string;
  referenceDescription: string;
  retryTestId: string;
  onRetryStart: () => void;
  autoRetryOnOnline?: boolean;
  keepUnavailableDuringRetry?: boolean;
  retryAccessibleName?: string;
  retryFailureAnnouncement?: string;
  retrySuccessAnnouncement?: string;
  loadingAnnouncement?: string;
  cacheBustOnMount?: boolean;
}) {
  const [previewCacheIdentity] = useState(() => ++nextExternalPreviewCacheIdentity);
  const [slowPreviewIdentity, setSlowPreviewIdentity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [retrySucceeded, setRetrySucceeded] = useState(false);
  const [retryWhenOnline, setRetryWhenOnline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageSrc = cacheBustOnMount
    ? withExternalPreviewCacheIdentity(src, `${previewCacheIdentity}-${attempt}`)
    : src;
  const slowTimeout = useRef<number | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const retryInFlight = useRef(false);
  const imageRequestInFlight = useRef(true);
  const reconnectDuringImageRequest = useRef(false);

  useEffect(() => {
    slowTimeout.current = window.setTimeout(
      () => setSlowPreviewIdentity(previewIdentity),
      EXTERNAL_PREVIEW_SLOW_AFTER_MS,
    );
    return () => {
      if (slowTimeout.current !== null) window.clearTimeout(slowTimeout.current);
      slowTimeout.current = null;
    };
  }, [previewIdentity, attempt]);

  useEffect(() => {
    if (!failed || isRetrying) return;

    const retryButton = retryButtonRef.current;
    if (!retryButton) return;

    retryButton.focus();

    const rect = retryButton.getBoundingClientRect();
    const outline = getComputedStyle(retryButton);
    const focusRingExtent =
      (Number.parseFloat(outline.outlineWidth) || 0) +
      (Number.parseFloat(outline.outlineOffset) || 0);
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);

    if (
      rect.top - focusRingExtent < viewportTop ||
      rect.bottom + focusRingExtent > viewportBottom ||
      rect.left - focusRingExtent < viewportLeft ||
      rect.right + focusRingExtent > viewportRight
    ) {
      retryButton.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    }
  }, [failed, isRetrying]);

  const clearSlowTimeout = () => {
    if (slowTimeout.current !== null) window.clearTimeout(slowTimeout.current);
    slowTimeout.current = null;
  };

  const retry = () => {
    if (retryInFlight.current) return;
    retryInFlight.current = true;
    imageRequestInFlight.current = true;
    reconnectDuringImageRequest.current = false;
    setRetryFailed(false);
    setRetrySucceeded(false);
    setRetryWhenOnline(false);
    setIsRetrying(true);
    onRetryStart();
    setIsLoading(true);
    setSlowPreviewIdentity(null);
    setAttempt((current) => current + 1);
  };

  useEffect(() => {
    if (!autoRetryOnOnline) return;
    const observeReconnect = () => {
      if (imageRequestInFlight.current) reconnectDuringImageRequest.current = true;
    };
    window.addEventListener('online', observeReconnect);
    return () => window.removeEventListener('online', observeReconnect);
  }, [autoRetryOnOnline]);

  useEffect(() => {
    if (!autoRetryOnOnline || !failed || !retryWhenOnline) return;

    const retryOnReconnect = () => {
      if (!navigator.onLine || retryInFlight.current) return;
      retry();
    };
    window.addEventListener('online', retryOnReconnect);
    if (navigator.onLine) retryOnReconnect();
    return () => window.removeEventListener('online', retryOnReconnect);
  }, [autoRetryOnOnline, failed, retry, retryWhenOnline]);

  return (
    <>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid={`${unavailableTestId}-announcement`}
      >
        {failed ? unavailableMessage : ''}
      </p>
      {(retryFailureAnnouncement || retrySuccessAnnouncement) && (
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid={`${imageTestId}-retry-failed`}
        >
          {retrySucceeded
            ? retrySuccessAnnouncement
            : retryFailed
              ? retryFailureAnnouncement
              : ''}
        </p>
      )}
      {failed && (!isRetrying || keepUnavailableDuringRetry) && (
        <p className="card-flat text-xs" data-testid={unavailableTestId}>
          {unavailableMessage}{' '}
          <a className="underline preview-keyboard-control" href={src} target="_blank" rel="noopener noreferrer">{sourceLinkLabel}</a>
          {' · '}
          <button
            ref={retryButtonRef}
            type="button"
            className="underline font-bold preview-keyboard-control preview-retry-control"
            onClick={retry}
            disabled={isRetrying}
            aria-label={retryAccessibleName}
            data-testid={retryTestId}
          >
            {isRetrying ? 'Retrying preview…' : 'Retry preview'}
          </button>
        </p>
      )}
      {(!failed || isRetrying) && (
        <>
          {isLoading && (
            <p
              className="card-flat text-xs"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid={`${imageTestId}-loading`}
            >
              {isRetrying || !loadingAnnouncement
                ? `Loading external image preview for ${referenceDescription}.`
                : loadingAnnouncement}
            </p>
          )}
          <img
            key={attempt}
            className="w-full max-h-64 object-contain border border-[#1e1812] bg-[#eee6d5]"
            src={imageSrc}
            referrerPolicy="no-referrer"
            alt={alt}
            data-testid={imageTestId}
            onLoad={() => {
              clearSlowTimeout();
              imageRequestInFlight.current = false;
              retryInFlight.current = false;
              setIsRetrying(false);
              setFailed(false);
              setIsLoading(false);
              setRetryFailed(false);
              if (isRetrying && retrySuccessAnnouncement) setRetrySucceeded(true);
              setRetryWhenOnline(false);
              setSlowPreviewIdentity(null);
            }}
            onError={() => {
              clearSlowTimeout();
              imageRequestInFlight.current = false;
              retryInFlight.current = false;
              setIsRetrying(false);
              setIsLoading(false);
              setSlowPreviewIdentity(null);
              if (isRetrying) setRetryFailed(true);
              setFailed(true);
              setRetryWhenOnline(
                autoRetryOnOnline && (!navigator.onLine || reconnectDuringImageRequest.current),
              );
              reconnectDuringImageRequest.current = false;
            }}
          />
          {slowPreviewIdentity === previewIdentity && (
            <p className="card-flat text-xs" role="status" data-testid={`${imageTestId}-slow`}>
              The external image preview for {referenceDescription} is taking longer than expected. Hide the preview to continue reviewing the saved artwork and reference details.
            </p>
          )}
        </>
      )}
    </>
  );
}
export function StyleReferenceComparison({ asset, issue }: { asset: Asset; issue: Issue }) {
  const [failedCurrentReferenceImages, setFailedCurrentReferenceImages] = useState<string[]>([]);
  const [failedHistoricalReferenceImages, setFailedHistoricalReferenceImages] = useState<string[]>([]);
  const [historicalImageAttempts, setHistoricalImageAttempts] = useState<Record<string, number>>({});
  const [historicalRetryInProgress, setHistoricalRetryInProgress] = useState<string[]>([]);
  const [historicalRetrySucceeded, setHistoricalRetrySucceeded] = useState<string[]>([]);
  const [historicalRetryFailed, setHistoricalRetryFailed] = useState<string[]>([]);
  const [loadedReferenceImages, setLoadedReferenceImages] = useState<string[]>([]);
  const [pageOnePreviewAnnouncement, setPageOnePreviewAnnouncement] = useState('');
  const [historicalPreviewAnnouncement, setHistoricalPreviewAnnouncement] = useState('');
  const pendingFocusKey = useRef<string | null>(null);
  const pendingHideFocusKey = useRef<string | null>(null);
  const pendingHistoricalRetryStartFocusKey = useRef<string | null>(null);
  const pendingHistoricalRetryFocusKey = useRef<string | null>(null);
  const loadButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const historicalOriginalLinkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const historicalRetryButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const direction = issue.artDirection;
  const changedKinds = staleReferenceKinds(asset.styleReview?.referenceIds ?? [], direction);
  const kindsToShow = changedKinds ?? [...REFERENCE_KINDS];
  const currentReferences = direction?.references ?? [];
  const storageBase = `${import.meta.env.BASE_URL}api/storage`;
  const hasSavedImage = asset.contentType?.startsWith('image/') && !!asset.objectPath;
  const hideButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const key = pendingFocusKey.current;
    if (!key || loadedReferenceImages.includes(key)) return;
    const button = loadButtonRefs.current.get(key);
    button?.focus();
    button?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    pendingFocusKey.current = null;
  }, [loadedReferenceImages]);

  useEffect(() => {
    const key = pendingHideFocusKey.current;
    if (!key || !loadedReferenceImages.includes(key)) return;
    const button = hideButtonRefs.current.get(key);
    button?.focus();
    button?.scrollIntoView?.({ block: 'center' });
    pendingHideFocusKey.current = null;
  }, [loadedReferenceImages]);

  useEffect(() => {
    const key = pendingHistoricalRetryFocusKey.current;
    if (!key || !failedHistoricalReferenceImages.includes(key)) return;
    const button = historicalRetryButtonRefs.current.get(key);
    if (!button) return;
    button.focus();
    button.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    pendingHistoricalRetryFocusKey.current = null;
  }, [failedHistoricalReferenceImages]);

  useEffect(() => {
    const key = pendingHistoricalRetryStartFocusKey.current;
    if (!key || !historicalRetryInProgress.includes(key)) return;
    const link = historicalOriginalLinkRefs.current.get(key);
    link?.focus();
    link?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    pendingHistoricalRetryStartFocusKey.current = null;
  }, [historicalRetryInProgress]);

  const hideExternalPreview = (key: string, announcement?: { pageOne?: boolean; historicalLabel?: string }) => {
    pendingFocusKey.current = key;
    if (announcement?.pageOne) setPageOnePreviewAnnouncement('Page 1 preview hidden.');
    if (announcement?.historicalLabel) {
      setHistoricalPreviewAnnouncement(`Historical ${announcement.historicalLabel} preview hidden.`);
    }
    setLoadedReferenceImages((loaded) => loaded.filter((item) => item !== key));
  };

  const retryHistoricalImage = (key: string) => {
    pendingHistoricalRetryStartFocusKey.current = key;
    setHistoricalRetryInProgress((retrying) => retrying.includes(key) ? retrying : [...retrying, key]);
    setHistoricalRetrySucceeded((succeeded) => succeeded.filter((item) => item !== key));
    setHistoricalRetryFailed((failed) => failed.filter((item) => item !== key));
    setFailedHistoricalReferenceImages((failed) => failed.filter((item) => item !== key));
    setHistoricalImageAttempts((attempts) => ({ ...attempts, [key]: (attempts[key] ?? 0) + 1 }));
  };

  return (
    <section className="card-flat space-y-3" aria-label="Compare saved artwork with current references" data-testid={`style-reference-comparison-${asset.id}`}>
      <div>
        <h3 className="text-lg font-black">Compare the saved artwork with current references</h3>
        <p className="text-xs">Historical and current references are read-only previews. Neither the saved artwork nor a reference is changed by this comparison.</p>
        {changedKinds === null && <p className="text-xs mt-1" role="status" data-testid="notice-reference-change-unknown">The saved review does not identify which reference changed. Current references are shown for context.</p>}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="notice-page-one-preview-hidden">
        {pageOnePreviewAnnouncement}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="notice-historical-reference-preview-hidden">
        {historicalPreviewAnnouncement}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <figure className="min-w-0" data-testid={`comparison-saved-artwork-${asset.id}`}>
          <figcaption className="text-sm font-bold mb-1">Saved artwork: {asset.name}</figcaption>
          {hasSavedImage && asset.objectPath ? (
            <>
              <img className="w-full max-h-64 object-contain border border-[#1e1812] bg-[#eee6d5]" src={`${storageBase}${asset.objectPath}`} alt={asset.caption || asset.name} data-testid={`img-comparison-saved-artwork-${asset.id}`} />
              <a className="underline text-xs" href={`${storageBase}${asset.objectPath}`} target="_blank" rel="noopener noreferrer">Inspect saved original</a>
            </>
          ) : (
            <p className="card-flat text-xs" role="status" data-testid={`notice-saved-artwork-unavailable-${asset.id}`}>Saved artwork preview is unavailable{asset.contentType?.startsWith('image/') ? ': no private file is available.' : ': this file is not an image.'}</p>
          )}
        </figure>
        {kindsToShow.map((kind) => {
          const reference = currentReferences.find((item) => item.kind === kind);
          const referenceWithAvailability = reference as ArtReferenceWithAvailability | undefined;
          const testId = `comparison-reference-${kind}`;
          const image = reference?.assetSnapshot;
          const hasReferenceImage = !!image?.objectPath && image.contentType?.startsWith('image/') && referenceWithAvailability?.imageAvailable !== false;
          const referenceKey = reference ? referencePreviewKey(reference) : '';
          const referencePreviewFailed = failedCurrentReferenceImages.includes(referenceKey);
          const imageUnavailable = referenceWithAvailability?.imageAvailable === false ||
            (hasReferenceImage && referencePreviewFailed);
          const directImageUrl = reference ? isDirectImageUrl(reference.url) : false;
          const historicalId = (asset.styleReview?.referenceIds ?? []).find((id) =>
            direction?.history.some((item) => item.id === id && item.kind === kind),
          );
          const historical = historicalId
            ? direction?.history.find((item) => item.id === historicalId && item.kind === kind)
            : undefined;
          const historicalWithAvailability = historical as ArtReferenceWithAvailability | undefined;
          const historicalImage = historical?.assetSnapshot;
          const historicalKey = historical ? referencePreviewKey(historical) : '';
          const historicalPreviewFailed = failedHistoricalReferenceImages.includes(historicalKey);
          const historicalSavedImageFailed = !!historicalImage?.objectPath &&
            historicalImage.contentType?.startsWith('image/') &&
            historicalWithAvailability?.imageAvailable !== false &&
            historicalPreviewFailed;
          const historicalUnavailable = historicalWithAvailability?.imageAvailable === false ||
            historicalSavedImageFailed;
          const hasHistoricalImage = !!historicalImage?.objectPath &&
            historicalImage.contentType?.startsWith('image/') && historicalWithAvailability?.imageAvailable !== false;
          const historicalDirectImageUrl = historical ? isDirectImageUrl(historical.url) : false;
          return (
            <section key={kind} className="min-w-0 sm:col-span-2" data-testid={testId} aria-label={`${REFERENCE_LABELS[kind]} version comparison`}>
              <h4 className="text-sm font-bold mb-1">{REFERENCE_LABELS[kind]} versions</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <figure className="min-w-0" data-testid={`comparison-historical-reference-${kind}`}>
                  <figcaption className="text-sm font-bold mb-1">Historical reference: {REFERENCE_LABELS[kind]}</figcaption>
                  <p
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    data-testid={`img-comparison-historical-reference-${kind}-loading`}
                  >
                    {historical && historicalRetryInProgress.includes(historicalKey)
                      ? `Loading historical ${REFERENCE_LABELS[kind]} preview: ${historical.title}, version ${historical.version}.`
                      : ''}
                  </p>
                  <p
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    data-testid={`notice-historical-reference-retry-failure-${kind}`}
                  >
                    {historicalRetryFailed.includes(historicalKey)
                      ? `Historical ${kind === 'front_page' ? 'front-page benchmark' : REFERENCE_LABELS[kind]} preview retry failed. The preview is still unavailable.`
                      : ''}
                  </p>
                  <p
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    data-testid={`notice-historical-reference-retry-success-${kind}`}
                  >
                    {historical && historicalRetrySucceeded.includes(historicalKey)
                      ? `Historical ${REFERENCE_LABELS[kind]} preview loaded successfully: ${historical.title}, version ${historical.version}.`
                      : ''}
                  </p>
                  {historical ? (
                    <>
                      <p className="text-xs mb-1">{historical.title} · v{historical.version} · saved predecessor</p>
                      {historicalUnavailable ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-unavailable-${kind}`}>
                          This historical reference image is unavailable from protected storage.
                          {historicalSavedImageFailed && (
                            <>
                              {' '}
                              <button
                                type="button"
                                className="underline font-bold preview-keyboard-control preview-retry-control"
                                onClick={() => retryHistoricalImage(historicalKey)}
                                ref={(button) => {
                                  if (button) historicalRetryButtonRefs.current.set(historicalKey, button);
                                  else historicalRetryButtonRefs.current.delete(historicalKey);
                                }}
                                data-testid={`button-retry-historical-reference-preview-${kind}`}
                              >
                                Retry preview
                              </button>
                            </>
                          )}
                        </p>
                      ) : hasHistoricalImage && historicalImage?.objectPath ? (
                        <>
                          <img
                            key={`${historicalKey}:${historicalImageAttempts[historicalKey] ?? 0}`}
                            className="w-full max-h-64 object-contain border border-[#1e1812] bg-[#eee6d5]"
                            src={`${storageBase}${historicalImage.objectPath}`}
                            alt={`Historical ${REFERENCE_LABELS[kind]}: ${historical.title}, version ${historical.version}`}
                            data-testid={`img-comparison-historical-reference-${kind}`}
                            onLoad={() => {
                              if (!historicalRetryInProgress.includes(historicalKey)) return;
                              setHistoricalRetryInProgress((retrying) => retrying.filter((item) => item !== historicalKey));
                              setHistoricalRetryFailed((failed) => failed.filter((item) => item !== historicalKey));
                              setHistoricalRetrySucceeded((succeeded) => succeeded.includes(historicalKey) ? succeeded : [...succeeded, historicalKey]);
                            }}
                            onError={() => {
                              const retryFailed = historicalRetryInProgress.includes(historicalKey);
                              if (retryFailed) {
                                pendingHistoricalRetryFocusKey.current = historicalKey;
                                setHistoricalRetryFailed((failed) => failed.includes(historicalKey) ? failed : [...failed, historicalKey]);
                              }
                              setHistoricalRetryInProgress((retrying) => retrying.filter((item) => item !== historicalKey));
                              setFailedHistoricalReferenceImages((failed) => failed.includes(historicalKey) ? failed : [...failed, historicalKey]);
                            }}
                          />
                          <a
                            className="underline text-xs preview-keyboard-control"
                            href={`${storageBase}${historicalImage.objectPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`link-inspect-historical-reference-original-${kind}`}
                            ref={(link) => {
                              if (link) historicalOriginalLinkRefs.current.set(historicalKey, link);
                              else historicalOriginalLinkRefs.current.delete(historicalKey);
                            }}
                          >
                            Inspect historical reference original
                          </a>
                        </>
                      ) : historicalImage?.objectPath ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-unavailable-${kind}`}>The historical reference has a saved file, but it is not an image preview.</p>
                      ) : historicalDirectImageUrl && historicalPreviewFailed ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-unavailable-${kind}`}>
                          This external historical image preview is unavailable. <a className="underline preview-keyboard-control" href={historical.url} target="_blank" rel="noopener noreferrer">Open historical image source</a>
                        </p>
                      ) : historicalDirectImageUrl ? (
                        loadedReferenceImages.includes(historicalKey) ? (
                          <>
                            <ExternalReferencePreview
                              key={historicalKey}
                              src={historical.url}
                              previewIdentity={historicalKey}
                              alt={`Historical ${REFERENCE_LABELS[kind]}: ${historical.title}, version ${historical.version}`}
                              imageTestId={`img-comparison-historical-reference-${kind}`}
                              unavailableTestId={`notice-historical-reference-unavailable-${kind}`}
                              unavailableMessage="This external historical image preview is unavailable."
                              sourceLinkLabel="Open historical image source"
                              referenceDescription={`historical ${REFERENCE_LABELS[kind]} reference “${historical.title}”, version ${historical.version}`}
                              retryTestId={`button-retry-historical-reference-preview-${kind}`}
                              onRetryStart={() => {
                                const hideButton = hideButtonRefs.current.get(historicalKey);
                                if (!hideButton) return;
                                hideButton.focus();

                                const dialog = hideButton.closest<HTMLElement>('[role="dialog"]');
                                if (!dialog) return;
                                const buttonRect = hideButton.getBoundingClientRect();
                                const dialogRect = dialog.getBoundingClientRect();
                                const outline = getComputedStyle(hideButton);
                                const focusRingExtent =
                                  (Number.parseFloat(outline.outlineWidth) || 0) +
                                  (Number.parseFloat(outline.outlineOffset) || 0);
                                if (
                                  buttonRect.top - focusRingExtent < dialogRect.top ||
                                  buttonRect.bottom + focusRingExtent > dialogRect.bottom ||
                                  buttonRect.left - focusRingExtent < dialogRect.left ||
                                  buttonRect.right + focusRingExtent > dialogRect.right
                                ) {
                                  hideButton.scrollIntoView?.({ block: 'center', inline: 'nearest' });
                                }
                              }}
                              retryFailureAnnouncement={`Historical ${REFERENCE_LABELS[kind]} preview retry failed. The preview is still unavailable.`}
                              retrySuccessAnnouncement={`Historical ${REFERENCE_LABELS[kind]} preview loaded successfully.`}
                            />
                            <button
                              type="button"
                              className="underline text-xs preview-keyboard-control"
                              onClick={() => hideExternalPreview(historicalKey, { historicalLabel: REFERENCE_LABELS[kind] })}
                              ref={(button) => {
                                if (button) hideButtonRefs.current.set(historicalKey, button);
                                else hideButtonRefs.current.delete(historicalKey);
                              }}
                              data-testid={`button-hide-historical-reference-preview-${kind}`}
                            >
                              Hide external preview
                            </button>
                          </>
                        ) : (
                          <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-preview-pending-${kind}`}>
                            External historical image preview is not loaded. Loading it will contact the image host.{' '}
                            <button
                              type="button"
                              className="underline font-bold preview-keyboard-control"
                              onClick={() => {
                                setHistoricalPreviewAnnouncement('');
                                if (document.activeElement === loadButtonRefs.current.get(historicalKey)) {
                                  pendingHideFocusKey.current = historicalKey;
                                }
                                setLoadedReferenceImages((loaded) => loaded.includes(historicalKey) ? loaded : [...loaded, historicalKey]);
                              }}
                              ref={(button) => {
                                if (button) loadButtonRefs.current.set(historicalKey, button);
                                else loadButtonRefs.current.delete(historicalKey);
                              }}
                              data-testid={`button-load-historical-reference-preview-${kind}`}
                            >
                              Load historical preview
                            </button>
                            {' · '}
                            <a className="underline preview-keyboard-control" href={historical.url} target="_blank" rel="noopener noreferrer" data-testid={`link-historical-reference-source-${kind}`}>Open historical image source</a>
                          </p>
                        )
                      ) : historical.url.trim() ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-unavailable-${kind}`}>
                          Historical artwork is not saved for preview. <a className="underline preview-keyboard-control" href={historical.url} target="_blank" rel="noopener noreferrer">Open historical reference source</a>
                        </p>
                      ) : (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-unavailable-${kind}`}>No historical reference artwork is available in the saved predecessor.</p>
                      )}
                    </>
                  ) : (
                    <p className="card-flat text-xs" role="status" data-testid={`notice-historical-reference-missing-${kind}`}>The historical {REFERENCE_LABELS[kind]} artwork is unavailable; its saved predecessor could not be found. The current reference remains available beside this notice.</p>
                  )}
                </figure>
                <figure className="min-w-0" data-testid={`comparison-current-reference-${kind}`}>
                  <figcaption className="text-sm font-bold mb-1">Current reference: {REFERENCE_LABELS[kind]}</figcaption>
                  {reference ? (
                    <>
                      <p className="text-xs mb-1">{reference.title} · v{reference.version}{changedKinds?.includes(kind) ? ' · changed since this review' : ''}</p>
                      {imageUnavailable ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-reference-unavailable-${kind}`}>This current reference image is unavailable from protected storage.</p>
                      ) : hasReferenceImage && image?.objectPath ? (
                        <>
                          <img
                            className="w-full max-h-64 object-contain border border-[#1e1812] bg-[#eee6d5]"
                            src={`${storageBase}${image.objectPath}`}
                            alt={`Current ${REFERENCE_LABELS[kind]}: ${reference.title}`}
                            data-testid={`img-comparison-reference-${kind}`}
                            onError={() => setFailedCurrentReferenceImages((failed) => failed.includes(referenceKey) ? failed : [...failed, referenceKey])}
                          />
                          <a className="underline text-xs" href={`${storageBase}${image.objectPath}`} target="_blank" rel="noopener noreferrer">Inspect current reference original</a>
                        </>
                      ) : image?.objectPath ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-reference-unavailable-${kind}`}>This reference has a saved file, but it is not an image preview.</p>
                      ) : directImageUrl && referencePreviewFailed ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-reference-unavailable-${kind}`}>
                          This external image preview is unavailable. <a className="underline" href={reference.url} target="_blank" rel="noopener noreferrer">Open reference source</a>
                        </p>
                      ) : directImageUrl ? (
                        loadedReferenceImages.includes(referenceKey) ? (
                          <>
                            <ExternalReferencePreview
                              key={referenceKey}
                              src={reference.url}
                              previewIdentity={referenceKey}
                              alt={`Current ${REFERENCE_LABELS[kind]}: ${reference.title}`}
                              imageTestId={`img-comparison-reference-${kind}`}
                              unavailableTestId={`notice-reference-unavailable-${kind}`}
                              unavailableMessage={kind === 'front_page'
                                ? 'Page 1 preview is unavailable.'
                                : 'This external image preview is unavailable.'}
                              sourceLinkLabel="Open reference source"
                              referenceDescription={`current ${REFERENCE_LABELS[kind]} reference “${reference.title}”, version ${reference.version}`}
                              retryTestId={`button-retry-reference-preview-${kind}`}
                              retryAccessibleName={kind === 'front_page' ? 'Retry Page 1 preview' : undefined}
                              onRetryStart={() => hideButtonRefs.current.get(referenceKey)?.focus()}
                              autoRetryOnOnline={kind === 'front_page'}
                              keepUnavailableDuringRetry={kind === 'front_page'}
                              retryFailureAnnouncement={kind === 'front_page'
                                ? 'Page 1 preview retry failed. The preview is still unavailable.'
                                : kind === 'golden_image'
                                  ? 'Golden Image preview retry failed. The preview is still unavailable.'
                                : undefined}
                              retrySuccessAnnouncement={kind === 'front_page'
                                ? 'Page 1 preview loaded successfully.'
                                : kind === 'golden_image'
                                  ? 'Golden Image preview loaded successfully.'
                                : undefined}
                              loadingAnnouncement={kind === 'front_page' ? 'Loading Page 1 preview.' : undefined}
                              cacheBustOnMount={kind === 'front_page'}
                            />
                            <button
                              type="button"
                              className="underline text-xs preview-keyboard-control"
                              onClick={() => hideExternalPreview(referenceKey, { pageOne: kind === 'front_page' })}
                              ref={(button) => {
                                if (button) hideButtonRefs.current.set(referenceKey, button);
                                else hideButtonRefs.current.delete(referenceKey);
                              }}
                              data-testid={`button-hide-reference-preview-${kind}`}
                            >
                              Hide external preview
                            </button>
                          </>
                        ) : (
                          <p className="card-flat text-xs" role="status" data-testid={`notice-reference-preview-pending-${kind}`}>
                            External image preview is not loaded. Loading it will contact the image host.{' '}
                            <button
                              type="button"
                              className="underline font-bold preview-keyboard-control"
                              onClick={() => {
                                if (kind === 'front_page') setPageOnePreviewAnnouncement('');
                                 if (document.activeElement === loadButtonRefs.current.get(referenceKey)) {
                                   pendingHideFocusKey.current = referenceKey;
                                 }
                                setLoadedReferenceImages((loaded) => loaded.includes(referenceKey) ? loaded : [...loaded, referenceKey]);
                              }}
                              ref={(button) => {
                                if (button) loadButtonRefs.current.set(referenceKey, button);
                                else loadButtonRefs.current.delete(referenceKey);
                              }}
                              data-testid={`button-load-reference-preview-${kind}`}
                            >
                              Load external preview
                            </button>
                            {' · '}
                            <a className="underline" href={reference.url} target="_blank" rel="noopener noreferrer">Open image source</a>
                          </p>
                        )
                      ) : reference.url.trim() ? (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-reference-external-${kind}`}>
                          External reference is not locally imported for preview. <a className="underline" href={reference.url} target="_blank" rel="noopener noreferrer">Open reference source</a>
                        </p>
                      ) : (
                        <p className="card-flat text-xs" role="status" data-testid={`notice-reference-unavailable-${kind}`}>No current reference artwork is available.</p>
                      )}
                    </>
                  ) : (
                    <p className="card-flat text-xs" role="status" data-testid={`notice-reference-missing-${kind}`}>No current {REFERENCE_LABELS[kind]} is registered.</p>
                  )}
                </figure>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function isDirectImageUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password &&
      /\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function referencePreviewKey(reference: Pick<ArtReference, 'kind' | 'id' | 'version' | 'url'>) {
  return JSON.stringify([reference.kind, reference.id, reference.version, reference.url]);
}
export function StyleReviewDialog({ asset, issue, onClose }: { asset: Asset | null; issue: Issue; onClose: () => void }) {
  const { run, pending, auth, canWrite } = usePress();
  const { toast } = useToast();
  const lastChecklist = useRef<{ assetId: string; revision: number } | null>(null);
  const [checks, setChecks] = useState<StyleChecks>(emptyStyleChecks);
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [ack, setAck] = useState(false);
  const [rev, setRev] = useState(0);
  const [refreshed, setRefreshed] = useState(false);
  useEffect(() => {
    if (!asset) {
      lastChecklist.current = null;
      setRefreshed(false);
      return;
    }
    const previous = lastChecklist.current;
    const issueChanged = previous?.assetId === asset.id && previous.revision !== issue.revision;
    lastChecklist.current = { assetId: asset.id, revision: issue.revision };
    setRefreshed(issueChanged);
    const savedReview = issueChanged ? undefined : asset.styleReview;
    setRev(issue.revision); setAck(false); setNotes(savedReview?.notes ?? ''); setReviewer('');
    setChecks(savedReview?.checks ?? emptyStyleChecks());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, issue.revision]);
  const all = CHECKS.every(([k]) => checks[k]);
  const refsOk = bothConfirmed(issue.artDirection);
  const canPass = all && refsOk;
  const ready = ack && notes.trim() && reviewer.trim();
  const submit = async (decision: 'passed' | 'failed') => {
    if (!asset) return;
    if (issue.revision !== rev) { toast({ title: 'Stale checklist', description: 'The issue changed after this checklist opened. Close and reopen it to review the latest evidence.', variant: 'destructive' }); return; }
    if (await run({ action: 'review_asset_style', id: asset.id, styleChecks: checks, decision, reviewer, notes, checked: true }, `Style review ${decision}`, rev)) onClose();
  };
  const actor = auth.user?.id;
  const currentReferences = issue.artDirection?.references ?? [];
  const comparisonKey = asset ? JSON.stringify([asset.id, asset.styleReview]) : '';
  return (
    <Modal open={!!asset} title={`Style checklist: ${asset?.name ?? ''}`} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <p className="card-flat text-xs">{PROVISIONAL}</p>
        {asset && styleStatus(asset, issue.artDirection).stale && <StyleReferenceComparison key={comparisonKey} asset={asset} issue={issue} />}
        {asset && canWrite && asset.contentType?.startsWith('image/') && asset.objectPath && <div className="pd-frame press-preview inline-block"><img className="max-h-48" src={`${import.meta.env.BASE_URL}api/storage${asset.objectPath}`} alt={asset.caption || asset.name} /></div>}
        {refreshed && <p className="card-flat text-xs" role="status" data-testid="notice-style-checklist-refreshed">The issue changed while this checklist was open. It has been refreshed to revision {rev}. Compare the current reference artwork, then retry your review.</p>}
        <p className="card-flat text-xs">Checklist revision {rev}. The server records the signed-in account{actor ? ` (${actor})` : ''} as actor. This is separate from general asset review. {refsOk ? 'Both reference artworks are confirmed by Myrtle.' : 'Reference artwork not yet imported and confirmed: a pass is not possible, a failed review is allowed.'}</p>
        <div className="card-flat text-xs" data-testid="style-review-references">
          <strong>Reference versions for this review:</strong>
          {currentReferences.length ? (
            <ul className="list-disc pl-5">
              {currentReferences.map((reference) => (
                <li key={reference.id}>{REFERENCE_LABELS[reference.kind]}: {reference.title} (v{reference.version})</li>
              ))}
            </ul>
          ) : <p>No reference artworks are registered.</p>}
        </div>
        {CHECKS.map(([k, l]) => <label key={k} className="flex gap-2 items-start"><input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} data-testid={`check-style-${k}`} /><span>{l}</span></label>)}
        <label className="lbl" htmlFor="sr-n">Reviewer name</label><input id="sr-n" className="field" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
        <label className="lbl" htmlFor="sr-t">Notes</label><textarea id="sr-t" className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="check-style-ack" />I compared the original file against the confirmed references myself.</label>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-red" disabled={!ready || pending} onClick={() => submit('failed')} data-testid="button-style-fail">Record failed</button>
          <button className="btn btn-green" disabled={!ready || !canPass || pending} onClick={() => submit('passed')} data-testid="button-style-pass">Record passed</button>
        </div>
      </div>
    </Modal>
  );
}

function staleReferenceKinds(referenceIds: string[], ad?: ArtDirection): ArtReference['kind'][] | null {
  const current = ad?.references ?? [];
  const history = [...(ad?.history ?? []), ...current];
  const kindById = new Map<string, ArtReference['kind']>();
  const ambiguousIds = new Set<string>();
  for (const reference of history) {
    const knownKind = kindById.get(reference.id);
    if (knownKind && knownKind !== reference.kind) ambiguousIds.add(reference.id);
    else kindById.set(reference.id, reference.kind);
  }

  const oldIds = new Set(referenceIds);
  if (oldIds.size !== referenceIds.length || [...oldIds].some((id) => ambiguousIds.has(id))) return null;
  const oldKindById = new Map<string, ArtReference['kind']>();
  for (const id of oldIds) {
    const kind = kindById.get(id);
    if (!kind || [...oldKindById.values()].includes(kind)) return null;
    oldKindById.set(id, kind);
  }

  const currentByKind = new Map<ArtReference['kind'], ArtReference>();
  for (const reference of current) {
    if (currentByKind.has(reference.kind)) return null;
    currentByKind.set(reference.kind, reference);
  }

  return REFERENCE_KINDS.filter((kind) => {
    const previousId = [...oldKindById].find(([, oldKind]) => oldKind === kind)?.[0];
    const currentId = currentByKind.get(kind)?.id;
    return previousId !== currentId;
  });
}

function withExternalPreviewCacheIdentity(src: string, identity: string) {
  const url = new URL(src);
  if (url.hash) return src;
  // Firefox can reuse a failed decode for the same image URL after the preview is remounted.
  url.hash = `preview-${identity}`;
  return url.href;
}
