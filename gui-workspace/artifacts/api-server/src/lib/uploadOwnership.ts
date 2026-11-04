import { createHmac, timingSafeEqual } from 'crypto';

const UPLOAD_OWNER_PATH =
  /^\/objects\/uploads\/users\/([A-Za-z0-9_-]{43})\/([0-9a-f-]{36})$/i;

export function createUploadOwnerToken(ownerId: string, secret: string): string {
  if (!ownerId || !secret) {
    throw new Error('An owner and signing secret are required.');
  }
  return createHmac('sha256', secret).update(ownerId).digest('base64url');
}

export function isUploadObjectPath(objectPath: string): boolean {
  return UPLOAD_OWNER_PATH.test(objectPath);
}

export function isUploadObjectOwnedBy(
  objectPath: string,
  ownerId: string,
  secret: string,
): boolean {
  const match = UPLOAD_OWNER_PATH.exec(objectPath);
  if (!match || !ownerId || !secret) return false;

  const pathToken = Buffer.from(match[1]);
  const expectedToken = Buffer.from(createUploadOwnerToken(ownerId, secret));
  return (
    pathToken.length === expectedToken.length &&
    timingSafeEqual(pathToken, expectedToken)
  );
}
