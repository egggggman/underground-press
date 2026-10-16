import { createHash } from "node:crypto";
import type {
  GitHubMediaTransferFile,
  GitHubMediaTransferPreview,
  GitHubMediaTransferSelection,
} from "@workspace/api-zod";
import {
  downloadGitHubBlob,
  GitHubRateLimitError,
  getGitHubBranchState,
  getGitHubIssueSnapshot,
  getGitHubRepositoryFile,
  type GitHubSelection,
  validateGitHubSelection,
} from "./github";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import { PressError, type Issue } from "./press-workflow";
import {
  getMediaDirectory,
  getRepositoryMediaPath,
  isSupportedMediaType,
  matchesDeclaredMediaType,
  matchesGitBlobSha,
  MAX_MEDIA_FILE_BYTES,
  MAX_MEDIA_FILES,
  MAX_MEDIA_TRANSFER_BYTES,
} from "./github-media-paths";

type MediaAsset = Issue["assets"][number];

export const GITHUB_MEDIA_TYPE_MISMATCH_MESSAGE =
  "GitHub returned media bytes that do not match the asset’s declared file type.";
export const GITHUB_MEDIA_DOWNLOAD_FAILED_CODE = "GITHUB_MEDIA_DOWNLOAD_FAILED";
export const GITHUB_MEDIA_RATE_LIMITED_CODE = "GITHUB_MEDIA_RATE_LIMITED";

export class GitHubMediaDownloadError extends Error {
  constructor(
    readonly assetName: string,
    readonly path: string,
    readonly reason: string,
    readonly rateLimited = false,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(reason);
    this.name = "GitHubMediaDownloadError";
  }
}

function mediaDownloadFailure(error: unknown): {
  reason: string;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
} {
  if (error instanceof GitHubRateLimitError) {
    return {
      reason: "GitHub is temporarily limiting media downloads.",
      rateLimited: true,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  if (error && typeof error === "object" && "rateLimited" in error && error.rateLimited === true) {
    const retryAfterSeconds = "retryAfterSeconds" in error &&
      typeof error.retryAfterSeconds === "number" &&
      Number.isSafeInteger(error.retryAfterSeconds) &&
      error.retryAfterSeconds >= 0
      ? error.retryAfterSeconds
      : null;
    return {
      reason: "GitHub is temporarily limiting media downloads.",
      rateLimited: true,
      retryAfterSeconds,
    };
  }
  const status = error instanceof PressError
    ? error.status
    : error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  return {
    reason: status === null
      ? "GitHub could not complete the selected file download."
      : `GitHub returned HTTP ${status} while delivering the selected file.`,
    rateLimited: false,
    retryAfterSeconds: null,
  };
}

export type MediaTransferWork = {
  preview: GitHubMediaTransferPreview;
  bytesByAssetId: Map<string, Buffer>;
  objectPathByAssetId: Map<string, string>;
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isSafeObjectPath(objectPath: string): boolean {
  return objectPath.startsWith("/objects/") &&
    !objectPath.includes("\\") &&
    !/[\u0000-\u001f]/.test(objectPath) &&
    objectPath.slice("/objects/".length).split("/").every(part => part && part !== "." && part !== "..");
}

type LocalFileResult =
  | { kind: "missing" }
  | { kind: "invalid"; size: number | null; message: string }
  | { kind: "present"; size: number; contentType: string; hash: string; bytes: Buffer };

async function readLocalFile(
  asset: MediaAsset,
  storage: ObjectStorageService,
): Promise<LocalFileResult> {
  if (!isSafeObjectPath(asset.objectPath)) {
    return { kind: "invalid", size: null, message: "The asset has an unsafe private-storage path." };
  }
  try {
    const file = await storage.getObjectEntityFile(asset.objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 0) {
      return { kind: "invalid", size: null, message: "Private storage returned an invalid file size." };
    }
    if (size > MAX_MEDIA_FILE_BYTES) {
      return { kind: "invalid", size, message: "The file exceeds the 20 MB per-file limit." };
    }
    const [bytes] = await file.download();
    if (bytes.length !== size) {
      return { kind: "invalid", size, message: "The stored file changed while it was being read." };
    }
    return {
      kind: "present",
      size,
      contentType: typeof metadata.contentType === "string" ? metadata.contentType : "application/octet-stream",
      hash: sha256(bytes),
      bytes,
    };
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return { kind: "missing" };
    throw error;
  }
}

export async function buildGitHubMediaTransferPreview(
  selection: GitHubMediaTransferSelection,
  localIssue: Issue,
  storage: ObjectStorageService,
  loadAssetIds: ReadonlySet<string> = new Set(),
): Promise<MediaTransferWork> {
  const gitHubSelection: GitHubSelection = selection;
  validateGitHubSelection(gitHubSelection);
  if (selection.revision !== localIssue.revision) {
    throw new PressError("The working copy changed before this media preview. Reload it and preview again.", 409);
  }

  const branch = await getGitHubBranchState(gitHubSelection);
  const blockers: string[] = [];
  let assets: MediaAsset[];
  if (selection.direction === "to_repository") {
    assets = localIssue.assets;
    if (!branch.pushAccess) blockers.push("The connected GitHub account does not have push access to this repository.");
  } else {
    const snapshot = await getGitHubIssueSnapshot(gitHubSelection);
    if (!snapshot.remoteIssue) {
      blockers.push(snapshot.remoteIssueError || "The selected GitHub JSON file is not a valid issue. Media restore needs its asset records as the file index.");
      assets = [];
    } else {
      assets = snapshot.remoteIssue.assets;
    }
  }

  if (assets.length === 0 && blockers.length === 0) {
    blockers.push(selection.direction === "to_repository"
      ? "The working copy has no asset records to back up."
      : "The selected GitHub issue has no asset records to restore.");
  }
  const mediaDirectory = getMediaDirectory(selection.path);
  const files: GitHubMediaTransferFile[] = [];
  const bytesByAssetId = new Map<string, Buffer>();
  const objectPathByAssetId = new Map<string, string>();
  const paths = new Set<string>();
  const assetIds = new Set<string>();
  let mediaPathConflict: string | null = null;
  const mediaPathSegments = mediaDirectory.split("/");
  for (let index = 1; index <= mediaPathSegments.length; index++) {
    const candidatePath = mediaPathSegments.slice(0, index).join("/");
    const entry = await getGitHubRepositoryFile(gitHubSelection, candidatePath, branch.headSha);
    if (entry.exists && !entry.directory) {
      mediaPathConflict = candidatePath;
      blockers.push(`${candidatePath}: this repository path is not a directory, so media files cannot be safely added below it.`);
      break;
    }
  }

  for (const asset of assets) {
    objectPathByAssetId.set(asset.id, asset.objectPath);
    const path = getRepositoryMediaPath(selection.path, asset);
    const file: GitHubMediaTransferFile = {
      assetId: asset.id,
      assetName: asset.name,
      path,
      contentType: asset.contentType,
      size: Number.isSafeInteger(asset.size) && asset.size >= 0 ? asset.size : 0,
      localSize: null,
      remoteSize: null,
      status: "invalid_record",
      localSha256: null,
      remoteSha256: null,
      remoteBlobSha: null,
      message: null,
    };
    files.push(file);

    if (assetIds.has(asset.id)) {
      file.status = "path_conflict";
      file.message = "Asset IDs must be unique within one issue.";
      continue;
    }
    assetIds.add(asset.id);

    if (paths.has(path)) {
      file.status = "path_conflict";
      file.message = "Two asset records map to the same repository file path.";
      continue;
    }
    paths.add(path);

    if (mediaPathConflict) {
      file.status = "path_conflict";
      file.message = `A repository path entry at ${mediaPathConflict} blocks the media directory.`;
      continue;
    }

    if (!asset.name.trim() || !isSafeObjectPath(asset.objectPath) ||
        !Number.isSafeInteger(asset.size) || asset.size <= 0) {
      file.message = "The asset record has a missing name, unsafe storage path, or invalid size.";
      continue;
    }
    if (!isSupportedMediaType(asset.contentType)) {
      file.status = "unsupported_type";
      file.message = "Use a raster image, PDF, plain text, or binary source file. Active HTML and SVG are not supported.";
      continue;
    }
    if (asset.size > MAX_MEDIA_FILE_BYTES) {
      file.status = "too_large";
      file.message = "The asset record exceeds the 20 MB per-file limit.";
      continue;
    }

    const remote = await getGitHubRepositoryFile(gitHubSelection, path, branch.headSha);
    file.remoteSize = remote.size;
    file.remoteBlobSha = remote.sha;
    if (remote.exists && !remote.regularFile) {
      file.status = "path_conflict";
      file.message = "The repository path is not a regular file.";
      continue;
    }
    if (remote.size !== null && remote.size > MAX_MEDIA_FILE_BYTES) {
      file.status = "too_large";
      file.message = "The repository file exceeds the 20 MB per-file limit.";
      continue;
    }

    let remoteBytes: Buffer | null = null;
    if (selection.direction === "from_repository" && remote.exists && remote.size !== asset.size) {
      file.status = "invalid_record";
      file.message = "Repository file size does not match the selected issue asset record.";
      continue;
    }
    if (selection.direction === "from_repository" && remote.exists && !remote.sha) {
      file.status = "invalid_record";
      file.message = "GitHub did not provide a file fingerprint.";
      continue;
    }
    if (selection.direction === "from_repository" && remote.exists && remote.sha && loadAssetIds.has(asset.id)) {
      try {
        remoteBytes = await downloadGitHubBlob(gitHubSelection, remote.sha);
      } catch (error) {
        const failure = mediaDownloadFailure(error);
        throw new GitHubMediaDownloadError(
          asset.name,
          path,
          failure.reason,
          failure.rateLimited,
          failure.retryAfterSeconds,
        );
      }
      if (remoteBytes.length !== remote.size) {
        throw new GitHubMediaDownloadError(
          asset.name,
          path,
          `GitHub returned an incomplete file (${remoteBytes.length} bytes received; ${remote.size} expected).`,
        );
      }
      if (!matchesDeclaredMediaType(remoteBytes, asset.contentType)) {
        file.status = "invalid_record";
        file.message = GITHUB_MEDIA_TYPE_MISMATCH_MESSAGE;
        continue;
      }
    }

    const local = await readLocalFile(asset, storage);
    if (local.kind === "present") {
      file.localSize = local.size;
      file.localSha256 = local.hash;
      if (local.size !== asset.size || local.contentType !== asset.contentType ||
          !matchesDeclaredMediaType(local.bytes, asset.contentType)) {
        file.status = "invalid_record";
        file.message = "Private file size, type, or bytes do not match the asset record.";
        continue;
      }
      if (selection.direction === "to_repository" && loadAssetIds.has(asset.id)) {
        bytesByAssetId.set(asset.id, local.bytes);
      }
    } else if (local.kind === "invalid") {
      file.localSize = local.size;
      file.status = "invalid_record";
      file.message = local.message;
      continue;
    }

    if (selection.direction === "to_repository") {
      if (local.kind === "missing") {
        file.status = "missing_local";
        file.message = "The private-storage file is unavailable.";
      } else if (!remote.exists) {
        file.status = "ready";
        file.message = "Ready to back up to GitHub.";
      } else {
        if (remote.sha && matchesGitBlobSha(local.bytes, remote.sha)) {
          file.status = "already_current";
          file.remoteSha256 = local.hash;
          file.message = "The repository copy already matches the stored file.";
        } else {
          file.status = "remote_conflict";
          file.message = "A different repository file already exists at this path.";
        }
      }
    } else {
      if (!remote.exists || !remote.sha) {
        file.status = "missing_remote";
        file.message = "No repository media file exists at this path.";
      } else if (local.kind === "present" && matchesGitBlobSha(local.bytes, remote.sha)) {
        file.remoteSha256 = local.hash;
        file.status = "already_current";
        file.message = "Private storage already contains the repository bytes.";
      } else if (local.kind === "present") {
        file.status = "storage_conflict";
        file.message = "A different file already exists at the private-storage path; it will not be overwritten.";
      } else {
        file.status = "ready";
        file.message = "Ready to restore into private storage.";
        if (remoteBytes) bytesByAssetId.set(asset.id, remoteBytes);
      }
    }
  }

  return {
    preview: {
      direction: selection.direction,
      owner: selection.owner,
      repo: selection.repo,
      branch: selection.branch,
      issuePath: selection.path,
      mediaDirectory,
      localRevision: localIssue.revision,
      headSha: branch.headSha,
      pushAccess: branch.pushAccess,
      repositoryPrivate: branch.private,
      maxFileBytes: MAX_MEDIA_FILE_BYTES,
      maxFiles: MAX_MEDIA_FILES,
      maxTransferBytes: MAX_MEDIA_TRANSFER_BYTES,
      files,
      blockers,
    },
    bytesByAssetId,
    objectPathByAssetId,
  };
}

