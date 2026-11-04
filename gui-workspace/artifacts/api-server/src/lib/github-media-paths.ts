import { createHash } from "node:crypto";
import type { GitHubMediaTransferFile } from "@workspace/api-zod";

export const MAX_MEDIA_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_MEDIA_TRANSFER_BYTES = 50 * 1024 * 1024;
export const MAX_MEDIA_FILES = 50;

const SUPPORTED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "application/pdf",
  "text/plain",
  "application/octet-stream",
]);

export function isSupportedMediaType(contentType: string): boolean {
  return SUPPORTED_CONTENT_TYPES.has(contentType);
}

function startsWithAscii(bytes: Buffer, value: string): boolean {
  return bytes.length >= value.length && bytes.subarray(0, value.length).toString("ascii") === value;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isJpeg(bytes: Buffer): boolean {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return false;
  }

  let offset = 2;
  let hasFrame = false;
  let hasScan = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) return hasFrame && hasScan && offset === bytes.length;
    if (marker === 0xd8 || marker === 0x00) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return false;

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return false;
    const segmentEnd = offset + segmentLength;
    const isFrameMarker = (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isFrameMarker) {
      if (segmentLength < 8 || bytes.readUInt16BE(offset + 3) === 0 || bytes.readUInt16BE(offset + 5) === 0) {
        return false;
      }
      hasFrame = true;
    }
    if (marker === 0xda) {
      if (!hasFrame || segmentLength < 6) return false;
      hasScan = true;
      offset = segmentEnd;
      while (offset < bytes.length - 1) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        if (bytes[offset + 1] === 0x00 || (bytes[offset + 1] >= 0xd0 && bytes[offset + 1] <= 0xd7)) {
          offset += 2;
          continue;
        }
        break;
      }
    } else {
      offset = segmentEnd;
    }
  }
  return false;
}

function isPng(bytes: Buffer): boolean {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return false;

  let offset = PNG_SIGNATURE.length;
  let hasHeader = false;
  let hasImageData = false;
  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    if (chunkLength > bytes.length - offset - 12) return false;
    const chunkType = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkStart = offset + 8;
    if (!hasHeader) {
      if (chunkType !== "IHDR" || chunkLength !== 13) return false;
      if (bytes.readUInt32BE(chunkStart) === 0 || bytes.readUInt32BE(chunkStart + 4) === 0) return false;
      hasHeader = true;
    } else if (chunkType === "IHDR") {
      return false;
    }
    if (chunkType === "IDAT") hasImageData = true;
    offset += chunkLength + 12;
    if (chunkType === "IEND") {
      return chunkLength === 0 && hasHeader && hasImageData && offset === bytes.length;
    }
  }
  return false;
}

function isWebp(bytes: Buffer): boolean {
  if (bytes.length < 20 || !startsWithAscii(bytes, "RIFF") ||
      bytes.subarray(8, 12).toString("ascii") !== "WEBP" ||
      bytes.readUInt32LE(4) !== bytes.length - 8) {
    return false;
  }
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.subarray(offset, offset + 4).toString("ascii");
    const chunkLength = bytes.readUInt32LE(offset + 4);
    if (chunkLength > bytes.length - offset - 8) return false;
    const chunkStart = offset + 8;
    if (chunkType === "VP8 " && chunkLength >= 10 &&
        bytes[chunkStart + 3] === 0x9d && bytes[chunkStart + 4] === 0x01 && bytes[chunkStart + 5] === 0x2a) {
      hasImageChunk = true;
    } else if (chunkType === "VP8L" && chunkLength >= 5 && bytes[chunkStart] === 0x2f) {
      hasImageChunk = true;
    } else if (chunkType === "VP8X" && chunkLength === 10) {
      hasImageChunk = true;
    }
    offset += 8 + chunkLength + (chunkLength % 2);
  }
  return hasImageChunk && offset === bytes.length;
}

function isGif(bytes: Buffer): boolean {
  if (bytes.length < 14 || !(startsWithAscii(bytes, "GIF87a") || startsWithAscii(bytes, "GIF89a")) ||
      bytes.readUInt16LE(6) === 0 || bytes.readUInt16LE(8) === 0 || bytes[bytes.length - 1] !== 0x3b) {
    return false;
  }

  const screenFlags = bytes[10];
  let offset = 13;
  if (screenFlags & 0x80) offset += 3 * (1 << ((screenFlags & 0x07) + 1));
  let hasImage = false;
  while (offset < bytes.length - 1) {
    const blockType = bytes[offset++];
    if (blockType === 0x21) {
      if (offset >= bytes.length) return false;
      offset++;
      while (offset < bytes.length) {
        const size = bytes[offset++];
        if (size === 0) break;
        offset += size;
        if (offset > bytes.length) return false;
      }
    } else if (blockType === 0x2c) {
      if (offset + 9 > bytes.length) return false;
      const imageFlags = bytes[offset + 8];
      if (bytes.readUInt16LE(offset + 4) === 0 || bytes.readUInt16LE(offset + 6) === 0) return false;
      offset += 9;
      if (imageFlags & 0x80) offset += 3 * (1 << ((imageFlags & 0x07) + 1));
      if (offset >= bytes.length) return false;
      offset++; // LZW minimum code size
      while (offset < bytes.length) {
        const size = bytes[offset++];
        if (size === 0) break;
        offset += size;
        if (offset > bytes.length) return false;
      }
      hasImage = true;
    } else {
      return false;
    }
  }
  return hasImage && offset === bytes.length - 1;
}

function isTiff(bytes: Buffer): boolean {
  if (bytes.length < 14) return false;
  const littleEndian = bytes[0] === 0x49 && bytes[1] === 0x49;
  const bigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!littleEndian && !bigEndian) return false;
  const magic = littleEndian ? bytes.readUInt16LE(2) : bytes.readUInt16BE(2);
  const ifdOffset = littleEndian ? bytes.readUInt32LE(4) : bytes.readUInt32BE(4);
  if (magic !== 42 || ifdOffset < 8 || ifdOffset + 2 > bytes.length) return false;
  const entryCount = littleEndian ? bytes.readUInt16LE(ifdOffset) : bytes.readUInt16BE(ifdOffset);
  return ifdOffset + 2 + entryCount * 12 + 4 <= bytes.length;
}

function imageTypeFromBytes(bytes: Buffer): string | null {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  if (isGif(bytes)) return "image/gif";
  if (isTiff(bytes)) return "image/tiff";
  return null;
}

function hasKnownFileSignature(bytes: Buffer): boolean {
  return (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) ||
    (bytes.length >= 12 && startsWithAscii(bytes, "RIFF") && bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
    startsWithAscii(bytes, "GIF87a") ||
    startsWithAscii(bytes, "GIF89a") ||
    (bytes.length >= 4 &&
      ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
       (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))) ||
    startsWithAscii(bytes, "%PDF-");
}

function isPdf(bytes: Buffer): boolean {
  return bytes.length >= 8 &&
    /^%PDF-(?:1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString("ascii")) &&
    /startxref\s+\d+\s+%%EOF\s*$/.test(bytes.subarray(Math.max(0, bytes.length - 1024)).toString("latin1"));
}

function textContent(bytes: Buffer): string | null {
  if (bytes.length === 0) return null;

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    for (const character of text) {
      const codePoint = character.codePointAt(0)!;
      if ((codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0c && codePoint !== 0x0d) ||
          (codePoint >= 0x7f && codePoint <= 0x9f)) {
        return null;
      }
    }
    return text;
  } catch {
    return null;
  }
}

function isPlainText(bytes: Buffer): boolean {
  const text = textContent(bytes);
  if (text === null) return false;
  let leadingText = text.replace(/^\uFEFF/, "").trimStart();
  for (let index = 0; index < 8; index++) {
    const stripped = leadingText
      .replace(/^(?:<!--[\s\S]*?-->\s*|<\?xml\b[\s\S]{0,1024}?\?>\s*)/i, "")
      .trimStart();
    if (stripped === leadingText) break;
    leadingText = stripped;
  }
  return !/^(?:<!doctype\s+html\b|<(?:html|head|body|title|script|style|link|meta|iframe|frameset|object|embed|svg)(?:\s|\/?>))/i
    .test(leadingText.slice(0, 4096));
}

/**
 * Confirms that the declared safe media type is plausible for the actual
 * payload. The octet-stream type is reserved for opaque binary data rather
 * than text or data with a recognizable supported file signature.
 */
export function matchesDeclaredMediaType(bytes: Buffer, contentType: string): boolean {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return false;
  if (!isSupportedMediaType(contentType)) return false;

  const detectedImageType = imageTypeFromBytes(bytes);
  if (contentType.startsWith("image/")) return detectedImageType === contentType;
  if (contentType === "application/pdf") return isPdf(bytes);
  if (contentType === "text/plain") return detectedImageType === null && !hasKnownFileSignature(bytes) && isPlainText(bytes);

  return contentType === "application/octet-stream" &&
    !hasKnownFileSignature(bytes) &&
    textContent(bytes) === null;
}

export function matchesGitBlobSha(bytes: Buffer, expectedSha: string): boolean {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  const sha1 = createHash("sha1").update(header).update(bytes).digest("hex");
  const sha256 = createHash("sha256").update(header).update(bytes).digest("hex");
  return expectedSha === sha1 || expectedSha === sha256;
}

function safeNamePart(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 72);
  return safe || "asset";
}

function extensionForType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "image/tiff": return "tif";
    case "application/pdf": return "pdf";
    case "text/plain": return "txt";
    default: return "bin";
  }
}

export function getMediaDirectory(issuePath: string): string {
  return issuePath.replace(/\.json$/i, ".media");
}

export function getRepositoryMediaPath(
  issuePath: string,
  asset: { id: string; name: string; contentType: string },
): string {
  return `${getMediaDirectory(issuePath)}/${safeNamePart(asset.id)}-${safeNamePart(asset.name)}.${extensionForType(asset.contentType)}`;
}

export type MediaFingerprint = {
  assetId: string;
  path: string;
  status: GitHubMediaTransferFile["status"];
  localSha256: string | null;
  remoteSha256: string | null;
  remoteBlobSha: string | null;
};

export type MediaSkippedFile = {
  assetId: string;
  assetName: string;
  reason: string;
};

export type MediaFileSelectionResult =
  | {
      ok: true;
      selectedFiles: GitHubMediaTransferFile[];
      skippedFiles: MediaSkippedFile[];
    }
  | { ok: false; error: string };

export function canSelectMediaFile(
  file: GitHubMediaTransferFile,
  direction: "to_repository" | "from_repository",
): boolean {
  return file.status === "ready" ||
    file.status === "already_current" ||
    (direction === "to_repository" && file.status === "remote_conflict");
}

export function resolveMediaFileSelection(
  files: GitHubMediaTransferFile[],
  selectedAssetIds: string[],
  direction: "to_repository" | "from_repository",
  replaceRemoteConflicts: boolean,
): MediaFileSelectionResult {
  if (selectedAssetIds.length === 0) {
    return { ok: false, error: "Select at least one eligible media file to transfer." };
  }

  const selectedIds = new Set(selectedAssetIds);
  if (selectedIds.size !== selectedAssetIds.length) {
    return { ok: false, error: "A media file was selected more than once." };
  }

  const matchesById = new Map<string, GitHubMediaTransferFile[]>();
  for (const file of files) {
    const matches = matchesById.get(file.assetId) ?? [];
    matches.push(file);
    matchesById.set(file.assetId, matches);
  }
  for (const assetId of selectedIds) {
    const matches = matchesById.get(assetId);
    if (!matches || matches.length !== 1) {
      return { ok: false, error: "The selected media file is not uniquely listed in this preview." };
    }
    const file = matches[0];
    if (!canSelectMediaFile(file, direction)) {
      return { ok: false, error: `“${file.assetName}” is not eligible for this transfer.` };
    }
    if (file.status === "remote_conflict" && !replaceRemoteConflicts) {
      return { ok: false, error: "Explicitly authorize replacing the selected conflicting GitHub files first." };
    }
  }

  const selectedFiles = files.filter(file => selectedIds.has(file.assetId));
  if (selectedFiles.length > MAX_MEDIA_FILES) {
    return { ok: false, error: `Select no more than ${MAX_MEDIA_FILES} files per transfer.` };
  }
  const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
  if (selectedBytes > MAX_MEDIA_TRANSFER_BYTES) {
    return { ok: false, error: "The selected files exceed the 50 MB combined transfer limit." };
  }

  const skippedFiles = files
    .filter(file => !selectedIds.has(file.assetId))
    .map(file => ({
      assetId: file.assetId,
      assetName: file.assetName,
      reason: canSelectMediaFile(file, direction)
        ? "Not selected for this transfer."
        : file.message || "This file is not eligible for this transfer.",
    }));

  return { ok: true, selectedFiles, skippedFiles };
}

export function makeMediaFingerprint(file: GitHubMediaTransferFile): MediaFingerprint {
  return {
    assetId: file.assetId,
    path: file.path,
    status: file.status,
    localSha256: file.localSha256,
    remoteSha256: file.remoteSha256,
    remoteBlobSha: file.remoteBlobSha,
  };
}

export function mediaFingerprintsMatch(
  expected: MediaFingerprint[],
  current: GitHubMediaTransferFile[],
): boolean {
  const normalize = (items: MediaFingerprint[]) => items.map(item => JSON.stringify(item)).sort();
  return JSON.stringify(normalize(expected)) === JSON.stringify(normalize(current.map(makeMediaFingerprint)));
}
