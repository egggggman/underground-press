import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { ArtDirection, ArtReference, Asset, Issue } from '@workspace/api-client-react';
import { StyleReviewDialog } from '../src/components/asset-style-review';
import '../src/index.css';

const reference = (
  id: string,
  kind: ArtReference['kind'],
  url: string,
  title = `Current ${kind}`,
  version = 2,
): ArtReference => ({
  id,
  version,
  kind,
  title,
  assetId: '',
  url,
  sourceIdentity: 'browser-test',
  at: '',
  suppliedBy: '',
  approval: null,
});

const params = new URLSearchParams(window.location.search);
const imageHost = params.get('imageHost');
const externalImageUrl = imageHost
  ? new URL('/current.png', imageHost).href
  : 'https://images.example.test/archive/cover.webp?edition=4';
const historicalImageUrl = params.has('historicalSvg')
  ? 'https://images.example.test/archive/historical-cover.svg?edition=3#svgView(viewBox(0,0,1,1))'
  : imageHost
    ? new URL('/historical.png', imageHost).href
    : 'https://images.example.test/archive/historical-cover.webp?edition=3';
const externalFrontPageImageUrl = 'https://images.example.test/archive/front-page.webp?edition=6';
const savedHistoricalImage = params.has('savedHistoricalImage');
const savedHistoricalPageOne = params.has('savedHistoricalPageOne');

const direction = {
  references: [
    reference('golden-current', 'golden_image', externalImageUrl),
    reference('front-page-current', 'front_page', externalFrontPageImageUrl),
  ],
  history: [
    {
      ...reference('golden-previous', 'golden_image', historicalImageUrl, 'Previous golden_image', 1),
      ...(savedHistoricalImage ? {
        assetSnapshot: {
          name: 'Historical cover',
          objectPath: '/private/historical-reference.png',
          contentType: 'image/png',
        } as Asset,
      } : {}),
    },
    {
      ...reference('front-page-previous', 'front_page', '', 'Archived Page 1 cover', 1),
      ...(savedHistoricalPageOne ? {
        assetSnapshot: {
          name: 'Archived Page 1 cover',
          objectPath: '/private/historical-reference.png',
          contentType: 'image/png',
        } as Asset,
      } : {}),
    },
  ],
} as ArtDirection;

const asset = {
  id: 'browser-test-asset',
  name: 'Saved cover',
  contentType: 'image/png',
  objectPath: '/private/saved-cover.png',
  styleReview: {
    decision: 'failed',
    checks: {},
    reviewer: 'Test editor',
    reviewerAccountId: 'test-editor',
    notes: 'Browser fixture',
    at: '',
    referenceIds: ['golden-previous', 'front-page-previous'],
  },
} as unknown as Asset;
const issue = { id: 'browser-test-issue', revision: 2, artDirection: direction } as unknown as Issue;

function Fixture() {
  const focusTest = params.has('focusTest');
  const [isOpen, setIsOpen] = useState(!focusTest);

  return (
    <>
      {focusTest && (
        <button type="button" onClick={() => setIsOpen(true)} data-testid="button-open-style-checklist">
          Open style checklist
        </button>
      )}
      <StyleReviewDialog asset={isOpen ? asset : null} issue={issue} onClose={() => setIsOpen(false)} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
