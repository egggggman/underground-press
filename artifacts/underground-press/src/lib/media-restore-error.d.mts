export interface MediaRestoreFailureNotice {
  title: string;
  reason: string;
  recovery: string;
}

export function getMediaRestoreFailureNotice(error: unknown): MediaRestoreFailureNotice | null;
