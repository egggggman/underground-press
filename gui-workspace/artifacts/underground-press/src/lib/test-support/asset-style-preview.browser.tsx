import { createRoot } from 'react-dom/client';
import type { Asset, ArtDirection, ArtReference, Issue } from '@workspace/api-client-react';
import { StyleReferenceComparison } from '@/components/asset-style-review';

const imageUrl = new URLSearchParams(window.location.search).get('image');
if (!imageUrl) throw new Error('The browser test requires an image URL.');

const oldGolden: ArtReference = {
  id: 'golden-old',
  kind: 'golden_image',
  title: 'Previous Golden Image',
  version: 1,
  assetId: '',
  url: '',
  sourceIdentity: 'test/previous',
  at: '',
  suppliedBy: 'test',
  approval: null,
};
const currentGolden: ArtReference = {
  ...oldGolden,
  id: 'golden-current',
  title: 'Redirected Golden Image',
  version: 2,
  url: imageUrl,
};
const frontPage: ArtReference = {
  ...oldGolden,
  id: 'front-page',
  kind: 'front_page',
  title: 'Front-page benchmark',
};
const direction: ArtDirection = {
  references: [currentGolden, frontPage],
  history: [oldGolden],
};
const asset = {
  id: 'browser-test-artwork',
  styleReview: {
    decision: 'failed',
    checks: {},
    reviewer: 'test',
    reviewerAccountId: 'browser-test',
    notes: 'Browser test fixture',
    at: '',
    referenceIds: [oldGolden.id, frontPage.id],
  },
} as unknown as Asset;
const issue = {
  id: 'browser-test-issue',
  revision: 2,
  artDirection: direction,
} as unknown as Issue;

createRoot(document.getElementById('root')!).render(
  <StyleReferenceComparison asset={asset} issue={issue} />,
);
