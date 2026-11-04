import assert from 'node:assert/strict';
import test from 'node:test';
import { getMediaRestoreFailureNotice } from './media-restore-error.mjs';

test('restore byte/type mismatch becomes an actionable editor notice', () => {
  const notice = getMediaRestoreFailureNotice({
    status: 422,
    data: {
      code: 'GITHUB_MEDIA_TYPE_MISMATCH',
      error: 'Cannot restore “Artwork Page 2”: downloaded GitHub bytes do not match the asset’s declared type (image/png). Nothing was written.',
    },
  });

  assert.deepEqual(notice, {
    title: 'Restore stopped: GitHub file type mismatch',
    reason: 'Cannot restore “Artwork Page 2”: downloaded GitHub bytes do not match the asset’s declared type (image/png). Nothing was written.',
    recovery: 'Nothing was written. This preview is still available. Deselect this file and select a different one, or correct the GitHub copy and create a fresh preview before trying again.',
  });
});

test('selected GitHub download failures give a file-specific safe retry notice', () => {
  const notice = getMediaRestoreFailureNotice({
    status: 502,
    data: {
      code: 'GITHUB_MEDIA_DOWNLOAD_FAILED',
      fileName: 'Artwork-C',
      path: 'issues/issue-1.media/asset-c-Artwork-C.png',
      reason: 'GitHub returned HTTP 503 while delivering the selected file.',
      error: 'Cannot restore “Artwork-C” (issues/issue-1.media/asset-c-Artwork-C.png): GitHub returned HTTP 503 while delivering the selected file. Nothing was written.',
    },
  });

  assert.deepEqual(notice, {
    title: 'Restore stopped: GitHub could not deliver this file',
    reason: 'Cannot restore “Artwork-C” (issues/issue-1.media/asset-c-Artwork-C.png): GitHub returned HTTP 503 while delivering the selected file. Nothing was written.',
    recovery: 'No private-storage file was written. Your preview and selected files are still available. Choose Retry restore to try again; if it keeps failing, create a fresh preview and retry later.',
  });
});

test('rate-limited GitHub restores show a safe wait interval without provider details', () => {
  const notice = getMediaRestoreFailureNotice({
    status: 429,
    data: {
      code: 'GITHUB_MEDIA_RATE_LIMITED',
      retryAfterSeconds: 125,
      error: 'Cannot restore “Artwork-C” (issues/issue-1.media/asset-c-Artwork-C.png): GitHub is temporarily limiting media downloads. Nothing was written.',
    },
  });

  assert.deepEqual(notice, {
    title: 'Restore paused: GitHub is limiting downloads',
    reason: 'Cannot restore “Artwork-C” (issues/issue-1.media/asset-c-Artwork-C.png): GitHub is temporarily limiting media downloads. Nothing was written.',
    recovery: 'No private-storage file was written. Wait at least 2 minutes and 5 seconds before choosing Retry restore. Your preview and selected files are still available.',
  });
  assert.doesNotMatch(notice.reason, /x-ratelimit|retry-after|provider detail/i);
});

test('rate-limited GitHub restores give conservative guidance if no retry interval was provided', () => {
  const notice = getMediaRestoreFailureNotice({
    status: 429,
    data: { code: 'GITHUB_MEDIA_RATE_LIMITED' },
  });
  assert.match(notice.recovery, /wait a few minutes/i);
});

test('unrelated API errors stay on the normal failure path', () => {
  assert.equal(getMediaRestoreFailureNotice({
    status: 409,
    data: { error: 'The GitHub branch changed after preview.' },
  }), null);
});
