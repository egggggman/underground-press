const MEDIA_TYPE_MISMATCH_CODE = 'GITHUB_MEDIA_TYPE_MISMATCH';
const MEDIA_DOWNLOAD_FAILED_CODE = 'GITHUB_MEDIA_DOWNLOAD_FAILED';
const MEDIA_RATE_LIMITED_CODE = 'GITHUB_MEDIA_RATE_LIMITED';

function formatRetryWait(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds < 0) return null;
  if (seconds < 60) return `at least ${seconds} second${seconds === 1 ? '' : 's'}`;

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (remainingSeconds) parts.push(`${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`);
  return `at least ${parts.join(' and ')}`;
}

export function getMediaRestoreFailureNotice(error) {
  const data = error && typeof error === 'object' ? error.data : null;
  if (!data || ![MEDIA_TYPE_MISMATCH_CODE, MEDIA_DOWNLOAD_FAILED_CODE, MEDIA_RATE_LIMITED_CODE].includes(data.code)) return null;

  if (data.code === MEDIA_RATE_LIMITED_CODE) {
    const wait = formatRetryWait(data.retryAfterSeconds);
    return {
      title: 'Restore paused: GitHub is limiting downloads',
      reason: typeof data.error === 'string'
        ? data.error
        : `GitHub is temporarily limiting the download of “${typeof data.fileName === 'string' ? data.fileName : 'the selected file'}”. Nothing was written.`,
      recovery: wait
        ? `No private-storage file was written. Wait ${wait} before choosing Retry restore. Your preview and selected files are still available.`
        : 'No private-storage file was written. GitHub did not provide a retry interval, so wait a few minutes before choosing Retry restore. Your preview and selected files are still available.',
    };
  }

  if (data.code === MEDIA_DOWNLOAD_FAILED_CODE) {
    return {
      title: 'Restore stopped: GitHub could not deliver this file',
      reason: typeof data.error === 'string'
        ? data.error
        : `GitHub could not deliver “${typeof data.fileName === 'string' ? data.fileName : 'the selected file'}”. Nothing was written.`,
      recovery: 'No private-storage file was written. Your preview and selected files are still available. Choose Retry restore to try again; if it keeps failing, create a fresh preview and retry later.',
    };
  }

  return {
    title: 'Restore stopped: GitHub file type mismatch',
    reason: typeof data.error === 'string'
      ? data.error
      : 'The downloaded GitHub bytes do not match the asset’s declared file type.',
    recovery: 'Nothing was written. This preview is still available. Deselect this file and select a different one, or correct the GitHub copy and create a fresh preview before trying again.',
  };
}
