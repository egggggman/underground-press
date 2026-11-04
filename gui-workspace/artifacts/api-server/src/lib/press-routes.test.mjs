import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";
import { deflateSync } from "node:zlib";
import { pageTwoAcceptance } from "./test-support/page-two-acceptance.mjs";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const pg = createRequire(new URL("../../../../lib/db/package.json", import.meta.url))("pg");

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name, data) {
  const type = Buffer.from(name, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(pngCrc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

function makePngBytes(seedText) {
  const seed = Buffer.from(seedText).reduce((sum, byte) => (sum + byte) % 254, 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = deflateSync(Buffer.from([0, seed, (seed + 73) % 256, (seed + 149) % 256, 255]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const mediaBytes = makePngBytes("asset-artwork");
const mismatchedMediaBytes = Buffer.alloc(mediaBytes.length, 0x41);

const pressStoreAdapter = `
  import { initialIssue } from "./press-seed.ts";
  import { ensureCurrentRevision } from "./press-workflow.ts";

  let issue = initialIssue();
  let mutationCount = 0;
  let lastActor = null;
  let mediaReplacementAudits = [];
  let mediaRestoreAudits = [];

  const copy = (value) => structuredClone(value);

  export function resetIssue() {
    issue = initialIssue();
    mutationCount = 0;
    lastActor = null;
    mediaReplacementAudits = [];
  }

  export function prepareEditorialApproval() {
    issue.pages[1].status = "in_review";
    issue.pages[1].copy = "Verified editorial copy for the authenticated sign-off test.";
    issue.pages[1].sourceIdentity = "test-editorial-source";
    issue.puzzles = [{
      id: "puzzle-2",
      title: "Test puzzle",
      kind: "crossword",
      source: "Test source",
      sourceIdentity: "Test puzzle source",
      solution: "Test solution",
      validation: "passed",
      validationNotes: "Checked.",
      reviewer: "Contributor",
      validationAt: "2026-01-01T00:00:00.000Z",
      validationAccountId: "test-reviewer",
      artworkId: "",
      pages: [2],
      provenance: "working_draft",
    }];
  }

  export function preparePageOneDocumentReview() {
    issue.pages[0].copy = "Authoritative recovered cover for the route authorization test.";
    issue.pages[0].provenance = "repository_reference";
    issue.pages[0].sourceIdentity = "owner/repository:issues/issue-1.json@" + "a".repeat(40);
    const referenceAsset = {
      id: "confirmed-front-page-reference-asset",
      name: "Original front-page reference image",
      objectPath: "/objects/confirmed-front-page-reference",
      contentType: "image/png",
      size: 17,
      caption: "Original front-page scan",
      credit: "Archive",
      source: "Issue #1 archive",
      provenance: "repository_reference",
      pages: [2],
      review: "approved",
      reviewer: "Casey Editor",
      reviewNotes: "Reference fixture only.",
      dpi: 300,
    };
    issue.assets = [...issue.assets, referenceAsset];
    issue.artDirection = {
      references: [{
        id: "confirmed-front-page-reference", version: 2, kind: "front_page",
        title: "Original front-page reference", assetId: referenceAsset.id, url: "",
        sourceIdentity: "Original archive scan — route fixture",
        at: "2026-01-01T00:00:00.000Z", suppliedBy: "assigned-editor",
        registrationNotes: "Registered original reference.",
        assetSnapshot: copy(referenceAsset),
        approval: {
          reviewer: "Casey Editor", reviewerAccountId: "assigned-editor", reviewerRole: "myrtle_editor",
          notes: "Confirmed reference identity only.", at: "2026-01-02T00:00:00.000Z",
        },
      }],
      history: [],
    };
    issue.pageSnapshots = [{
      id: "frozen-page-one-route-fixture", issueRevision: issue.revision, at: "2026-01-01T00:00:00.000Z",
      actor: "test-fixture", notes: "Existing immutable Page 1 snapshot.",
      page: copy(issue.pages[0]), puzzles: [], assets: [],
    }];
  }

  export function replaceConfirmedPageOneReferenceForTest(objectPath) {
    const previous = issue.artDirection.references.find((reference) => reference.kind === "front_page");
    issue.artDirection.history.push(copy(previous));
    const referenceAsset = {
      id: "replacement-front-page-reference-asset",
      name: "Replacement original front-page reference image",
      objectPath,
      contentType: "image/png",
      size: 17,
      caption: "Replacement archive scan",
      credit: "Archive",
      source: "Issue #1 archive",
      provenance: "repository_reference",
      pages: [2],
      review: "approved",
      reviewer: "Casey Editor",
      reviewNotes: "Replacement fixture only.",
      dpi: 300,
    };
    issue.assets = [...issue.assets, referenceAsset];
    const replacement = {
      ...copy(previous),
      id: "replacement-confirmed-front-page-reference",
      version: previous.version + 1,
      title: "Replacement original front-page reference",
      assetId: referenceAsset.id,
      url: "",
      sourceIdentity: "Replacement original archive scan",
      assetSnapshot: copy(referenceAsset),
    };
    issue.artDirection.references = [replacement];
    issue.artDirection.history.push(copy(replacement));
  }

  export function prepareMediaIssue(assetDefinitions = null) {
    issue = initialIssue();
    issue.revision = 17;
    issue.pages[0].copy = "Locked Page 1 copy for the media-boundary test.";
    issue.pages[0].sourceIdentity = "page-1-source:test-fixture";
    issue.pages[1].copy = "Approved Page 2 copy for the media-boundary test.";
    issue.pages[1].sourceIdentity = "page-2-source:test-fixture";
    issue.pages[1].status = "approved";
    issue.pages[1].editorialApproval = {
      reviewer: "Myrtle Editor",
      reviewerAccountId: "assigned-editor",
      reviewerRole: "myrtle_editor",
      notes: "Editorial review fixture.",
      at: "2026-01-01T00:00:00.000Z",
    };
    issue.pages[1].artApproval = {
      reviewer: "Contributor",
      notes: "Artwork review fixture.",
      at: "2026-01-02T00:00:00.000Z",
    };
    issue.assets = [{
      id: "asset-artwork",
      name: "Artwork Page 2",
      objectPath: "/objects/asset-artwork",
      contentType: "image/png",
      size: ${mediaBytes.length},
      caption: "Approved artwork",
      credit: "Artist Credit",
      source: "Artwork Source",
      provenance: "uploaded_unverified",
      pages: [2],
      review: "approved",
      reviewer: "Contributor",
      reviewNotes: "Artwork review fixture.",
      dpi: 300,
    }];
    if (assetDefinitions) {
      issue.assets = assetDefinitions.map(({ id, name, contentType, size }) => ({
        id,
        name,
        objectPath: "/objects/" + id,
        contentType,
        size,
        caption: name + " caption",
        credit: "Test artist",
        source: "Test source",
        provenance: "uploaded_unverified",
        pages: [2],
        review: "approved",
        reviewer: "Contributor",
        reviewNotes: "Artwork review fixture.",
        dpi: 300,
      }));
    }
    issue.puzzles = [{
      id: "puzzle-2",
      title: "Reviewed crossword",
      kind: "crossword",
      source: "Puzzle Source",
      sourceIdentity: "puzzle-source:test-fixture",
      solution: "Reviewed solution",
      validation: "passed",
      validationNotes: "Puzzle validation fixture.",
      reviewer: "Puzzle Reviewer",
      validationAt: "2026-01-03T00:00:00.000Z",
      validationAccountId: "puzzle-reviewer",
      artworkId: "asset-artwork",
      pages: [2],
      provenance: "working_draft",
    }];
    mutationCount = 0;
    lastActor = null;
    mediaReplacementAudits = [];
    mediaRestoreAudits = [];
    return copy(issue);
  }

  export function prepareStyleReviewIssue() {
    prepareMediaIssue();
    const references = [
      {
        id: "golden-image-v1",
        version: 1,
        kind: "golden_image",
        title: "Golden Image v1",
        assetId: "",
        url: "https://example.org/golden-image-v1",
        sourceIdentity: "archive/golden-image-v1",
        at: "2026-01-01T00:00:00.000Z",
        suppliedBy: "test-editor",
        approval: null,
      },
      {
        id: "front-page-v1",
        version: 1,
        kind: "front_page",
        title: "Front-page benchmark v1",
        assetId: "",
        url: "https://example.org/front-page-v1",
        sourceIdentity: "archive/front-page-v1",
        at: "2026-01-01T00:00:00.000Z",
        suppliedBy: "test-editor",
        approval: null,
      },
    ];
    issue.artDirection = { references: copy(references), history: copy(references) };
    return copy(issue);
  }

  export function getMutationCount() {
    return mutationCount;
  }

  export function getLastActor() {
    return lastActor;
  }

  export async function getIssue() {
    return copy(issue);
  }

  export async function mutateIssue(revision, action, actor, change) {
    ensureCurrentRevision(issue.revision, revision);
    issue = change(copy(issue));
    mutationCount += 1;
    lastActor = actor;
    return copy(issue);
  }

  export async function getVersion() {
    return null;
  }

  export async function listVersions() {
    return [];
  }

  export async function recordGitHubMediaReplacement(replacement) {
    const record = { id: mediaReplacementAudits.length + 1, at: new Date(), ...copy(replacement) };
    mediaReplacementAudits.push(record);
    return copy(record);
  }

  export async function listGitHubMediaReplacementAudits() {
    return copy([...mediaReplacementAudits].reverse());
  }

  export async function recordGitHubMediaRestore(restore) {
    const record = { id: mediaRestoreAudits.length + 1, at: new Date().toISOString(), ...copy(restore) };
    mediaRestoreAudits.push(record);
    return copy(record);
  }

  export async function listGitHubMediaRestores() {
    return copy([...mediaRestoreAudits].reverse().map(({ accountId, ...record }) => ({
      ...record,
      actorDisplayName: accountId === "media-editor"
        ? "Media Editor"
        : accountId === "media-admin"
          ? "Newsroom Administrator"
          : "Authenticated newsroom account",
    })));
  }

  export async function withIssueRevisionLock(revision, action) {
    ensureCurrentRevision(issue.revision, revision);
    return action(copy(issue));
  }
`;

const authAdapter = `
  const sessions = new Map();

  export function addTestSession(sid, user) {
    sessions.set(sid, {
      user,
      access_token: "test-access-token",
      expires_at: 9999999999,
    });
  }

  export function getSessionId(req) {
    const authorization = req.headers.authorization;
    return authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  }

  export async function getSession(sid) {
    return sessions.get(sid) ?? null;
  }

  export async function updateSession() {}
  export async function getOidcConfig() {
    throw new Error("OIDC should not be contacted by this test.");
  }
  export async function clearSession(res, sid) {
    if (sid) sessions.delete(sid);
    res.clearCookie("sid", { path: "/" });
  }
`;

const databasePressTestAdapter = `
  import { createSession, deleteSession } from "./auth.ts";
  import { getIssue, listVersions, recordGitHubMediaRestore } from "./press-store.ts";
  import {
    db,
    myrtleEditorAssignmentsTable,
    pressGitHubMediaRestoresTable,
    pressIssuesTable,
    pool,
    sessionsTable,
    usersTable,
  } from "@workspace/db";
  import { eq, inArray } from "drizzle-orm";

  export async function createPersistentSession(accountId) {
    return createSession({
      user: { id: accountId },
      access_token: "test-access-token",
      expires_at: 9999999999,
    });
  }

  export async function deletePersistentSession(sid) {
    return deleteSession(sid);
  }

  export async function getPersistentIssue() {
    return getIssue();
  }

  export async function savePersistentIssue(issue) {
    await db.update(pressIssuesTable)
      .set({ document: issue })
      .where(eq(pressIssuesTable.id, 1));
  }

  export async function listPersistentVersions() {
    return listVersions();
  }

  export async function recordPersistentRestore(restore) {
    return recordGitHubMediaRestore(restore);
  }

  export async function assignPersistentEditor(accountId) {
    await db.insert(usersTable).values({
      id: accountId,
      email: accountId + "@example.test",
      firstName: "Restore",
      lastName: "Editor",
    });
    await db.insert(myrtleEditorAssignmentsTable).values({
      accountId,
      enabled: true,
      changedBy: accountId,
    });
  }

  export async function cleanupPersistentRestoreTest({ auditIds, sessionIds, accountIds }) {
    if (auditIds.length) {
      await db.delete(pressGitHubMediaRestoresTable)
        .where(inArray(pressGitHubMediaRestoresTable.id, auditIds));
    }
    if (sessionIds.length) {
      await db.delete(sessionsTable).where(inArray(sessionsTable.sid, sessionIds));
    }
    if (accountIds.length) {
      await db.delete(myrtleEditorAssignmentsTable)
        .where(inArray(myrtleEditorAssignmentsTable.accountId, accountIds));
      await db.delete(usersTable).where(inArray(usersTable.id, accountIds));
    }
  }

  export async function closeTestDatabase() {
    await pool.end();
  }
`;

const objectStorageAdapter = `
  const objects = new Map();
  const writes = [];
  const reads = [];
  const storageWriteFailures = new Map();
  let nextStorageWriteFailure;
  let nextStorageAclFailure;
  const aclAttempts = [];

  export class ObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
    }
  }

  export function resetTestStorage(files = []) {
    objects.clear();
    writes.length = 0;
    reads.length = 0;
    storageWriteFailures.clear();
    nextStorageWriteFailure = undefined;
    nextStorageAclFailure = undefined;
    aclAttempts.length = 0;
    for (const file of files) {
      objects.set(file.path, {
        bytes: Buffer.from(file.bytesBase64, "base64"),
        contentType: file.contentType,
        ownerId: file.ownerId ?? null,
      });
    }
  }

  export function getTestStorageWrites() {
    return writes.map((write) => ({ ...write }));
  }

  export function getTestStorageReads() {
    return [...reads];
  }

  export function getTestStorageBytes(path) {
    const object = objects.get(path);
    return object ? Buffer.from(object.bytes) : null;
  }

  export function deleteTestStorageObject(path) {
    objects.delete(path);
  }

  export function overwriteTestStorage(path, bytesBase64, contentType) {
    const object = objects.get(path);
    if (!object) throw new Error("Object does not exist.");
    object.bytes = Buffer.from(bytesBase64, "base64");
    object.contentType = contentType;
  }

  export function failStorageWrite(path, code = 500) {
    storageWriteFailures.set(path, code);
  }

  export function failNextStorageWrite(code = 500) {
    nextStorageWriteFailure = code;
  }

  export function failNextStorageAcl(code = 500) {
    nextStorageAclFailure = code;
  }

  export function getTestStorageAclAttempts() {
    return [...aclAttempts];
  }

  export class ObjectStorageService {
    async getObjectEntityFile(path) {
      reads.push(path);
      const object = objects.get(path);
      if (!object) throw new ObjectNotFoundError();
      return {
        getMetadata: async () => [{
          size: object.bytes.length,
          contentType: object.contentType,
        }],
        download: async () => [Buffer.from(object.bytes)],
      };
    }

    isUploadObjectPath(path) {
      return path.startsWith("/objects/uploads/users/") && path.split("/").length === 6;
    }

    isLegacyUploadObjectPath(path) {
      return path.startsWith("/objects/uploads/") && path.split("/").length === 4;
    }

    isObjectEntityUploadOwnedBy(path, ownerId) {
      return objects.get(path)?.ownerId === ownerId;
    }

    async trySetObjectEntityAclPolicy(path) {
      aclAttempts.push(path);
      if (nextStorageAclFailure !== undefined) {
        const failureCode = nextStorageAclFailure;
        nextStorageAclFailure = undefined;
        const error = new Error("Simulated private-storage ACL failure.");
        error.code = failureCode;
        throw error;
      }
      return path;
    }

    async saveObjectEntityAtPath(path, bytes, contentType) {
      const failureCode = storageWriteFailures.get(path) ?? nextStorageWriteFailure;
      if (failureCode !== undefined) {
        storageWriteFailures.delete(path);
        nextStorageWriteFailure = undefined;
        const error = new Error("Simulated private-storage write failure.");
        error.code = failureCode;
        throw error;
      }
      if (objects.has(path)) {
        const error = new Error("Object already exists.");
        error.code = 409;
        throw error;
      }
      const object = { bytes: Buffer.from(bytes), contentType };
      objects.set(path, object);
      writes.push({
        path,
        bytesBase64: object.bytes.toString("base64"),
        contentType,
      });
    }
  }
`;

const pressRoleStoreAdapter = `
  import { hasMyrtleEditorRole } from "./press-roles.ts";
  export async function isMyrtleEditorAssigned(accountId) {
    return hasMyrtleEditorRole(accountId);
  }
`;

const githubMediaAdapter = `
  export const GITHUB_MEDIA_TYPE_MISMATCH_MESSAGE =
    "GitHub returned media bytes that do not match the asset’s declared file type.";
  export const GITHUB_MEDIA_DOWNLOAD_FAILED_CODE = "GITHUB_MEDIA_DOWNLOAD_FAILED";
  export const GITHUB_MEDIA_RATE_LIMITED_CODE = "GITHUB_MEDIA_RATE_LIMITED";
  export class GitHubMediaDownloadError extends Error {
    constructor(assetName, path, reason, rateLimited = false, retryAfterSeconds = null) {
      super(reason);
      this.assetName = assetName;
      this.path = path;
      this.reason = reason;
      this.rateLimited = rateLimited;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  export async function buildGitHubMediaTransferPreview() {
    throw new Error("GitHub media should not be contacted by this test.");
  }
`;

const githubAdapter = `
  import { createHash } from "node:crypto";
  export class GitHubRateLimitError extends Error {
    constructor(retryAfterSeconds) {
      super("GitHub rate-limited the media download.");
      this.status = 429;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  export function checkGitHubPreviewVersion() {
    throw new Error("GitHub should not be contacted by this test.");
  }
  const HEAD_SHA = "1".repeat(40);
  const MEDIA_COMMIT_SHA = "2".repeat(40);
  let remoteIssue = null;
  let repositoryFiles = new Map();
  let blobs = new Map();
  let blobDownloadFailures = new Map();
  const calls = {
    branchReads: 0,
    issueSnapshotReads: 0,
    repositoryReads: [],
    blobDownloads: [],
    mediaCommits: [],
    issueCommits: 0,
    failMediaCommit: false,
  };

  export function configureGitHubMedia({
    issue = null,
    files = [],
    downloadFailures = [],
    failMediaCommit = false,
  }) {
    remoteIssue = issue ? structuredClone(issue) : null;
    repositoryFiles = new Map();
    blobs = new Map();
    blobDownloadFailures = new Map();
    calls.branchReads = 0;
    calls.issueSnapshotReads = 0;
    calls.repositoryReads = [];
    calls.blobDownloads = [];
    calls.mediaCommits = [];
    calls.issueCommits = 0;
    for (const failure of downloadFailures) {
      blobDownloadFailures.set(failure.sha, failure);
    }
    calls.failMediaCommit = failMediaCommit;
    for (const file of files) {
      const bytes = Buffer.from(file.bytesBase64, "base64");
      repositoryFiles.set(file.path, {
        exists: true,
        regularFile: true,
        directory: false,
        sha: file.sha,
        size: bytes.length,
      });
      blobs.set(file.sha, bytes);
    }
  }

  export function getGitHubMediaCalls() {
    return structuredClone(calls);
  }

  export function getGitHubMediaFiles() {
    return [...repositoryFiles.entries()]
      .map(([path, entry]) => ({
        path,
        sha: entry.sha,
        size: entry.size,
        bytesBase64: entry.sha ? blobs.get(entry.sha)?.toString("base64") ?? null : null,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  export async function createGitHubIssueCommit() {
    calls.issueCommits += 1;
    throw new Error("GitHub should not be contacted by this test.");
  }
  export async function createGitHubMediaCommit(_selection, expectedHeadSha, files, message) {
    calls.mediaCommits.push({
      expectedHeadSha,
      message,
      files: files.map((file) => ({
        path: file.path,
        bytesBase64: file.bytes.toString("base64"),
      })),
    });
    if (calls.failMediaCommit) throw new Error("Simulated GitHub commit failure.");
    for (const file of files) {
      const header = Buffer.from("blob " + file.bytes.length + "\0", "utf8");
      const sha = createHash("sha1").update(header).update(file.bytes).digest("hex");
      repositoryFiles.set(file.path, {
        exists: true,
        regularFile: true,
        directory: false,
        sha,
        size: file.bytes.length,
      });
      blobs.set(sha, Buffer.from(file.bytes));
    }
    return MEDIA_COMMIT_SHA;
  }
  export async function getGitHubIdentity() {
    throw new Error("GitHub should not be contacted by this test.");
  }
  export async function getGitHubIssueSnapshot() {
    calls.issueSnapshotReads += 1;
    if (!remoteIssue) throw new Error("No remote issue was configured for this test.");
    return {
      headSha: HEAD_SHA,
      fileExists: true,
      blobSha: null,
      remoteIssue: structuredClone(remoteIssue),
      remoteIssueError: null,
      pushAccess: true,
    };
  }
  export async function listGitHubRepositories() {
    throw new Error("GitHub should not be contacted by this test.");
  }
  export function validateGitHubSelection(selection) {
    if (!selection.owner || !selection.repo || !selection.branch ||
        !selection.path.toLowerCase().endsWith(".json") ||
        !Number.isInteger(selection.revision) || selection.revision < 1) {
      throw new Error("Invalid test GitHub selection.");
    }
  }

  export async function getGitHubBranchState() {
    calls.branchReads += 1;
    return { headSha: HEAD_SHA, pushAccess: true, private: true };
  }

  export async function getGitHubRepositoryFile(_selection, path) {
    calls.repositoryReads.push(path);
    return repositoryFiles.get(path) ?? {
      exists: false,
      regularFile: false,
      directory: false,
      sha: null,
      size: null,
    };
  }

  export async function downloadGitHubBlob(_selection, sha) {
    calls.blobDownloads.push(sha);
    if (blobDownloadFailures.has(sha)) {
      const failure = blobDownloadFailures.get(sha);
      blobDownloadFailures.delete(sha);
      const error = new Error("GitHub download test failure.");
      error.status = failure.status;
      error.rateLimited = failure.rateLimited === true;
      error.retryAfterSeconds = failure.retryAfterSeconds ?? null;
      throw error;
    }
    const bytes = blobs.get(sha);
    if (!bytes) throw new Error("No test blob was configured.");
    return Buffer.from(bytes);
  }

`;

async function loadHttpHarness(outputDir, { useRealMedia = false, useDatabase = false, databaseUrl } = {}) {
  const databaseImports = useDatabase
    ? `
      import {
        assignPersistentEditor,
        cleanupPersistentRestoreTest,
        closeTestDatabase,
        createPersistentSession,
        deletePersistentSession,
        getPersistentIssue,
        listPersistentVersions,
        recordPersistentRestore,
        savePersistentIssue,
      } from "__database_test_adapter__";
    `
    : `import { addTestSession } from "__auth_test_adapter__";`;
  const storeImports = useDatabase
    ? ""
    : `
      import {
        getIssue,
        getLastActor,
        listGitHubMediaReplacementAudits,
        listGitHubMediaRestores,
        getMutationCount,
        prepareEditorialApproval,
         preparePageOneDocumentReview,
         replaceConfirmedPageOneReferenceForTest,
        prepareMediaIssue,
        prepareStyleReviewIssue,
        resetIssue,
      } from "__press_store_test_adapter__";
    `;
  const databaseExports = useDatabase
    ? `
      assignPersistentEditor,
      cleanupPersistentRestoreTest,
      closeTestDatabase,
      createPersistentSession,
      deletePersistentSession,
      getPersistentIssue,
      listPersistentVersions,
      recordPersistentRestore,
      savePersistentIssue,
    `
    : `
      addTestSession,
      getIssue,
      getLastActor,
      listGitHubMediaReplacementAudits,
      listGitHubMediaRestores,
      getMutationCount,
      prepareEditorialApproval,
      preparePageOneDocumentReview,
      replaceConfirmedPageOneReferenceForTest,
      prepareMediaIssue,
      prepareStyleReviewIssue,
      resetIssue,
    `;
  const entry = `
    import express from "express";
    import cookieParser from "cookie-parser";
    import pressRouter from "../routes/press.ts";
    import { authMiddleware } from "../middlewares/authMiddleware.ts";
    ${databaseImports}
    import {
      configureGitHubMedia,
      getGitHubMediaCalls,
      getGitHubMediaFiles,
    } from "__github_test_adapter__";
    import {
      getTestStorageBytes,
      getTestStorageAclAttempts,
      getTestStorageReads,
      getTestStorageWrites,
      overwriteTestStorage,
      deleteTestStorageObject,
      resetTestStorage,
      failStorageWrite,
      failNextStorageWrite,
      failNextStorageAcl,
    } from "__object_storage_test_adapter__";
    ${storeImports}

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(authMiddleware);
    app.use("/api", pressRouter);

    export {
      app,
      ${databaseExports}
      getGitHubMediaCalls,
      getGitHubMediaFiles,
      configureGitHubMedia,
      getTestStorageBytes,
      getTestStorageAclAttempts,
      getTestStorageReads,
      getTestStorageWrites,
      overwriteTestStorage,
      deleteTestStorageObject,
      resetTestStorage,
      failStorageWrite,
      failNextStorageWrite,
      failNextStorageAcl,
    };
  `;

  const adapters = new Map([
    ["press-store", pressStoreAdapter],
    ["auth", authAdapter],
    ["press-role-store", pressRoleStoreAdapter],
    ["database", databasePressTestAdapter],
    ["objectStorage", objectStorageAdapter],
    ["github-media", githubMediaAdapter],
    ["github", githubAdapter],
  ]);

  const result = await build({
    stdin: {
      contents: entry,
      resolveDir: sourceDir,
      sourcefile: "press-routes-http-test-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    define: databaseUrl ? { "process.env.DATABASE_URL": JSON.stringify(databaseUrl) } : undefined,
    external: ["node:*", "express", "openid-client", "cookie-parser"],
    banner: useDatabase ? {
      js: `import { createRequire as __bannerCrReq } from "node:module";
globalThis.require = __bannerCrReq(import.meta.url);
`,
    } : undefined,
    plugins: [{
      name: "press-http-test-adapters",
      setup(build) {
        if (!useDatabase) {
          build.onResolve({ filter: /^(?:\.\.\/lib\/)?press-store$/ }, () => ({
            path: "press-store",
            namespace: "press-http-test",
          }));
          build.onResolve({ filter: /^(?:\.\.\/lib\/)?auth$/ }, () => ({
            path: "auth",
            namespace: "press-http-test",
          }));
          build.onResolve({ filter: /^(?:\.\.\/lib\/)?press-role-store$/ }, () => ({
            path: "press-role-store",
            namespace: "press-http-test",
          }));
        }
        build.onResolve({ filter: /^(?:(?:\.\.\/lib\/)|(?:\.\/))?objectStorage$/ }, () => ({
          path: "objectStorage",
          namespace: "press-http-test",
        }));
        if (!useRealMedia) {
          build.onResolve({ filter: /github-media$/ }, () => ({
            path: "github-media",
            namespace: "press-http-test",
          }));
        }
        build.onResolve({ filter: /^(?:(?:\.\.\/lib\/)|(?:\.\/))?github$/ }, () => ({
          path: "github",
          namespace: "press-http-test",
        }));
        build.onResolve({ filter: /^\.\/github$/ }, () => ({
          path: "github",
          namespace: "press-http-test",
        }));
        build.onResolve({ filter: /^__press_store_test_adapter__$/ }, () => ({
          path: "press-store",
          namespace: "press-http-test",
        }));
        build.onResolve({ filter: /^__auth_test_adapter__$/ }, () => ({
          path: "auth",
          namespace: "press-http-test",
        }));
        build.onResolve({ filter: /^__github_test_adapter__$/ }, () => ({
          path: "github",
          namespace: "press-http-test",
        }));
        build.onResolve({ filter: /^__object_storage_test_adapter__$/ }, () => ({
          path: "objectStorage",
          namespace: "press-http-test",
        }));
        build.onResolve({ filter: /^__database_test_adapter__$/ }, () => ({
          path: "database",
          namespace: "press-http-test",
        }));
        build.onLoad({ filter: /.*/, namespace: "press-http-test" }, (args) => ({
          contents: adapters.get(args.path),
          loader: "ts",
          resolveDir: join(sourceDir, "..", "lib"),
        }));
      },
    }],
  });

  const bundlePath = join(outputDir, "press-routes-http-test.mjs");
  await writeFile(bundlePath, result.outputFiles[0].contents);
  return import(pathToFileURL(bundlePath).href);
}

test("Page 2 production acceptance uses isolated persisted sessions and immutable locks", async () => {
  await pageTwoAcceptance({ loadHttpHarness, mediaBytes, pg, sourceDir });
});

test("HTTP sign-off routes enforce Myrtle roles and use the authenticated reviewer", async () => {
  const originalEditorIds = process.env.MYRTLE_EDITOR_USER_IDS;
  process.env.MYRTLE_EDITOR_USER_IDS = "assigned-editor";
  const outputDir = await mkdtemp(join(sourceDir, ".press-routes-http-"));
  let server;

  try {
    const harness = await loadHttpHarness(outputDir);
    harness.resetIssue();
    harness.addTestSession("unassigned-session", {
      id: "unassigned-account",
      email: "unassigned@example.test",
      firstName: "Unauthorised",
      lastName: "Reviewer",
    });
    harness.addTestSession("assigned-session", {
      id: "assigned-editor",
      email: "editor@example.test",
      firstName: "Casey",
      lastName: "Editor",
    });

    server = await new Promise((resolve, reject) => {
      const listeningServer = harness.app.listen(0, "127.0.0.1", () => resolve(listeningServer));
      listeningServer.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const endpoint = `http://127.0.0.1:${address.port}/api/press`;

    const initialResponse = await fetch(`${endpoint}/issue`);
    assert.equal(initialResponse.status, 200);
    const initialIssue = await initialResponse.json();
    assert.equal(initialIssue.revision, 1);

    const signOffCommands = [
      { action: "approve_editorial", page: 2, reviewer: "Body-supplied name", notes: "Reviewed." },
      { action: "approve_proof", id: "proof-1", reviewer: "Body-supplied name", notes: "Reviewed." },
      {
        action: "verify_page_one_approval", referenceId: "missing-reference", checked: true, decision: "verified",
        approvalDocumentIdentity: "Original approval ledger, entry 1", notes: "Compared the original record with the cover.",
      },
    ];

    for (const command of signOffCommands) {
      const response = await fetch(`${endpoint}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer unassigned-session",
        },
        body: JSON.stringify({ revision: initialIssue.revision, ...command }),
      });
      assert.equal(response.status, 403, `${command.action} must reject an unassigned account`);

      const issueResponse = await fetch(`${endpoint}/issue`);
      const currentIssue = await issueResponse.json();
      assert.equal(currentIssue.revision, initialIssue.revision);
      assert.equal(harness.getMutationCount(), 0);
    }

    for (const command of signOffCommands) {
      const response = await fetch(`${endpoint}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: initialIssue.revision, ...command }),
      });
      assert.equal(response.status, 401, `${command.action} must reject an unauthenticated request`);
    }

    harness.prepareEditorialApproval();
    const preparedIssue = await harness.getIssue();
    const preparedPage = preparedIssue.pages.find((page) => page.number === 2);
    assert.equal(preparedPage.copy, "Verified editorial copy for the authenticated sign-off test.");
    assert.equal(preparedPage.sourceIdentity, "test-editorial-source");
    const approvedResponse = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer assigned-session",
      },
      body: JSON.stringify({
        revision: initialIssue.revision,
        action: "approve_editorial",
        page: 2,
        reviewer: "Body-supplied name",
        notes: "Verified in the HTTP test.",
      }),
    });
    assert.equal(approvedResponse.status, 200, await approvedResponse.clone().text());

    const approvedIssue = await approvedResponse.json();
    const approval = approvedIssue.pages.find((page) => page.number === 2).editorialApproval;
    assert.equal(approvedIssue.revision, initialIssue.revision + 1);
    assert.equal(approval.reviewer, "Casey Editor");
    assert.equal(approval.reviewerAccountId, "assigned-editor");
    assert.equal(approval.reviewerRole, "myrtle_editor");
    assert.equal(harness.getLastActor(), "assigned-editor");
    assert.equal(harness.getMutationCount(), 1);

    harness.preparePageOneDocumentReview();
    const originalReferencePath = "/objects/confirmed-front-page-reference";
    harness.resetTestStorage([{
      path: originalReferencePath,
      bytesBase64: Buffer.from("original-reference-image").toString("base64"),
      contentType: "image/png",
    }]);
    const beforeDocumentReview = await harness.getIssue();
    const preservedCover = structuredClone(beforeDocumentReview.pages[0]);
    const preservedAssets = structuredClone(beforeDocumentReview.assets);
    const preservedSnapshots = structuredClone(beforeDocumentReview.pageSnapshots);
    const preservedReferences = structuredClone(beforeDocumentReview.artDirection);
    const verificationResponse = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer assigned-session",
      },
      body: JSON.stringify({
        revision: beforeDocumentReview.revision,
        action: "verify_page_one_approval",
        referenceId: "confirmed-front-page-reference",
        checked: true,
        decision: "verified",
        approvalDocumentIdentity: "Issue #1 approval ledger, archival entry 1991-01",
        notes: "Compared the preserved masthead and issue title against the original approval entry.",
        reviewer: "Body-supplied Myrtle",
      }),
    });
    assert.equal(verificationResponse.status, 200, await verificationResponse.clone().text());
    const verifiedIssue = await verificationResponse.json();
    const verification = verifiedIssue.pageOneApprovalHistory[0];
    assert.equal(verifiedIssue.revision, beforeDocumentReview.revision + 1);
    assert.equal(verification.isCurrent, true);
    assert.equal(verification.reviewer, "Casey Editor");
    assert.equal(verification.reviewerAccountId, "assigned-editor");
    assert.notEqual(verification.reviewer, "Body-supplied Myrtle");
    assert.equal(verifiedIssue.artDirection.references[0].imageAvailable, true);
    assert.deepEqual(verifiedIssue.pages[0], preservedCover);
    assert.deepEqual(verifiedIssue.assets, preservedAssets);
    assert.deepEqual(verifiedIssue.pageSnapshots, preservedSnapshots);
    const responseReferences = structuredClone(verifiedIssue.artDirection);
    delete responseReferences.references[0].imageAvailable;
    assert.deepEqual(responseReferences, preservedReferences);
    assert.equal(verifiedIssue.pages[0].editorialApproval, null);
    assert.equal(verifiedIssue.pages[0].artApproval, null);
    assert.equal(harness.getLastActor(), "assigned-editor");
    assert.equal(harness.getMutationCount(), 2);

    const { isCurrent: _currentOnSave, staleReasons: _staleReasonsOnSave, ...savedVerification } = verification;
    harness.deleteTestStorageObject(originalReferencePath);

    const missingImageResponse = await fetch(`${endpoint}/issue`, {
      headers: { Authorization: "Bearer assigned-session" },
    });
    assert.equal(missingImageResponse.status, 200);
    const missingImageIssue = await missingImageResponse.json();
    assert.equal(missingImageIssue.artDirection.references[0].imageAvailable, false);
    assert.equal(missingImageIssue.pageOneApprovalHistory[0].isCurrent, false);
    assert.ok(missingImageIssue.pageOneApprovalHistory[0].staleReasons.includes("reference_image_unavailable"));

    const rawIssueAfterDeletion = await harness.getIssue();
    assert.deepEqual(rawIssueAfterDeletion.pageOneApprovalHistory, [savedVerification],
      "missing storage must not rewrite the saved historical verification");
    const blockedVerification = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer assigned-session",
      },
      body: JSON.stringify({
        revision: rawIssueAfterDeletion.revision,
        action: "verify_page_one_approval",
        referenceId: "confirmed-front-page-reference",
        checked: true,
        decision: "verified",
        approvalDocumentIdentity: "Issue #1 approval ledger, archival entry 1991-01",
        notes: "Compared the preserved masthead and issue title against the original approval entry.",
      }),
    });
    assert.equal(blockedVerification.status, 409);
    assert.match((await blockedVerification.json()).error, /image is unavailable/);
    assert.equal(harness.getMutationCount(), 2, "a missing reference image must not create a new verification");
    assert.deepEqual((await harness.getIssue()).pageOneApprovalHistory, [savedVerification]);

    const replacementReferencePath = "/objects/replacement-front-page-reference";
    harness.replaceConfirmedPageOneReferenceForTest(replacementReferencePath);
    harness.resetTestStorage([{
      path: replacementReferencePath,
      bytesBase64: Buffer.from("replacement-reference-image").toString("base64"),
      contentType: "image/png",
    }]);
    const replacementIssueResponse = await fetch(`${endpoint}/issue`, {
      headers: { Authorization: "Bearer assigned-session" },
    });
    const replacementIssue = await replacementIssueResponse.json();
    assert.equal(replacementIssue.artDirection.references[0].imageAvailable, true);
    const replacementVerificationResponse = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer assigned-session",
      },
      body: JSON.stringify({
        revision: replacementIssue.revision,
        action: "verify_page_one_approval",
        referenceId: "replacement-confirmed-front-page-reference",
        checked: true,
        decision: "verified",
        approvalDocumentIdentity: "Issue #1 approval ledger, archival entry 1991-01",
        notes: "Compared the replacement reference with the original approval entry and preserved cover.",
      }),
    });
    assert.equal(replacementVerificationResponse.status, 200, await replacementVerificationResponse.clone().text());
    const replacementVerifiedIssue = await replacementVerificationResponse.json();
    assert.equal(replacementVerifiedIssue.pageOneApprovalHistory.length, 2);
    const {
      isCurrent: _replacementOldCurrent,
      staleReasons: _replacementOldStaleReasons,
      ...preservedOldVerification
    } = replacementVerifiedIssue.pageOneApprovalHistory.find((record) => record.id === verification.id);
    assert.deepEqual(preservedOldVerification, savedVerification,
      "replacing the reference must retain earlier verification evidence unchanged");
    assert.equal(harness.getMutationCount(), 3);
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await rm(outputDir, { recursive: true, force: true });
    if (originalEditorIds === undefined) delete process.env.MYRTLE_EDITOR_USER_IDS;
    else process.env.MYRTLE_EDITOR_USER_IDS = originalEditorIds;
  }
});

test("HTTP style reviews reject a revision captured before a reference changed", async () => {
  const originalEditorIds = process.env.MYRTLE_EDITOR_USER_IDS;
  process.env.MYRTLE_EDITOR_USER_IDS = "style-review-editor";
  const outputDir = await mkdtemp(join(sourceDir, ".press-routes-style-review-"));
  let server;

  try {
    const harness = await loadHttpHarness(outputDir);
    harness.resetIssue();
    harness.addTestSession("style-review-session", {
      id: "style-review-editor",
      email: "style-review@example.test",
      firstName: "Style",
      lastName: "Editor",
    });
    const originalIssue = harness.prepareStyleReviewIssue();

    server = await new Promise((resolve, reject) => {
      const listeningServer = harness.app.listen(0, "127.0.0.1", () => resolve(listeningServer));
      listeningServer.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const endpoint = `http://127.0.0.1:${address.port}/api/press`;
    const commandRequest = async (command) => {
      const response = await fetch(`${endpoint}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer style-review-session",
        },
        body: JSON.stringify(command),
      });
      return { response, result: await response.json() };
    };

    const concurrentReferenceChange = await commandRequest({
      revision: originalIssue.revision,
      action: "set_art_reference",
      notes: "Registered the newly supplied original reference.",
      artReference: {
        kind: "golden_image",
        title: "Updated Golden Image",
        assetId: "",
        url: "https://example.org/golden-image-v2",
        sourceIdentity: "archive/golden-image-v2",
      },
    });
    assert.equal(concurrentReferenceChange.response.status, 200, JSON.stringify(concurrentReferenceChange.result));
    assert.notEqual(
      concurrentReferenceChange.result.artDirection.references.find((reference) => reference.kind === "golden_image").id,
      originalIssue.artDirection.references.find((reference) => reference.kind === "golden_image").id,
    );

    const staleStyleReview = await commandRequest({
      revision: originalIssue.revision,
      action: "review_asset_style",
      id: "asset-artwork",
      decision: "failed",
      checked: true,
      reviewer: "Style Editor",
      notes: "Compared the artwork against the references I saw.",
      styleChecks: {
        referenceMatch: true,
        spotInks: true,
        typography: true,
        inkIllustration: true,
        halftoneRegistration: true,
        boxedComposition: true,
        legibilityPrint: true,
        provenancePreserved: true,
      },
    });
    assert.equal(staleStyleReview.response.status, 409, JSON.stringify(staleStyleReview.result));
    assert.match(staleStyleReview.result.error, /changed in another session/i);

    const savedIssue = await harness.getIssue();
    assert.equal(savedIssue.revision, concurrentReferenceChange.result.revision);
    assert.equal(savedIssue.assets.find((asset) => asset.id === "asset-artwork").styleReview, undefined);
    assert.equal(harness.getMutationCount(), 1, "the rejected style review must not create a second issue mutation");
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await rm(outputDir, { recursive: true, force: true });
    if (originalEditorIds === undefined) delete process.env.MYRTLE_EDITOR_USER_IDS;
    else process.env.MYRTLE_EDITOR_USER_IDS = originalEditorIds;
  }
});

const mediaIssuePath = "issues/issue-1.json";
const mediaRepositoryPath = "issues/issue-1.media/asset-artwork-Artwork-Page-2.png";
const mediaObjectPath = "/objects/asset-artwork";
const mediaHeadSha = "1".repeat(40);
const mediaCommitSha = "2".repeat(40);
const mediaHeaders = {
  "Content-Type": "application/json",
  Authorization: "Bearer media-session",
};

function makeMediaAsset(id, name = id, contentType = "image/png", sizeBytes = null) {
  const bytes = sizeBytes === null
    ? makePngBytes(id)
    : Buffer.alloc(sizeBytes, 0xff);
  return { id, name, contentType, size: bytes.length, bytes };
}

function getMediaRepositoryPath(asset) {
  const extension = asset.contentType === "image/svg+xml" || asset.contentType === "application/octet-stream"
    ? "bin"
    : "png";
  return `issues/issue-1.media/${asset.id}-${asset.name}.${extension}`;
}

function localStorageFixtures(assets) {
  return assets
    .filter((asset) => asset.contentType !== "image/svg+xml")
    .map((asset) => ({
      path: `/objects/${asset.id}`,
      bytesBase64: asset.bytes.toString("base64"),
      contentType: asset.contentType,
    }));
}

function assertIssueReviewDataUnchanged(before, after) {
  assert.equal(after.revision, before.revision, "media transfer must not advance the issue revision");
  assert.deepEqual(after.pages[0], before.pages[0], "locked Page 1 must remain byte-for-byte unchanged");
  assert.deepEqual(
    after.pages.map(({ number, status, sourceIdentity, editorialApproval, artApproval }) => ({
      number, status, sourceIdentity, editorialApproval, artApproval,
    })),
    before.pages.map(({ number, status, sourceIdentity, editorialApproval, artApproval }) => ({
      number, status, sourceIdentity, editorialApproval, artApproval,
    })),
    "page approval and source data must remain unchanged",
  );
  assert.deepEqual(
    after.puzzles.map(({ id, validation, validationNotes, reviewer, source, sourceIdentity }) => ({
      id, validation, validationNotes, reviewer, source, sourceIdentity,
    })),
    before.puzzles.map(({ id, validation, validationNotes, reviewer, source, sourceIdentity }) => ({
      id, validation, validationNotes, reviewer, source, sourceIdentity,
    })),
    "puzzle validation and source data must remain unchanged",
  );
  assert.deepEqual(
    after.assets.map(({ id, review, reviewer, reviewNotes, source, credit }) => ({
      id, review, reviewer, reviewNotes, source, credit,
    })),
    before.assets.map(({ id, review, reviewer, reviewNotes, source, credit }) => ({
      id, review, reviewer, reviewNotes, source, credit,
    })),
    "artwork review, source, and credit data must remain unchanged",
  );
  assert.deepEqual(after, before, "media transfer must not change any issue fields");
}

async function withMediaRouteHarness(run, assetDefinitions = null) {
  const outputDir = await mkdtemp(join(sourceDir, ".press-media-routes-http-"));
  const originalEditorIds = process.env.MYRTLE_EDITOR_USER_IDS;
  const originalAdminIds = process.env.NEWSROOM_ADMIN_USER_IDS;
  process.env.MYRTLE_EDITOR_USER_IDS = "media-editor";
  process.env.NEWSROOM_ADMIN_USER_IDS = "media-admin";
  let server;
  try {
    const harness = await loadHttpHarness(outputDir, { useRealMedia: true });
    harness.prepareMediaIssue(assetDefinitions);
    harness.addTestSession("media-session", {
      id: "media-editor",
      email: "media-editor@example.test",
      firstName: "Media",
      lastName: "Editor",
    });
    harness.addTestSession("unassigned-media-session", { id: "unassigned-media-user" });
    harness.addTestSession("media-admin-session", { id: "media-admin" });
    server = await new Promise((resolve, reject) => {
      const listeningServer = harness.app.listen(0, "127.0.0.1", () => resolve(listeningServer));
      listeningServer.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run({
      harness,
      endpoint: `http://127.0.0.1:${address.port}/api/press`,
    });
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await rm(outputDir, { recursive: true, force: true });
    if (originalEditorIds === undefined) delete process.env.MYRTLE_EDITOR_USER_IDS;
    else process.env.MYRTLE_EDITOR_USER_IDS = originalEditorIds;
    if (originalAdminIds === undefined) delete process.env.NEWSROOM_ADMIN_USER_IDS;
    else process.env.NEWSROOM_ADMIN_USER_IDS = originalAdminIds;
  }
}

test("HTTP media restore history is restricted to newsroom editors and administrators", async () => {
  await withMediaRouteHarness(async ({ endpoint }) => {
    const anonymous = await requestMediaRestoreHistory(endpoint, null);
    assert.equal(anonymous.response.status, 401);

    const unassigned = await requestMediaRestoreHistory(endpoint, "unassigned-media-session");
    assert.equal(unassigned.response.status, 403);
    assert.match(unassigned.result.error, /newsroom editors and administrators/i);

    const editor = await requestMediaRestoreHistory(endpoint, "media-session");
    assert.equal(editor.response.status, 200);
    assert.deepEqual(editor.result.restores, []);

    const administrator = await requestMediaRestoreHistory(endpoint, "media-admin-session");
    assert.equal(administrator.response.status, 200);
  });
});

test("draft imports stay atomic across persisted editor sessions and protect their saved evidence", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  assert.ok(originalDatabaseUrl, "DATABASE_URL is required for the persisted-session integration test.");

  const { Pool } = pg;
  const adminPool = new Pool({ connectionString: originalDatabaseUrl });
  const outputDir = await mkdtemp(join(sourceDir, ".press-draft-imports-db-"));
  const schemaName = `press_import_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const editorAId = `draft-import-editor-a-${randomUUID()}`;
  const editorBId = `draft-import-editor-b-${randomUUID()}`;
  const clientActor = "client-forged-actor-must-never-be-saved";
  const privateReport = "PRIVATE_REPORTED_DESCRIPTION_MUST_NOT_BE_PUBLIC";
  const privatePageNotes = "PRIVATE_PAGE_SOURCE_NOTES_MUST_NOT_BE_PUBLIC";
  const privatePuzzleNotes = "PRIVATE_PUZZLE_SOURCE_NOTES_MUST_NOT_BE_PUBLIC";
  const privateReportedNotes = "PRIVATE_REPORTED_SOURCE_NOTES_MUST_NOT_BE_PUBLIC";
  const privateAnswer = "PRIVATE_PUZZLE_ANSWER_MUST_NOT_BE_PUBLIC";
  let schemaCreated = false;
  let server;
  let harness;

  try {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    const setup = await adminPool.connect();
    try {
      await setup.query(`SET search_path TO "${schemaName}", public`);
      await setup.query(`
        CREATE TABLE sessions (
          sid varchar PRIMARY KEY,
          sess jsonb NOT NULL,
          expire timestamp NOT NULL
        );
        CREATE TABLE press_issues (
          id integer PRIMARY KEY,
          document jsonb NOT NULL
        );
        CREATE TABLE press_versions (
          id serial PRIMARY KEY,
          revision integer NOT NULL,
          at timestamp with time zone NOT NULL DEFAULT now(),
          action text NOT NULL,
          actor text NOT NULL,
          document jsonb NOT NULL
        );
      `);
    } finally {
      setup.release();
    }

    const isolatedDatabaseUrl = new URL(originalDatabaseUrl);
    isolatedDatabaseUrl.searchParams.set("options", `-c search_path=${schemaName},public`);
    harness = await loadHttpHarness(outputDir, { useDatabase: true, databaseUrl: isolatedDatabaseUrl.toString() });

    server = await new Promise((resolve, reject) => {
      const listeningServer = harness.app.listen(0, "127.0.0.1", () => resolve(listeningServer));
      listeningServer.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const endpoint = `http://127.0.0.1:${address.port}/api/press`;

    const editorASession = await harness.createPersistentSession(editorAId);
    const editorBSession = await harness.createPersistentSession(editorBId);
    const issueRequest = async (session) => {
      const response = await fetch(`${endpoint}/issue`, {
        headers: session ? { Authorization: `Bearer ${session}` } : {},
      });
      return { response, issue: await response.json() };
    };
    const commandRequest = async (session, command) => {
      const response = await fetch(`${endpoint}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify(command),
      });
      return { response, issue: await response.json() };
    };

    const initial = await issueRequest(editorASession);
    assert.equal(initial.response.status, 200);
    assert.equal(initial.issue.revision, 2,
      "the seed's existing locked cover is preserved as an initial immutable snapshot before imports");
    assert.equal(initial.issue.pageSnapshots.length, 1,
      "the isolated issue begins with preserved locked evidence so snapshot immutability is exercised");
    assert.deepEqual(initial.issue.assets, [], "the test must not seed repository assets or verified artwork");
    const pageOneBefore = structuredClone(initial.issue.pages[0]);
    const snapshotsBefore = structuredClone(initial.issue.pageSnapshots ?? []);
    const pageTwoBefore = structuredClone(initial.issue.pages.find((page) => page.number === 2));

    // This is the editor A preview's bound revision and two-row batch.
    const stalePreviewRevision = initial.issue.revision;
    const staleBatch = {
      revision: stalePreviewRevision,
      action: "import_page_sources",
      checked: true,
      notes: "STALE_BATCH_NOTE_SHOULD_NOT_BE_SAVED",
      actor: clientActor,
      pageSources: [
        {
          page: 2,
          title: "CLIENT STALE PAGE 2",
          copy: "STALE_PAGE_2_COPY_MUST_NOT_BE_SAVED",
          sourceIdentity: "integration-test-only:not-repository-copy",
        },
        {
          page: 3,
          title: "CLIENT STALE PAGE 3",
          copy: "STALE_PAGE_3_COPY_MUST_NOT_BE_SAVED",
          sourceIdentity: "integration-test-only:not-repository-copy",
        },
      ],
    };

    const editorBChange = await commandRequest(editorBSession, {
      revision: stalePreviewRevision,
      action: "edit_page",
      page: 3,
      title: "TEST-ONLY concurrent draft",
      copy: "TEST-ONLY concurrent draft; no repository source or approval is claimed.",
      sourceIdentity: "integration-test-only:editor-b-draft",
      notes: privatePageNotes,
      actor: clientActor,
    });
    assert.equal(editorBChange.response.status, 200, JSON.stringify(editorBChange.issue));
    assert.equal(editorBChange.issue.pages.find((page) => page.number === 3).sourceEvidence.actor, editorBId);
    assert.notEqual(editorBChange.issue.pages.find((page) => page.number === 3).sourceEvidence.actor, clientActor);

    const rejectedBatch = await commandRequest(editorASession, staleBatch);
    assert.equal(rejectedBatch.response.status, 409, JSON.stringify(rejectedBatch.issue));
    assert.match(rejectedBatch.issue.error, /changed in another session/i);
    const afterRejectedBatch = await issueRequest(editorASession);
    assert.equal(afterRejectedBatch.response.status, 200);
    assert.equal(afterRejectedBatch.issue.revision, editorBChange.issue.revision);
    assert.deepEqual(afterRejectedBatch.issue.pages.find((page) => page.number === 2), pageTwoBefore,
      "the first row of the stale two-row batch must not partially save");
    assert.deepEqual(afterRejectedBatch.issue.pages.find((page) => page.number === 3),
      editorBChange.issue.pages.find((page) => page.number === 3),
      "the second editor's saved page must remain unchanged by the rejected batch");
    assert.deepEqual(afterRejectedBatch.issue.pages[0], pageOneBefore);
    assert.deepEqual(afterRejectedBatch.issue.pageSnapshots ?? [], snapshotsBefore);
    const versionsAfterRejection = await harness.listPersistentVersions();
    assert.deepEqual(versionsAfterRejection.map((version) => version.revision),
      [stalePreviewRevision + 1, stalePreviewRevision, 1],
      "a rejected stale batch must not create a persisted version");
    assert.doesNotMatch(JSON.stringify(afterRejectedBatch.issue), /STALE_PAGE_[23]_COPY_MUST_NOT_BE_SAVED|STALE_BATCH_NOTE_SHOULD_NOT_BE_SAVED/);

    const validPageImport = await commandRequest(editorASession, {
      revision: afterRejectedBatch.issue.revision,
      action: "import_page_sources",
      checked: true,
      notes: privatePageNotes,
      actor: clientActor,
      pageSources: [{
        page: 4,
        title: "TEST-ONLY imported draft",
        copy: "TEST-ONLY imported draft; no repository source or approval is claimed.",
        sourceIdentity: "integration-test-only:source-copy",
        sourceEvidence: { actor: clientActor, at: "forged-time", notes: "FORGED_SOURCE_RECEIPT" },
      }],
    });
    assert.equal(validPageImport.response.status, 200, JSON.stringify(validPageImport.issue));
    const importedPage = validPageImport.issue.pages.find((page) => page.number === 4);
    assert.equal(importedPage.provenance, "imported_unverified");
    assert.equal(importedPage.status, "draft");
    assert.equal(importedPage.sourceEvidence.actor, editorAId);
    assert.equal(importedPage.sourceEvidence.notes, privatePageNotes);
    assert.notEqual(importedPage.sourceEvidence.actor, clientActor);
    assert.equal(importedPage.editorialApproval, null);
    assert.equal(importedPage.artApproval, null);
    assert.equal(importedPage.printApproval, null);
    assert.deepEqual(validPageImport.issue.pages[0], pageOneBefore);
    assert.deepEqual(validPageImport.issue.pageSnapshots ?? [], snapshotsBefore);

    const validPuzzleImport = await commandRequest(editorBSession, {
      revision: validPageImport.issue.revision,
      action: "import_puzzle_inventory",
      checked: true,
      sourceIdentity: "integration-test-only:puzzle-inventory",
      notes: privatePuzzleNotes,
      actor: clientActor,
      puzzleInventory: [{
        id: "client-supplied-puzzle-id",
        title: "TEST-ONLY imported puzzle",
        kind: "logic",
        source: "TEST-ONLY puzzle prompt with no repository provenance.",
        solution: privateAnswer,
        validation: "passed",
        validationNotes: "CLIENT_FORGED_VALIDATION_NOTE",
        reviewer: "CLIENT_FORGED_REVIEWER",
        validationAt: "2000-01-01T00:00:00.000Z",
        validationAccountId: clientActor,
        artworkId: "",
        pages: [5],
        provenance: "repository_verified",
        sourceIdentity: "integration-test-only:single-puzzle",
        sourceEvidence: { actor: clientActor, at: "forged-time", notes: "FORGED_PUZZLE_RECEIPT" },
      }],
    });
    assert.equal(validPuzzleImport.response.status, 200, JSON.stringify(validPuzzleImport.issue));
    assert.equal(validPuzzleImport.issue.puzzles.length, 1);
    const importedPuzzle = validPuzzleImport.issue.puzzles[0];
    assert.notEqual(importedPuzzle.id, "client-supplied-puzzle-id");
    assert.equal(importedPuzzle.provenance, "imported_unverified");
    assert.equal(importedPuzzle.validation, "unvalidated");
    assert.equal(importedPuzzle.validationNotes, "");
    assert.equal(importedPuzzle.reviewer, "");
    assert.ok(!importedPuzzle.validationAt);
    assert.ok(!importedPuzzle.validationAccountId);
    assert.equal(importedPuzzle.sourceEvidence.actor, editorBId);
    assert.equal(importedPuzzle.sourceEvidence.notes, privatePuzzleNotes);
    assert.notEqual(importedPuzzle.sourceEvidence.actor, clientActor);
    assert.equal(importedPuzzle.solution, privateAnswer, "the authenticated editorial record retains its protected answer");
    assert.deepEqual(validPuzzleImport.issue.pages[0], pageOneBefore);
    assert.deepEqual(validPuzzleImport.issue.pageSnapshots ?? [], snapshotsBefore);

    const entries = Array.from({ length: 48 }, (_, index) => {
      if (index === 0) return `  ${privateReport}\noriginal whitespace stays exact  `;
      if (index === 47) return "";
      return `Reported source item #${index + 1} — exact integration-test fixture`;
    });
    const reportedImport = await commandRequest(editorASession, {
      revision: validPuzzleImport.issue.revision,
      action: "record_reported_preflight",
      checked: true,
      sourceIdentity: "integration-test-only:reported-list",
      notes: privateReportedNotes,
      actor: clientActor,
      reportedEntries: entries,
    });
    assert.equal(reportedImport.response.status, 200, JSON.stringify(reportedImport.issue));
    assert.deepEqual(reportedImport.issue.reportedPreflight.entries, entries);
    assert.equal(reportedImport.issue.reportedPreflight.entries.length, 48);
    assert.equal(reportedImport.issue.reportedPreflight.entries[47], "");
    assert.equal(reportedImport.issue.reportedPreflight.evidence.actor, editorAId);
    assert.equal(reportedImport.issue.reportedPreflight.evidence.notes, privateReportedNotes);
    assert.notEqual(reportedImport.issue.reportedPreflight.evidence.actor, clientActor);
    assert.deepEqual(reportedImport.issue.pages[0], pageOneBefore);
    assert.deepEqual(reportedImport.issue.pageSnapshots ?? [], snapshotsBefore);

    await harness.deletePersistentSession(editorASession);
    const revoked = await issueRequest(editorASession);
    assert.equal(revoked.response.status, 200);
    assert.equal(revoked.issue.reportedPreflight, undefined,
      "the deleted saved session must no longer expose the protected report");
    const freshEditorASession = await harness.createPersistentSession(editorAId);
    const freshReload = await issueRequest(freshEditorASession);
    assert.equal(freshReload.response.status, 200);
    assert.deepEqual(freshReload.issue.reportedPreflight.entries, entries,
      "a new saved session must reload the exact persisted 48 entries, including blank #48");
    assert.equal(freshReload.issue.reportedPreflight.entries[47], "");
    assert.equal(freshReload.issue.reportedPreflight.evidence.actor, editorAId);
    assert.equal(freshReload.issue.puzzles[0].solution, privateAnswer);
    const directlyPersisted = await harness.getPersistentIssue();
    assert.deepEqual(directlyPersisted.reportedPreflight.entries, entries);

    const publicResponses = [];
    for (const path of ["/issue", "/export"]) {
      const response = await fetch(`${endpoint}${path}`);
      assert.equal(response.status, 200);
      publicResponses.push(await response.json());
    }
    const versionsResponse = await fetch(`${endpoint}/versions`);
    assert.equal(versionsResponse.status, 200);
    const versions = await versionsResponse.json();
    assert.ok(versions.length >= 1);
    const latestVersionResponse = await fetch(`${endpoint}/versions/${versions[0].id}`);
    assert.equal(latestVersionResponse.status, 200);
    publicResponses.push(await latestVersionResponse.json());
    for (const publicIssue of publicResponses) {
      assert.equal(publicIssue.reportedPreflight, undefined);
      assert.equal(publicIssue.reportedPreflightPresent, true);
      assert.equal(publicIssue.puzzles[0].solution, "");
      assert.equal(publicIssue.puzzles[0].validationNotes, "");
      assert.equal(publicIssue.pages.find((page) => page.number === 3).sourceEvidence.notes, "");
      assert.equal(publicIssue.pages.find((page) => page.number === 4).sourceEvidence.notes, "");
      assert.equal(publicIssue.puzzles[0].sourceEvidence.notes, "");
      assert.doesNotMatch(
        JSON.stringify(publicIssue),
        /PRIVATE_REPORTED_DESCRIPTION_MUST_NOT_BE_PUBLIC|PRIVATE_PAGE_SOURCE_NOTES_MUST_NOT_BE_PUBLIC|PRIVATE_PUZZLE_SOURCE_NOTES_MUST_NOT_BE_PUBLIC|PRIVATE_REPORTED_SOURCE_NOTES_MUST_NOT_BE_PUBLIC|PRIVATE_PUZZLE_ANSWER_MUST_NOT_BE_PUBLIC/,
      );
    }

    const anonymousMutation = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revision: freshReload.issue.revision,
        action: "record_reported_preflight",
        checked: true,
        sourceIdentity: "anonymous",
        notes: "anonymous",
        reportedEntries: entries,
      }),
    });
    assert.equal(anonymousMutation.status, 401, "anonymous readers cannot write through the command route");
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    try {
      if (harness) await harness.closeTestDatabase();
    } finally {
      try {
        if (schemaCreated) await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await adminPool.end();
        await rm(outputDir, { recursive: true, force: true });
      }
    }
  }
});

test("database reads, exports, and a fresh API process recompute stale Page 1 verification without changing its history or snapshot", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  assert.ok(originalDatabaseUrl, "DATABASE_URL is required for the persisted Page 1 review integration test.");

  const { Pool } = pg;
  const adminPool = new Pool({ connectionString: originalDatabaseUrl });
  const outputDir = await mkdtemp(join(sourceDir, ".press-page-one-review-db-"));
  const schemaName = `press_page_one_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const editorId = `page-one-review-editor-${randomUUID()}`;
  let schemaCreated = false;
  let server;
  let restartedApi;
  let harness;

  try {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    const setup = await adminPool.connect();
    try {
      await setup.query(`SET search_path TO "${schemaName}", public`);
      await setup.query(`
        CREATE TABLE sessions (
          sid varchar PRIMARY KEY,
          sess jsonb NOT NULL,
          expire timestamp NOT NULL
        );
        CREATE TABLE users (
          id varchar PRIMARY KEY,
          email varchar UNIQUE,
          first_name varchar,
          last_name varchar,
          profile_image_url varchar,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE TABLE myrtle_editor_assignments (
          account_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          enabled boolean NOT NULL,
          changed_by varchar NOT NULL,
          changed_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE TABLE press_issues (
          id integer PRIMARY KEY,
          document jsonb NOT NULL
        );
        CREATE TABLE press_versions (
          id serial PRIMARY KEY,
          revision integer NOT NULL,
          at timestamp with time zone NOT NULL DEFAULT now(),
          action text NOT NULL,
          actor text NOT NULL,
          document jsonb NOT NULL
        );
      `);
    } finally {
      setup.release();
    }

    const isolatedDatabaseUrl = new URL(originalDatabaseUrl);
    isolatedDatabaseUrl.searchParams.set("options", `-c search_path=${schemaName},public`);
    harness = await loadHttpHarness(outputDir, { useDatabase: true, databaseUrl: isolatedDatabaseUrl.toString() });
    await harness.assignPersistentEditor(editorId);
    const session = await harness.createPersistentSession(editorId);

    server = await new Promise((resolve, reject) => {
      const listeningServer = harness.app.listen(0, "127.0.0.1", () => resolve(listeningServer));
      listeningServer.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    let endpoint = `http://127.0.0.1:${address.port}/api/press`;
    const readIssue = async (path, requestSession) => {
      const response = await fetch(`${endpoint}/${path}`, {
        headers: requestSession ? { Authorization: `Bearer ${requestSession}` } : {},
      });
      return { response, issue: await response.json() };
    };
    const issueRequest = () => readIssue("issue", session);
    const commandRequest = async (command) => {
      const response = await fetch(`${endpoint}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify(command),
      });
      return { response, issue: await response.json() };
    };

    const initial = await issueRequest();
    assert.equal(initial.response.status, 200);
    const prepared = structuredClone(initial.issue);
    const cover = prepared.pages.find((page) => page.number === 1);
    cover.copy = "Authoritative recovered Page 1 used for the persistence regression fixture.";
    cover.provenance = "repository_reference";
    cover.sourceIdentity = `owner/repository:issues/issue-1.json@${"a".repeat(40)}`;

    const coverAsset = {
      id: "page-one-reference-image",
      name: "Original Page 1 reference image",
      objectPath: "/objects/original-page-one-reference",
      contentType: "image/png",
      size: 128,
      caption: "Original front-page scan",
      credit: "Archive",
      source: "Issue #1 archive",
      provenance: "repository_reference",
      pages: [2],
      review: "approved",
      reviewer: "Casey Editor",
      reviewNotes: "Reference fixture only.",
      dpi: 300,
    };
    prepared.assets = [coverAsset];
    const confirmedReference = {
      id: "confirmed-page-one-reference",
      version: 3,
      kind: "front_page",
      title: "Original front-page benchmark",
      assetId: "",
      url: "https://example.test/original-page-one-reference",
      sourceIdentity: "Original archive scan, box 4, item 2",
      at: "2026-01-01T00:00:00.000Z",
      suppliedBy: editorId,
      registrationNotes: "Original supplied for comparison.",
      approval: {
        reviewer: "Casey Editor",
        reviewerAccountId: editorId,
        reviewerRole: "myrtle_editor",
        notes: "Confirmed the exact original reference image.",
        at: "2026-01-02T00:00:00.000Z",
      },
    };
    prepared.artDirection = {
      references: [confirmedReference],
      history: [structuredClone(confirmedReference)],
    };
    prepared.pageSnapshots = [{
      id: "frozen-page-one-persistence-fixture",
      issueRevision: prepared.revision,
      at: "2026-01-01T00:00:00.000Z",
      actor: "test-fixture",
      notes: "Immutable Page 1 snapshot captured before the verification.",
      page: structuredClone(cover),
      puzzles: [],
      assets: [structuredClone(coverAsset)],
    }];
    prepared.pageOneApprovalHistory = [];
    await harness.savePersistentIssue(prepared);

    const persistedPreparation = await issueRequest();
    assert.equal(persistedPreparation.response.status, 200);
    assert.deepEqual(persistedPreparation.issue.artDirection.references, [{ ...confirmedReference, imageAvailable: true }],
      "the confirmed reference must survive an actual database round trip");
    const frozenCover = structuredClone(persistedPreparation.issue.pages[0]);
    const frozenSnapshots = structuredClone(persistedPreparation.issue.pageSnapshots);

    const verificationResponse = await commandRequest({
      revision: persistedPreparation.issue.revision,
      action: "verify_page_one_approval",
      referenceId: confirmedReference.id,
      checked: true,
      decision: "verified",
      approvalDocumentIdentity: "Issue #1 approval ledger, archival entry 1991-01",
      notes: "Compared the original cover image with the cited approval ledger and confirmed this exact Page 1.",
    });
    assert.equal(verificationResponse.response.status, 200, JSON.stringify(verificationResponse.issue));
    const verification = verificationResponse.issue.pageOneApprovalHistory[0];
    assert.equal(verification.isCurrent, true);
    const {
      isCurrent: _currentBeforeChange,
      staleReasons: _staleReasonsBeforeChange,
      ...savedVerification
    } = verification;
    const afterVerificationSaved = await harness.getPersistentIssue();
    assert.deepEqual(afterVerificationSaved.pageOneApprovalHistory, [savedVerification],
      "the database stores historical evidence, not its derived currentness badge");
    assert.deepEqual(afterVerificationSaved.pages[0], frozenCover);
    assert.deepEqual(afterVerificationSaved.pageSnapshots, frozenSnapshots);

    const changedStoredIssue = await harness.getPersistentIssue();
    const savedReference = changedStoredIssue.artDirection.references.find(
      (reference) => reference.id === confirmedReference.id,
    );
    savedReference.url = "https://example.test/replacement-page-one-reference";
    await harness.savePersistentIssue(changedStoredIssue);

    server.closeAllConnections?.();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server = null;

    const bundleUrl = pathToFileURL(join(outputDir, "press-routes-http-test.mjs")).href;
    const childScript = `
      import { app } from ${JSON.stringify(bundleUrl)};
      const server = app.listen(0, "127.0.0.1", () => {
        process.stdout.write("READY " + server.address().port + String.fromCharCode(10));
      });
      process.on("SIGTERM", () => server.close(() => process.exit(0)));
    `;
    restartedApi = spawn(process.execPath, ["--input-type=module", "-e", childScript], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const restartedPort = await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };
      const timeout = setTimeout(() => {
        restartedApi.kill("SIGTERM");
        fail(new Error(`Fresh API process did not start. ${errorOutput}`));
      }, 15000);
      restartedApi.stdout.on("data", (chunk) => {
        output += chunk.toString();
        const ready = output.match(/READY (\d+)/);
        if (ready && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(Number(ready[1]));
        }
      });
      restartedApi.stderr.on("data", (chunk) => {
        errorOutput += chunk.toString();
      });
      restartedApi.once("error", fail);
      restartedApi.once("exit", (code, signal) => {
        fail(new Error(`Fresh API process exited before starting (code ${code}, signal ${signal}). ${errorOutput}`));
      });
    });
    endpoint = `http://127.0.0.1:${restartedPort}/api/press`;

    const firstReload = await issueRequest();
    assert.equal(firstReload.response.status, 200);
    assert.equal(firstReload.issue.pageOneApprovalHistory[0].isCurrent, false,
      "the API must recompute the old review as stale from the changed saved reference image");
    const {
      isCurrent: _currentAfterFirstReload,
      staleReasons: _staleReasonsAfterFirstReload,
      ...firstReloadHistory
    } = firstReload.issue.pageOneApprovalHistory[0];
    assert.deepEqual(firstReloadHistory, savedVerification,
      "reloading must not rewrite the historic verification evidence");
    assert.deepEqual(firstReload.issue.pages[0], frozenCover);
    assert.deepEqual(firstReload.issue.pageSnapshots, frozenSnapshots,
      "reloading must not rewrite the frozen Page 1 snapshot");

    const authenticatedExport = await readIssue("export", session);
    assert.equal(authenticatedExport.response.status, 200);
    assert.equal(authenticatedExport.issue.pageOneApprovalHistory[0].isCurrent, false);
    assert.deepEqual(
      authenticatedExport.issue.pageOneApprovalHistory.map(({ id, isCurrent, staleReasons }) => ({
        id,
        isCurrent,
        staleReasons,
      })),
      firstReload.issue.pageOneApprovalHistory.map(({ id, isCurrent, staleReasons }) => ({
        id,
        isCurrent,
        staleReasons,
      })),
      "authenticated exports must report the same derived currentness as the issue endpoint",
    );

    const publicIssue = await readIssue("issue", null);
    const publicExport = await readIssue("export", null);
    assert.equal(publicIssue.response.status, 200);
    assert.equal(publicExport.response.status, 200);
    assert.equal(publicExport.issue.pageOneApprovalHistory[0].isCurrent, false);
    assert.deepEqual(
      publicExport.issue.pageOneApprovalHistory.map(({ id, isCurrent, staleReasons }) => ({
        id,
        isCurrent,
        staleReasons,
      })),
      publicIssue.issue.pageOneApprovalHistory.map(({ id, isCurrent, staleReasons }) => ({
        id,
        isCurrent,
        staleReasons,
      })),
      "public exports must report the same derived currentness as the public issue endpoint",
    );

    const secondReload = await issueRequest();
    assert.equal(secondReload.response.status, 200);
    assert.equal(secondReload.issue.pageOneApprovalHistory[0].isCurrent, false);
    const {
      isCurrent: _currentAfterSecondReload,
      staleReasons: _staleReasonsAfterSecondReload,
      ...secondReloadHistory
    } = secondReload.issue.pageOneApprovalHistory[0];
    assert.deepEqual(secondReloadHistory, savedVerification);
    assert.deepEqual(secondReload.issue.pages[0], frozenCover);
    assert.deepEqual(secondReload.issue.pageSnapshots, frozenSnapshots);

    const persistedAfterReads = await harness.getPersistentIssue();
    assert.deepEqual(persistedAfterReads.pageOneApprovalHistory, [savedVerification],
      "repeated reads must leave the saved historic verification unchanged");
    assert.deepEqual(persistedAfterReads.pages[0], frozenCover);
    assert.deepEqual(persistedAfterReads.pageSnapshots, frozenSnapshots);
    assert.equal(persistedAfterReads.artDirection.references[0].url,
      "https://example.test/replacement-page-one-reference");
  } finally {
    if (restartedApi && restartedApi.exitCode === null && restartedApi.signalCode === null) {
      await new Promise((resolve) => {
        restartedApi.once("exit", resolve);
        restartedApi.kill("SIGTERM");
      });
    }
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    try {
      if (harness) await harness.closeTestDatabase();
    } finally {
      try {
        if (schemaCreated) await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await adminPool.end();
        await rm(outputDir, { recursive: true, force: true });
      }
    }
  }
});

test("database-backed restore history survives a fresh session and stays restricted to newsroom roles", async () => {
  const outputDir = await mkdtemp(join(sourceDir, ".press-media-restore-history-db-"));
  const originalAdminIds = process.env.NEWSROOM_ADMIN_USER_IDS;
  const editorId = `restore-history-editor-${randomUUID()}`;
  const adminId = `restore-history-admin-${randomUUID()}`;
  const unassignedId = `restore-history-unassigned-${randomUUID()}`;
  const completedAssetId = `restore-completed-${randomUUID()}`;
  const failedAssetId = `restore-failed-${randomUUID()}`;
  const sessionIds = [];
  const auditIds = [];
  let server;
  let harness;

  process.env.NEWSROOM_ADMIN_USER_IDS = [originalAdminIds, adminId].filter(Boolean).join(",");
  try {
    harness = await loadHttpHarness(outputDir, { useDatabase: true });
    await harness.assignPersistentEditor(editorId);
    const completedAudit = await harness.recordPersistentRestore({
      accountId: editorId,
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      issuePath: "issues/restore-history-integration.json",
      assetId: completedAssetId,
      fileName: "Completed artwork",
      filePath: `issues/media/${completedAssetId}.png`,
      outcome: "completed",
      failureReason: null,
    });
    auditIds.push(completedAudit.id);
    const failedAudit = await harness.recordPersistentRestore({
      accountId: editorId,
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      issuePath: "issues/restore-history-integration.json",
      assetId: failedAssetId,
      fileName: "Failed artwork",
      filePath: `issues/media/${failedAssetId}.png`,
      outcome: "failed",
      failureReason: "GitHub returned HTTP 503 while delivering the selected file.",
    });
    auditIds.push(failedAudit.id);

    server = await new Promise((resolve, reject) => {
      const listeningServer = harness.app.listen(0, "127.0.0.1", () => resolve(listeningServer));
      listeningServer.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const endpoint = `http://127.0.0.1:${address.port}/api/press`;

    const originalEditorSession = await harness.createPersistentSession(editorId);
    sessionIds.push(originalEditorSession);
    const originalHistory = await requestMediaRestoreHistory(endpoint, originalEditorSession);
    assert.equal(originalHistory.response.status, 200);

    await harness.deletePersistentSession(originalEditorSession);
    const revokedSession = await requestMediaRestoreHistory(endpoint, originalEditorSession);
    assert.equal(revokedSession.response.status, 401);

    const freshEditorSession = await harness.createPersistentSession(editorId);
    sessionIds.push(freshEditorSession);
    const freshHistory = await requestMediaRestoreHistory(endpoint, freshEditorSession);
    assert.equal(freshHistory.response.status, 200, JSON.stringify(freshHistory.result));

    const fixtureRecords = freshHistory.result.restores
      .filter((record) => [completedAssetId, failedAssetId].includes(record.assetId));
    assert.deepEqual(
      fixtureRecords.map(({ assetId, outcome, failureReason }) => ({ assetId, outcome, failureReason }))
        .sort((left, right) => left.assetId.localeCompare(right.assetId)),
      [
        {
          assetId: completedAssetId,
          outcome: "completed",
          failureReason: null,
        },
        {
          assetId: failedAssetId,
          outcome: "failed",
          failureReason: "GitHub returned HTTP 503 while delivering the selected file.",
        },
      ].sort((left, right) => left.assetId.localeCompare(right.assetId)),
      "both persisted restore outcomes must remain readable after the original session is deleted",
    );

    const metadataKeys = [
      "id",
      "at",
      "actorDisplayName",
      "owner",
      "repo",
      "branch",
      "issuePath",
      "assetId",
      "fileName",
      "filePath",
      "outcome",
      "failureReason",
    ].sort();
    for (const record of freshHistory.result.restores) {
      assert.deepEqual(Object.keys(record).sort(), metadataKeys);
      assert.doesNotMatch(JSON.stringify(record), /bytesBase64|fileBytes|privateFileBytes/i);
    }

    const anonymous = await requestMediaRestoreHistory(endpoint, null);
    assert.equal(anonymous.response.status, 401);

    const unassignedSession = await harness.createPersistentSession(unassignedId);
    sessionIds.push(unassignedSession);
    const unassigned = await requestMediaRestoreHistory(endpoint, unassignedSession);
    assert.equal(unassigned.response.status, 403);

    const adminSession = await harness.createPersistentSession(adminId);
    sessionIds.push(adminSession);
    const administrator = await requestMediaRestoreHistory(endpoint, adminSession);
    assert.equal(administrator.response.status, 200, JSON.stringify(administrator.result));
    assert.ok(administrator.result.restores.some((record) => record.assetId === completedAssetId));
    assert.ok(administrator.result.restores.some((record) => record.assetId === failedAssetId));
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    try {
      if (harness) {
        try {
          await harness.cleanupPersistentRestoreTest({
            auditIds,
            sessionIds,
            accountIds: [editorId],
          });
        } finally {
          await harness.closeTestDatabase();
        }
      }
    } finally {
      if (originalAdminIds === undefined) delete process.env.NEWSROOM_ADMIN_USER_IDS;
      else process.env.NEWSROOM_ADMIN_USER_IDS = originalAdminIds;
      await rm(outputDir, { recursive: true, force: true });
    }
  }
});

const assetUploadPath = "/objects/uploads/test-asset-upload";

function assetRegistrationBody(revision) {
  return {
    revision,
    action: "add_asset",
    asset: {
      id: "registered-upload",
      name: "Registered upload",
      objectPath: assetUploadPath,
      contentType: "image/png",
      size: mediaBytes.length,
      caption: "Test artwork",
      credit: "Test artist",
      source: "Test source",
      provenance: "uploaded_unverified",
      pages: [2],
      review: "pending",
      reviewer: "",
      reviewNotes: "",
      dpi: 300,
    },
  };
}

test("asset registration accepts stored bytes matching the declared supported type", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const before = await harness.getIssue();
    harness.resetTestStorage([{
      path: assetUploadPath,
      bytesBase64: mediaBytes.toString("base64"),
      contentType: "image/png",
      ownerId: "media-editor",
    }]);

    const response = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: mediaHeaders,
      body: JSON.stringify(assetRegistrationBody(before.revision)),
    });
    const result = await response.json();

    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.assets.length, before.assets.length + 1);
    const savedAsset = result.assets.find((asset) => asset.name === "Registered upload");
    assert.ok(savedAsset);
    assert.notEqual(savedAsset.objectPath, assetUploadPath);
    assert.match(savedAsset.objectPath, /^\/objects\/registered-assets\/[0-9a-f-]{36}$/i);
    assert.deepEqual(harness.getTestStorageWrites().map(({ path, bytesBase64, contentType }) => ({
      path, bytesBase64, contentType,
    })), [{
      path: savedAsset.objectPath,
      bytesBase64: mediaBytes.toString("base64"),
      contentType: "image/png",
    }], "saved assets are copied to a server-created path using the validated bytes");

    // A still-valid signed upload URL can replace its own temporary object;
    // it must not change the separate object now referenced by the asset.
    const replacementBytes = makePngBytes("replacement-page-one-image");
    harness.overwriteTestStorage(assetUploadPath, replacementBytes.toString("base64"), "image/png");
    assert.deepEqual(harness.getTestStorageBytes(assetUploadPath), replacementBytes);
    assert.deepEqual(harness.getTestStorageBytes(savedAsset.objectPath), mediaBytes);
    assert.equal(harness.getMutationCount(), 1);
    assert.deepEqual(harness.getTestStorageReads(), [assetUploadPath]);
  });
});

test("asset registration rejects stored bytes that do not match the declared type", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const before = await harness.getIssue();
    harness.resetTestStorage([{
      path: assetUploadPath,
      bytesBase64: mismatchedMediaBytes.toString("base64"),
      contentType: "image/png",
      ownerId: "media-editor",
    }]);

    const response = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: mediaHeaders,
      body: JSON.stringify(assetRegistrationBody(before.revision)),
    });
    const result = await response.json();

    assert.equal(response.status, 400, JSON.stringify(result));
    assert.match(result.error, /contents do not match the declared supported type/i);
    assert.deepEqual(await harness.getIssue(), before);
    assert.equal(harness.getMutationCount(), 0);
    assert.deepEqual(harness.getTestStorageReads(), [assetUploadPath]);
  });
});

test("asset edits reject metadata that no longer matches the stored bytes", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const before = await harness.getIssue();
    harness.resetTestStorage([{
      path: mediaObjectPath,
      bytesBase64: mismatchedMediaBytes.toString("base64"),
      contentType: "image/png",
    }]);
    const body = assetRegistrationBody(before.revision);
    body.action = "edit_asset";
    body.id = "asset-artwork";
    body.asset.id = "asset-artwork";
    body.asset.objectPath = mediaObjectPath;

    const response = await fetch(`${endpoint}/commands`, {
      method: "POST",
      headers: mediaHeaders,
      body: JSON.stringify(body),
    });
    const result = await response.json();

    assert.equal(response.status, 400, JSON.stringify(result));
    assert.match(result.error, /contents do not match the declared supported type/i);
    assert.deepEqual(await harness.getIssue(), before);
    assert.equal(harness.getMutationCount(), 0);
  });
});

async function requestMediaPreview(endpoint, selection) {
  const previewResponse = await fetch(`${endpoint}/github/media/preview`, {
    method: "POST",
    headers: mediaHeaders,
    body: JSON.stringify(selection),
  });
  const preview = await previewResponse.json();
  assert.equal(previewResponse.status, 200, JSON.stringify(preview));
  assert.deepEqual(preview.blockers, []);
  assert.equal(preview.maxFiles, 50);
  return preview;
}

function mediaApplyBody(selection, preview, selectedAssetIds, replaceRemoteConflicts = false) {
  return {
    ...selection,
    expectedHeadSha: preview.headSha,
    expectedFiles: preview.files.map((file) => ({
      assetId: file.assetId,
      path: file.path,
      status: file.status,
      localSha256: file.localSha256,
      remoteSha256: file.remoteSha256,
      remoteBlobSha: file.remoteBlobSha,
    })),
    selectedAssetIds,
    confirmed: true,
    replaceRemoteConflicts,
  };
}

async function requestMediaApply(endpoint, selection, preview, selectedAssetIds, replaceRemoteConflicts = false) {
  const applyResponse = await fetch(`${endpoint}/github/media/apply`, {
    method: "POST",
    headers: mediaHeaders,
    body: JSON.stringify(mediaApplyBody(selection, preview, selectedAssetIds, replaceRemoteConflicts)),
  });
  const result = await applyResponse.json();
  return { response: applyResponse, result };
}

async function requestMediaReplacementAudits(endpoint, session = "media-session") {
  const headers = session ? { Authorization: `Bearer ${session}` } : {};
  const response = await fetch(`${endpoint}/github/media/replacements`, { headers });
  return { response, result: await response.json() };
}

async function requestMediaRestoreHistory(endpoint, session = "media-session") {
  const headers = session ? { Authorization: `Bearer ${session}` } : {};
  const response = await fetch(`${endpoint}/github/media/restores`, { headers });
  return { response, result: await response.json() };
}

async function previewAndConfirmMediaTransfer(endpoint, selection) {
  const preview = await requestMediaPreview(endpoint, selection);
  assert.equal(preview.files.length, 1);
  assert.equal(preview.files[0].status, "ready");
  const { response: applyResponse, result } = await requestMediaApply(
    endpoint,
    selection,
    preview,
    preview.files.map((file) => file.assetId),
  );
  assert.equal(applyResponse.status, 200, JSON.stringify(result));
  assert.deepEqual(result.skippedFiles, []);
  return result;
}

test("media backup commits only selected media and preserves issue review data", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage([{
      path: mediaObjectPath,
      bytesBase64: mediaBytes.toString("base64"),
      contentType: "image/png",
    }]);
    harness.configureGitHubMedia({ issue: issueBefore });

    const result = await previewAndConfirmMediaTransfer(endpoint, {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    });

    assert.equal(result.filesTransferred, 1);
    assert.equal(result.commitSha, mediaCommitSha);
    assertIssueReviewDataUnchanged(issueBefore, await harness.getIssue());
    assert.equal(harness.getMutationCount(), 0);
    assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [{
      expectedHeadSha: mediaHeadSha,
      message: `Back up issue media for ${mediaIssuePath}`,
      files: [{
        path: mediaRepositoryPath,
        bytesBase64: mediaBytes.toString("base64"),
      }],
    }], "the repository commit must contain only the selected media file");
    assert.equal(harness.getGitHubMediaCalls().issueCommits, 0);
    assert.deepEqual(harness.getTestStorageWrites(), []);
    assert.deepEqual((await requestMediaReplacementAudits(endpoint)).result.replacements, [],
      "a new media backup is not a replacement");
  });
});

test("media restore writes only the missing private object and preserves issue review data", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    const blobSha = "a".repeat(40);
    harness.resetTestStorage();
    harness.configureGitHubMedia({
      issue: issueBefore,
      files: [{
        path: mediaRepositoryPath,
        sha: blobSha,
        bytesBase64: mediaBytes.toString("base64"),
      }],
    });

    const result = await previewAndConfirmMediaTransfer(endpoint, {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "from_repository",
    });

    assert.equal(result.filesTransferred, 1);
    assert.equal(result.commitSha, null);
    assertIssueReviewDataUnchanged(issueBefore, await harness.getIssue());
    assert.equal(harness.getMutationCount(), 0);
    assert.deepEqual(harness.getTestStorageWrites(), [{
      path: mediaObjectPath,
      bytesBase64: mediaBytes.toString("base64"),
      contentType: "image/png",
    }], "restore must create only the selected missing private-storage object");
    assert.equal(harness.getGitHubMediaCalls().mediaCommits.length, 0);
    assert.equal(harness.getGitHubMediaCalls().issueCommits, 0);
    assert.deepEqual((await requestMediaReplacementAudits(endpoint)).result.replacements, [],
      "a repository restore is not a replacement");
    const history = await requestMediaRestoreHistory(endpoint);
    assert.equal(history.response.status, 200);
    assert.equal(history.result.restores.length, 1);
    assert.equal(history.result.restores[0].actorDisplayName, "Media Editor");
    assert.equal("accountId" in history.result.restores[0], false);
    assert.deepEqual(
      {
        owner: history.result.restores[0].owner,
        repo: history.result.restores[0].repo,
        branch: history.result.restores[0].branch,
        issuePath: history.result.restores[0].issuePath,
        assetId: history.result.restores[0].assetId,
        fileName: history.result.restores[0].fileName,
        filePath: history.result.restores[0].filePath,
        actorDisplayName: history.result.restores[0].actorDisplayName,
        outcome: history.result.restores[0].outcome,
        failureReason: history.result.restores[0].failureReason,
      },
      {
        owner: "underground-press",
        repo: "issue-files",
        branch: "main",
        issuePath: mediaIssuePath,
        assetId: "asset-artwork",
        fileName: "Artwork Page 2",
        filePath: mediaRepositoryPath,
        actorDisplayName: "Media Editor",
        outcome: "completed",
        failureReason: null,
      },
    );
    assert.ok(Number.isFinite(Date.parse(history.result.restores[0].at)));
    assert.equal("bytesBase64" in history.result.restores[0], false);
  });
});

test("HTTP media backup commits only selected files and reports the rest as skipped", async () => {
  const assets = [
    makeMediaAsset("asset-a", "Artwork-A"),
    makeMediaAsset("asset-b", "Artwork-B"),
    makeMediaAsset("asset-c", "Artwork-C"),
  ];
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage(localStorageFixtures(assets));
    harness.configureGitHubMedia({ issue: issueBefore });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), ["ready", "ready", "ready"]);

    const { response, result } = await requestMediaApply(endpoint, selection, preview, ["asset-b"]);
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.filesTransferred, 1);
    assert.deepEqual(result.skippedFiles, [
      { assetId: "asset-a", assetName: "Artwork-A", reason: "Not selected for this transfer." },
      { assetId: "asset-c", assetName: "Artwork-C", reason: "Not selected for this transfer." },
    ]);
    assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [{
      expectedHeadSha: mediaHeadSha,
      message: `Back up issue media for ${mediaIssuePath}`,
      files: [{
        path: getMediaRepositoryPath(assets[1]),
        bytesBase64: assets[1].bytes.toString("base64"),
      }],
    }], "unselected private-file bytes must not be included in the GitHub commit");
    assert.deepEqual(harness.getTestStorageWrites(), []);
  }, assets);
});

test("HTTP media backup requires consent and replaces only the selected GitHub conflict", async () => {
  const assets = [
    makeMediaAsset("asset-a", "Artwork-A"),
    makeMediaAsset("asset-b", "Artwork-B"),
  ];
  const remoteFiles = assets.map((asset, index) => {
    const bytes = Buffer.from(`existing-repository-copy-${asset.id}`);
    return {
      path: getMediaRepositoryPath(asset),
      sha: String(index + 3).repeat(40),
      bytesBase64: bytes.toString("base64"),
    };
  });

  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage(localStorageFixtures(assets));
    harness.configureGitHubMedia({ issue: issueBefore, files: remoteFiles });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), ["remote_conflict", "remote_conflict"]);
    const repositoryBefore = harness.getGitHubMediaFiles();

    const unauthenticatedAudits = await requestMediaReplacementAudits(endpoint, null);
    assert.equal(unauthenticatedAudits.response.status, 401);
    const unauthorizedAudits = await requestMediaReplacementAudits(endpoint, "unassigned-media-session");
    assert.equal(unauthorizedAudits.response.status, 403);

    const withoutConsent = await requestMediaApply(endpoint, selection, preview, ["asset-a"]);
    assert.equal(withoutConsent.response.status, 400, JSON.stringify(withoutConsent.result));
    assert.match(withoutConsent.result.error, /Explicitly authorize replacing/);
    assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [], "a rejected replacement must not create a GitHub commit");
    assert.deepEqual(harness.getGitHubMediaFiles(), repositoryBefore, "a rejected replacement must leave every remote file unchanged");
    assert.deepEqual((await requestMediaReplacementAudits(endpoint)).result.replacements, [],
      "a rejected replacement must not create a completed audit record");

    const withConsent = await requestMediaApply(endpoint, selection, preview, ["asset-a"], true);
    assert.equal(withConsent.response.status, 200, JSON.stringify(withConsent.result));
    assert.equal(withConsent.result.filesTransferred, 1);
    assert.deepEqual(withConsent.result.skippedFiles, [
      { assetId: "asset-b", assetName: "Artwork-B", reason: "Not selected for this transfer." },
    ]);
    assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [{
      expectedHeadSha: mediaHeadSha,
      message: `Back up issue media for ${mediaIssuePath}`,
      files: [{
        path: getMediaRepositoryPath(assets[0]),
        bytesBase64: assets[0].bytes.toString("base64"),
      }],
    }], "explicit approval must commit only the selected conflicting file");

    const repositoryAfter = harness.getGitHubMediaFiles();
    const beforeByPath = new Map(repositoryBefore.map((file) => [file.path, file]));
    const afterByPath = new Map(repositoryAfter.map((file) => [file.path, file]));
    assert.equal(
      afterByPath.get(getMediaRepositoryPath(assets[0])).bytesBase64,
      assets[0].bytes.toString("base64"),
      "the selected conflicting file must be replaced with the private-storage bytes",
    );
    assert.deepEqual(
      afterByPath.get(getMediaRepositoryPath(assets[1])),
      beforeByPath.get(getMediaRepositoryPath(assets[1])),
      "the unselected conflicting file must remain unchanged",
    );
    const { response: auditResponse, result: auditResult } = await requestMediaReplacementAudits(endpoint);
    assert.equal(auditResponse.status, 200);
    assert.equal(auditResult.replacements.length, 1);
    assert.equal(auditResult.replacements[0].accountId, "media-editor");
    assert.ok(Number.isFinite(Date.parse(auditResult.replacements[0].at)));
    assert.equal(auditResult.replacements[0].owner, selection.owner);
    assert.equal(auditResult.replacements[0].repo, selection.repo);
    assert.equal(auditResult.replacements[0].branch, selection.branch);
    assert.equal(auditResult.replacements[0].issuePath, selection.path);
    assert.deepEqual(auditResult.replacements[0].files, [{
      assetId: "asset-a",
      path: getMediaRepositoryPath(assets[0]),
      priorRemoteFingerprint: {
        remoteSha256: null,
        remoteBlobSha: remoteFiles[0].sha,
      },
    }]);
    assert.equal(auditResult.replacements[0].commitSha, mediaCommitSha);
    const adminAudits = await requestMediaReplacementAudits(endpoint, "media-admin-session");
    assert.equal(adminAudits.response.status, 200, "newsroom administrators can review replacement records");
    assert.equal(adminAudits.result.replacements.length, 1);
    assert.deepEqual(await harness.getIssue(), issueBefore,
      "recording a media replacement must not alter issue approval, provenance, or Page 1 data");
  }, assets);
});

test("failed GitHub media replacement commits are not recorded as completed", async () => {
  const assets = [makeMediaAsset("asset-a", "Artwork-A")];
  const remoteBytes = Buffer.from("existing-repository-copy");
  const remoteFiles = [{
    path: getMediaRepositoryPath(assets[0]),
    sha: "3".repeat(40),
    bytesBase64: remoteBytes.toString("base64"),
  }];

  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage(localStorageFixtures(assets));
    harness.configureGitHubMedia({ issue: issueBefore, files: remoteFiles, failMediaCommit: true });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    const response = await fetch(`${endpoint}/github/media/apply`, {
      method: "POST",
      headers: mediaHeaders,
      body: JSON.stringify(mediaApplyBody(selection, preview, ["asset-a"], true)),
    });
    assert.equal(response.status, 500, "a GitHub commit failure must not be reported as a completed replacement");
    assert.deepEqual((await requestMediaReplacementAudits(endpoint)).result.replacements, []);
  }, assets);
});

test("HTTP media backup with multi-file consent replaces only the selected GitHub conflicts", async () => {
  const assets = [
    makeMediaAsset("asset-a", "Artwork-A"),
    makeMediaAsset("asset-b", "Artwork-B"),
    makeMediaAsset("asset-c", "Artwork-C"),
  ];
  const remoteFiles = assets.map((asset, index) => ({
    path: getMediaRepositoryPath(asset),
    sha: String(index + 3).repeat(40),
    bytesBase64: Buffer.from(`existing-repository-copy-${asset.id}`).toString("base64"),
  }));

  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage(localStorageFixtures(assets));
    harness.configureGitHubMedia({ issue: issueBefore, files: remoteFiles });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), [
      "remote_conflict",
      "remote_conflict",
      "remote_conflict",
    ]);
    const repositoryBefore = harness.getGitHubMediaFiles();

    const { response, result } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      ["asset-a", "asset-c"],
      true,
    );
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.filesTransferred, 2);
    assert.deepEqual(result.skippedFiles, [
      { assetId: "asset-b", assetName: "Artwork-B", reason: "Not selected for this transfer." },
    ]);
    assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [{
      expectedHeadSha: mediaHeadSha,
      message: `Back up issue media for ${mediaIssuePath}`,
      files: [
        {
          path: getMediaRepositoryPath(assets[0]),
          bytesBase64: assets[0].bytes.toString("base64"),
        },
        {
          path: getMediaRepositoryPath(assets[2]),
          bytesBase64: assets[2].bytes.toString("base64"),
        },
      ],
    }], "bulk approval must commit only the selected conflicting paths");

    const repositoryAfter = harness.getGitHubMediaFiles();
    const beforeByPath = new Map(repositoryBefore.map((file) => [file.path, file]));
    const afterByPath = new Map(repositoryAfter.map((file) => [file.path, file]));
    assert.equal(afterByPath.get(getMediaRepositoryPath(assets[0])).bytesBase64, assets[0].bytes.toString("base64"));
    assert.deepEqual(
      afterByPath.get(getMediaRepositoryPath(assets[1])),
      beforeByPath.get(getMediaRepositoryPath(assets[1])),
      "the unselected conflicting file must remain unchanged",
    );
    assert.equal(afterByPath.get(getMediaRepositoryPath(assets[2])).bytesBase64, assets[2].bytes.toString("base64"));
  }, assets);
});

test("HTTP media restore downloads and writes only selected files", async () => {
  const assets = [
    makeMediaAsset("asset-a", "Artwork-A"),
    makeMediaAsset("asset-b", "Artwork-B"),
    makeMediaAsset("asset-c", "Artwork-C"),
  ];
  const blobShas = ["a", "b", "c"].map((letter) => letter.repeat(40));
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage();
    harness.configureGitHubMedia({
      issue: issueBefore,
      files: assets.map((asset, index) => ({
        path: getMediaRepositoryPath(asset),
        sha: blobShas[index],
        bytesBase64: asset.bytes.toString("base64"),
      })),
    });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "from_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), ["ready", "ready", "ready"]);

    const { response, result } = await requestMediaApply(endpoint, selection, preview, ["asset-b"]);
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.filesTransferred, 1);
    assert.deepEqual(result.skippedFiles, [
      { assetId: "asset-a", assetName: "Artwork-A", reason: "Not selected for this transfer." },
      { assetId: "asset-c", assetName: "Artwork-C", reason: "Not selected for this transfer." },
    ]);
    assert.deepEqual(harness.getGitHubMediaCalls().blobDownloads, [blobShas[1]]);
    assert.deepEqual(harness.getTestStorageWrites(), [{
      path: "/objects/asset-b",
      bytesBase64: assets[1].bytes.toString("base64"),
      contentType: "image/png",
    }], "private storage must receive bytes for the selected file only");
  }, assets);
});

test("HTTP media restore reports a selected GitHub download failure without writing any private files", async () => {
  const assets = [
    makeMediaAsset("asset-a", "Artwork-A"),
    makeMediaAsset("asset-b", "Artwork-B"),
    makeMediaAsset("asset-c", "Artwork-C"),
  ];
  const blobShas = ["a", "b", "c"].map((letter) => letter.repeat(40));
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage();
    harness.configureGitHubMedia({
      issue: issueBefore,
      files: assets.map((asset, index) => ({
        path: getMediaRepositoryPath(asset),
        sha: blobShas[index],
        bytesBase64: asset.bytes.toString("base64"),
      })),
      downloadFailures: [
        { sha: blobShas[0], status: 404 },
        { sha: blobShas[2], status: 503 },
      ],
    });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "from_repository",
    };

    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), ["ready", "ready", "ready"]);
    const { response, result } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      ["asset-b", "asset-c"],
    );

    assert.equal(response.status, 502, JSON.stringify(result));
    assert.equal(result.code, "GITHUB_MEDIA_DOWNLOAD_FAILED");
    assert.equal(result.fileName, "Artwork-C");
    assert.equal(result.path, getMediaRepositoryPath(assets[2]));
    assert.match(result.reason, /HTTP 503/);
    assert.match(result.error, /Artwork-C/);
    assert.match(result.error, /Nothing was written/);
    assert.doesNotMatch(result.error, /changed after preview/);
    assert.deepEqual(
      harness.getGitHubMediaCalls().blobDownloads,
      [blobShas[1], blobShas[2]],
      "the restore must download selected blobs only, even when unselected blobs are unavailable",
    );
    assert.deepEqual(
      harness.getTestStorageWrites(),
      [],
      "no selected file is written when any selected GitHub download fails",
    );
    const failedHistory = await requestMediaRestoreHistory(endpoint);
    assert.equal(failedHistory.result.restores.length, 2);
    assert.ok(failedHistory.result.restores.every((record) => record.outcome === "failed"));
    const failedDownload = failedHistory.result.restores.find((record) => record.fileName === "Artwork-C");
    const blockedByDownload = failedHistory.result.restores.find((record) => record.fileName === "Artwork-B");
    assert.equal(failedDownload.filePath, getMediaRepositoryPath(assets[2]));
    assert.match(failedDownload.failureReason, /HTTP 503/);
    assert.match(blockedByDownload.failureReason, /another selected GitHub file could not be downloaded/);

    const { response: retryResponse, result: retryResult } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      ["asset-b", "asset-c"],
    );
    assert.equal(retryResponse.status, 200, JSON.stringify(retryResult));
    assert.equal(retryResult.filesTransferred, 2);
    assert.deepEqual(
      harness.getGitHubMediaCalls().blobDownloads,
      [blobShas[1], blobShas[2], blobShas[1], blobShas[2]],
      "the unchanged preview can be retried after GitHub recovers",
    );
    assert.deepEqual(
      harness.getTestStorageWrites().map(({ path }) => path),
      ["/objects/asset-b", "/objects/asset-c"],
    );
    const historyAfterRetry = await requestMediaRestoreHistory(endpoint);
    assert.deepEqual(
      historyAfterRetry.result.restores.map((record) => record.outcome).sort(),
      ["completed", "completed", "failed", "failed"],
    );
  }, assets);
});

test("HTTP media restore records a private-storage failure and succeeds on retry", async () => {
  const assets = [makeMediaAsset("asset-storage-failure", "Storage-failure-artwork")];
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage();
    harness.configureGitHubMedia({
      issue: issueBefore,
      files: [{
        path: getMediaRepositoryPath(assets[0]),
        sha: "d".repeat(40),
        bytesBase64: assets[0].bytes.toString("base64"),
      }],
    });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "from_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    harness.failStorageWrite(`/objects/${assets[0].id}`, 409);

    const failedResponse = await fetch(`${endpoint}/github/media/apply`, {
      method: "POST",
      headers: mediaHeaders,
      body: JSON.stringify(mediaApplyBody(selection, preview, [assets[0].id])),
    });
    assert.equal(failedResponse.status, 409);
    assert.deepEqual(harness.getTestStorageWrites(), []);
    const failedHistory = await requestMediaRestoreHistory(endpoint);
    assert.equal(failedHistory.result.restores.length, 1);
    assert.equal(failedHistory.result.restores[0].outcome, "failed");
    assert.equal(
      failedHistory.result.restores[0].failureReason,
      "A private-storage file already exists; restore does not overwrite existing files.",
    );

    const retried = await requestMediaApply(endpoint, selection, preview, [assets[0].id]);
    assert.equal(retried.response.status, 200, JSON.stringify(retried.result));
    const history = await requestMediaRestoreHistory(endpoint);
    assert.deepEqual(history.result.restores.map((record) => record.outcome).sort(), ["completed", "failed"]);
  }, assets);
});

test("HTTP media restore separates GitHub rate limits from missing blobs and reports only a safe wait interval", async () => {
  const assets = [
    makeMediaAsset("asset-missing", "Artwork-Missing"),
    makeMediaAsset("asset-limited", "Artwork-Limited"),
  ];
  const blobShas = ["a", "b"].map((letter) => letter.repeat(40));
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage();
    harness.configureGitHubMedia({
      issue: issueBefore,
      files: assets.map((asset, index) => ({
        path: getMediaRepositoryPath(asset),
        sha: blobShas[index],
        bytesBase64: asset.bytes.toString("base64"),
      })),
      downloadFailures: [
        { sha: blobShas[0], status: 404 },
        { sha: blobShas[1], status: 403, rateLimited: true, retryAfterSeconds: 125 },
      ],
    });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "from_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), ["ready", "ready"]);

    const { response: missingResponse, result: missingResult } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      ["asset-missing"],
    );
    assert.equal(missingResponse.status, 502);
    assert.equal(missingResult.code, "GITHUB_MEDIA_DOWNLOAD_FAILED");
    assert.match(missingResult.reason, /HTTP 404/);
    assert.equal(missingResult.retryAfterSeconds, undefined);

    const { response: limitedResponse, result: limitedResult } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      ["asset-limited"],
    );
    assert.equal(limitedResponse.status, 429, JSON.stringify(limitedResult));
    assert.equal(limitedResult.code, "GITHUB_MEDIA_RATE_LIMITED");
    assert.equal(limitedResult.fileName, "Artwork-Limited");
    assert.equal(limitedResult.retryAfterSeconds, 125);
    assert.match(limitedResult.error, /Nothing was written/);
    assert.doesNotMatch(JSON.stringify(limitedResult), /x-ratelimit|retry-after|provider detail/i);
    assert.deepEqual(harness.getTestStorageWrites(), []);
  }, assets);
});

test("HTTP media apply rejects forged, duplicate, ineligible, and over-limit selections before transfer", async () => {
  const eligibleAssets = Array.from({ length: 51 }, (_, index) =>
    makeMediaAsset(`asset-${String(index).padStart(2, "0")}`, `Artwork-${String(index).padStart(2, "0")}`));
  const ineligibleAsset = makeMediaAsset("asset-svg", "Vector-Artwork", "image/svg+xml");
  const assets = [...eligibleAssets, ineligibleAsset];
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage(localStorageFixtures(assets));
    harness.configureGitHubMedia({ issue: issueBefore });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    };
    const preview = await requestMediaPreview(endpoint, selection);
    assert.equal(preview.files.length, assets.length);
    assert.equal(preview.files.at(-1).status, "unsupported_type");

    const invalidSelections = [
      ["forged", ["asset-not-in-preview"]],
      ["duplicate", ["asset-00", "asset-00"]],
      ["ineligible", [ineligibleAsset.id]],
      ["over-limit", eligibleAssets.map((asset) => asset.id)],
    ];
    for (const [label, selectedAssetIds] of invalidSelections) {
      const branchReadsBefore = harness.getGitHubMediaCalls().branchReads;
      const { response, result } = await requestMediaApply(endpoint, selection, preview, selectedAssetIds);
      assert.equal(response.status, 400, `${label} selection should be rejected: ${JSON.stringify(result)}`);
      assert.equal(
        harness.getGitHubMediaCalls().branchReads,
        branchReadsBefore + 1,
        `${label} selection should be rejected before the selection-scoped transfer preview`,
      );
      assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [], `${label} selection must not commit files`);
      assert.deepEqual(harness.getTestStorageWrites(), [], `${label} selection must not write private files`);
      assert.deepEqual(harness.getGitHubMediaCalls().blobDownloads, [], `${label} selection must not download transfer bytes`);
    }
  }, assets);
});

test("media backup rejects bytes that do not match the declared image type", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage([{
      path: mediaObjectPath,
      bytesBase64: mismatchedMediaBytes.toString("base64"),
      contentType: "image/png",
    }]);
    harness.configureGitHubMedia({ issue: issueBefore });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "to_repository",
    };

    const preview = await requestMediaPreview(endpoint, selection);
    assert.equal(preview.files[0].status, "invalid_record");
    const { response, result } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      [preview.files[0].assetId],
    );
    assert.equal(response.status, 400, JSON.stringify(result));
    assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, []);
  });
});

test("media restore rejects repository bytes that do not match the declared image type", async () => {
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    harness.resetTestStorage();
    const otherAsset = {
      ...issueBefore.assets[0],
      id: "asset-unselected",
      name: "Unselected-artwork",
      objectPath: "/objects/asset-unselected",
    };
    const remoteIssue = {
      ...issueBefore,
      assets: [...issueBefore.assets, otherAsset],
    };
    const invalidBlobSha = "a".repeat(40);
    const unselectedBlobSha = "b".repeat(40);
    harness.configureGitHubMedia({
      issue: remoteIssue,
      files: [
        {
          path: mediaRepositoryPath,
          sha: invalidBlobSha,
          bytesBase64: mismatchedMediaBytes.toString("base64"),
        },
        {
          path: getMediaRepositoryPath(otherAsset),
          sha: unselectedBlobSha,
          bytesBase64: mediaBytes.toString("base64"),
        },
      ],
    });
    const selection = {
      owner: "underground-press",
      repo: "issue-files",
      branch: "main",
      path: mediaIssuePath,
      revision: issueBefore.revision,
      direction: "from_repository",
    };

    const preview = await requestMediaPreview(endpoint, selection);
    assert.deepEqual(preview.files.map((file) => file.status), ["ready", "ready"]);
    const { response, result } = await requestMediaApply(
      endpoint,
      selection,
      preview,
      ["asset-artwork"],
    );
    assert.equal(response.status, 422, JSON.stringify(result));
    assert.equal(result.code, "GITHUB_MEDIA_TYPE_MISMATCH");
    assert.match(result.error, /downloaded GitHub bytes do not match the asset’s declared type \(image\/png\)/);
    assert.match(result.error, /Nothing was written/);
    assert.doesNotMatch(result.error, /changed after preview/);
    assert.deepEqual(harness.getGitHubMediaCalls().blobDownloads, [invalidBlobSha]);
    assert.deepEqual(harness.getTestStorageWrites(), []);
  });
});

test("HTTP media apply rejects selections above the combined 50 MB limit in both directions", async () => {
  const assets = [
    makeMediaAsset("asset-a", "Artwork-A", "application/octet-stream", 16 * 1024 * 1024),
    makeMediaAsset("asset-b", "Artwork-B", "application/octet-stream", 16 * 1024 * 1024),
    makeMediaAsset("asset-c", "Artwork-C", "application/octet-stream", 18 * 1024 * 1024 + 1),
  ];
  await withMediaRouteHarness(async ({ harness, endpoint }) => {
    const issueBefore = await harness.getIssue();
    assert.ok(assets.every((asset) => asset.size <= 20 * 1024 * 1024));
    assert.ok(assets.reduce((total, asset) => total + asset.size, 0) > 50 * 1024 * 1024);

    for (const direction of ["to_repository", "from_repository"]) {
      harness.resetTestStorage(direction === "to_repository" ? localStorageFixtures(assets) : []);
      harness.configureGitHubMedia({
        issue: issueBefore,
        files: direction === "from_repository"
          ? assets.map((asset, index) => ({
            path: getMediaRepositoryPath(asset),
            sha: ["a", "b", "c"][index].repeat(40),
            bytesBase64: asset.bytes.toString("base64"),
          }))
          : [],
      });
      const selection = {
        owner: "underground-press",
        repo: "issue-files",
        branch: "main",
        path: mediaIssuePath,
        revision: issueBefore.revision,
        direction,
      };
      const preview = await requestMediaPreview(endpoint, selection);
      assert.deepEqual(
        preview.files.map((file) => file.status),
        ["ready", "ready", "ready"],
        `${direction} preview should mark each individually valid file ready`,
      );

      const branchReadsBefore = harness.getGitHubMediaCalls().branchReads;
      const { response, result } = await requestMediaApply(
        endpoint,
        selection,
        preview,
        assets.map((asset) => asset.id),
      );
      assert.equal(response.status, 400, `${direction} selection should be rejected: ${JSON.stringify(result)}`);
      assert.match(result.error, /50 MB combined transfer limit/);
      assert.equal(
        harness.getGitHubMediaCalls().branchReads,
        branchReadsBefore + 1,
        `${direction} selection should be rejected before loading its selected transfer bytes`,
      );
      assert.deepEqual(harness.getGitHubMediaCalls().mediaCommits, [], `${direction} must not commit files`);
      assert.deepEqual(harness.getGitHubMediaCalls().blobDownloads, [], `${direction} must not download GitHub blobs`);
      assert.deepEqual(harness.getTestStorageWrites(), [], `${direction} must not write private files`);
    }
  }, assets);
});

test("saved Page 1 references migrate only from a protected established image and reruns are safe", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  assert.ok(originalDatabaseUrl, "DATABASE_URL is required for the persistent migration test.");
  const { Pool } = pg;
  const adminPool = new Pool({ connectionString: originalDatabaseUrl });
  const outputDir = await mkdtemp(join(sourceDir, ".press-page-one-reference-migration-"));
  const schemaName = `press_p1_migrate_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  let schemaCreated = false;
  let harness;

  try {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    const setup = await adminPool.connect();
    try {
      await setup.query(`SET search_path TO "${schemaName}", public`);
      await setup.query(`
        CREATE TABLE press_issues (id integer PRIMARY KEY, document jsonb NOT NULL);
        CREATE TABLE press_versions (
          id serial PRIMARY KEY,
          revision integer NOT NULL,
          at timestamp with time zone NOT NULL DEFAULT now(),
          action text NOT NULL,
          actor text NOT NULL,
          document jsonb NOT NULL
        );
      `);
    } finally {
      setup.release();
    }
    const isolatedDatabaseUrl = new URL(originalDatabaseUrl);
    isolatedDatabaseUrl.searchParams.set("options", `-c search_path=${schemaName},public`);
    harness = await loadHttpHarness(outputDir, { useDatabase: true, databaseUrl: isolatedDatabaseUrl.toString() });

    const issue = await harness.getPersistentIssue();
    const mutablePath = `/objects/uploads/users/${"x".repeat(43)}/${randomUUID()}`;
    const protectedPath = `/objects/registered-assets/${randomUUID()}`;
    const originalAsset = {
      id: "migration-page-one-image",
      name: "Original Page 1 scan",
      objectPath: mutablePath,
      contentType: "image/png",
      size: mediaBytes.length,
      caption: "",
      credit: "",
      source: "",
      provenance: "uploaded_unverified",
      pages: [],
      review: "pending",
      reviewer: "",
      reviewNotes: "",
      dpi: 0,
    };
    const protectedAsset = { ...structuredClone(originalAsset), objectPath: protectedPath };
    const mutableGoldenPath = `/objects/uploads/users/${"g".repeat(43)}/${randomUUID()}`;
    const protectedGoldenPath = `/objects/registered-assets/${randomUUID()}`;
    const originalGoldenAsset = {
      ...structuredClone(originalAsset),
      id: "migration-golden-image",
      name: "Original Golden Image",
      objectPath: mutableGoldenPath,
    };
    const protectedGoldenAsset = {
      ...structuredClone(originalGoldenAsset),
      objectPath: protectedGoldenPath,
    };
    const styleReviewEvidence = {
      decision: "passed",
      checks: {
        referenceMatch: true,
        spotInks: true,
        typography: true,
        inkIllustration: true,
        halftoneRegistration: true,
        boxedComposition: true,
        legibilityPrint: true,
        provenancePreserved: true,
      },
      reviewer: "Myrtle",
      reviewerAccountId: "migration-fixture-editor",
      notes: "The saved art matches the approved style reference.",
      at: "2026-01-02T12:00:00.000Z",
      referenceIds: ["legacy-golden-image-reference"],
    };
    protectedGoldenAsset.styleReview = structuredClone(styleReviewEvidence);
    const reference = {
      id: "legacy-page-one-reference",
      version: 3,
      kind: "front_page",
      title: "Original front page",
      assetId: originalAsset.id,
      url: "",
      sourceIdentity: "Original archive scan",
      at: "2026-01-01T00:00:00.000Z",
      suppliedBy: "migration-fixture-editor",
      registrationNotes: "Original image reference.",
      assetSnapshot: structuredClone(originalAsset),
      approval: {
        reviewer: "Myrtle",
        reviewerAccountId: "migration-fixture-editor",
        reviewerRole: "myrtle_editor",
        notes: "Confirmed this exact original front-page image.",
        at: "2026-01-02T00:00:00.000Z",
      },
    };
    const goldenReference = {
      ...structuredClone(reference),
      id: "legacy-golden-image-reference",
      kind: "golden_image",
      title: "Original Golden Image",
      assetId: originalGoldenAsset.id,
      assetSnapshot: structuredClone(originalGoldenAsset),
    };
    const verification = {
      id: "migration-fixture-verification",
      issueRevision: issue.revision,
      at: "2026-01-03T00:00:00.000Z",
      decision: "verified",
      reviewer: "Myrtle",
      reviewerAccountId: "migration-fixture-editor",
      reviewerRole: "myrtle_editor",
      approvalDocumentIdentity: "Archive ledger entry",
      notes: "Compared the original Page 1 scan with its identified approval ledger entry.",
      sourceIdentity: "owner/repository:issue.json",
      sourceFingerprint: "historical-source-fingerprint",
      referenceId: reference.id,
      referenceVersion: reference.version,
      referenceSourceIdentity: reference.sourceIdentity,
      referenceFingerprint: "historical-reference-fingerprint",
    };
    issue.assets = [protectedAsset, protectedGoldenAsset];
    issue.artDirection = {
      references: [structuredClone(reference), structuredClone(goldenReference)],
      history: [structuredClone(reference), structuredClone(goldenReference)],
    };
    issue.pageOneApprovalHistory = [verification];
    await harness.savePersistentIssue(issue);
    harness.resetTestStorage([{
      path: protectedPath,
      bytesBase64: mediaBytes.toString("base64"),
      contentType: "image/png",
    }, {
      path: protectedGoldenPath,
      bytesBase64: mediaBytes.toString("base64"),
      contentType: "image/png",
    }]);

    const migrated = await harness.getPersistentIssue();
    const current = migrated.artDirection.references.find((item) => item.kind === "front_page");
    const currentGolden = migrated.artDirection.references.find((item) => item.kind === "golden_image");
    assert.match(current.assetSnapshot.objectPath, /^\/objects\/registered-assets\/[0-9a-f-]{36}$/i);
    assert.notEqual(current.assetSnapshot.objectPath, protectedPath, "migration writes a fresh create-only reference copy");
    assert.equal(current.approval, null, "migration requires a fresh explicit confirmation");
    assert.equal(current.version, reference.version + 1);
    assert.deepEqual(migrated.artDirection.history[0], reference, "the historical reference remains unchanged");
    assert.deepEqual(migrated.pageOneApprovalHistory, [verification], "historical verification evidence remains unchanged");
    assert.match(currentGolden.assetSnapshot.objectPath, /^\/objects\/registered-assets\/[0-9a-f-]{36}$/i);
    assert.notEqual(currentGolden.assetSnapshot.objectPath, protectedGoldenPath, "Golden Image migration also writes a fresh create-only copy");
    assert.equal(currentGolden.approval, null, "the migrated Golden Image requires fresh confirmation");
    assert.equal(currentGolden.version, goldenReference.version + 1);
    assert.deepEqual(
      migrated.artDirection.history.find((item) => item.id === goldenReference.id),
      goldenReference,
      "the historical Golden Image reference remains unchanged",
    );
    assert.deepEqual(harness.getTestStorageBytes(current.assetSnapshot.objectPath), mediaBytes);
    assert.deepEqual(harness.getTestStorageBytes(currentGolden.assetSnapshot.objectPath), mediaBytes);
    assert.deepEqual(
      harness.getTestStorageReads(),
      [protectedPath, protectedGoldenPath],
      "neither mutable upload path is used to establish the old image bytes",
    );
    assert.equal(harness.getTestStorageWrites().length, 2);
    const revisionAfterMigration = migrated.revision;

    const reloaded = await harness.getPersistentIssue();
    assert.equal(reloaded.revision, revisionAfterMigration, "a second read does not migrate the new protected reference again");
    assert.equal(harness.getTestStorageWrites().length, 2);
    assert.deepEqual(reloaded.pageOneApprovalHistory, [verification]);

    const unresolvedIssue = structuredClone(reloaded);
    const unresolvedPath = `/objects/uploads/${randomUUID()}`;
    const unresolvedAsset = { ...originalAsset, id: "unresolved-page-one-image", objectPath: unresolvedPath };
    const unresolvedReference = {
      ...structuredClone(reference),
      id: "unresolved-legacy-reference",
      assetId: unresolvedAsset.id,
      assetSnapshot: structuredClone(unresolvedAsset),
    };
    unresolvedIssue.assets = [unresolvedAsset];
    unresolvedIssue.artDirection.references = [unresolvedReference];
    unresolvedIssue.artDirection.history = [structuredClone(unresolvedReference)];
    await harness.savePersistentIssue(unresolvedIssue);
    harness.resetTestStorage();

    const unresolved = await harness.getPersistentIssue();
    const pending = unresolved.artDirection.references[0];
    assert.equal(pending.assetId, "");
    assert.equal(pending.url, "");
    assert.equal(pending.assetSnapshot, undefined);
    assert.equal(pending.approval, null);
    assert.match(pending.registrationNotes, /fresh reference/i);
    assert.deepEqual(unresolved.artDirection.history[0], unresolvedReference);
    assert.deepEqual(unresolved.pageOneApprovalHistory, [verification]);
    assert.deepEqual(harness.getTestStorageReads(), [], "unverifiable legacy bytes are not copied from their mutable path");

    const mismatchedIssue = structuredClone(unresolvedIssue);
    const mismatchedProtectedPath = `/objects/registered-assets/${randomUUID()}`;
    const mismatchedProtectedAsset = {
      ...structuredClone(unresolvedAsset),
      objectPath: mismatchedProtectedPath,
    };
    mismatchedIssue.assets = [mismatchedProtectedAsset];
    await harness.savePersistentIssue(mismatchedIssue);
    harness.resetTestStorage([{
      path: mismatchedProtectedPath,
      bytesBase64: mismatchedMediaBytes.toString("base64"),
      contentType: "image/png",
    }]);

    const mismatched = await harness.getPersistentIssue();
    const detached = mismatched.artDirection.references.find((item) => item.kind === "front_page");
    assert.equal(detached.assetId, "");
    assert.equal(detached.url, "");
    assert.equal(detached.assetSnapshot, undefined);
    assert.equal(detached.approval, null);
    assert.equal(detached.version, unresolvedReference.version + 1);
    assert.match(detached.registrationNotes, /fresh reference/i);
    assert.deepEqual(mismatched.artDirection.history[0], unresolvedReference);
    assert.deepEqual(mismatched.pageOneApprovalHistory, [verification]);
    assert.deepEqual(harness.getTestStorageReads(), [mismatchedProtectedPath]);
    assert.deepEqual(harness.getTestStorageWrites(), [], "incompatible stored bytes must not be copied into a protected reference");
    const revisionAfterMismatch = mismatched.revision;

    const mismatchedReload = await harness.getPersistentIssue();
    assert.equal(mismatchedReload.revision, revisionAfterMismatch, "a second read does not repeat the failed-byte migration");
    assert.deepEqual(mismatchedReload.artDirection.history[0], unresolvedReference);
    assert.deepEqual(mismatchedReload.pageOneApprovalHistory, [verification]);
    assert.deepEqual(harness.getTestStorageReads(), [mismatchedProtectedPath], "a second read does not recheck already detached bytes");
    assert.deepEqual(harness.getTestStorageWrites(), []);

    for (const failureMode of ["create-only write", "ACL setup"]) {
      const failedMigrationIssue = structuredClone(reloaded);
      failedMigrationIssue.assets = [structuredClone(protectedGoldenAsset)];
      failedMigrationIssue.artDirection.references = [structuredClone(goldenReference)];
      failedMigrationIssue.artDirection.history = [structuredClone(goldenReference)];
      failedMigrationIssue.pageOneApprovalHistory = [structuredClone(verification)];
      await harness.savePersistentIssue(failedMigrationIssue);
      harness.resetTestStorage([{
        path: protectedGoldenPath,
        bytesBase64: mediaBytes.toString("base64"),
        contentType: "image/png",
      }]);
      if (failureMode === "create-only write") harness.failNextStorageWrite();
      else harness.failNextStorageAcl();

      const detachedIssue = await harness.getPersistentIssue();
      const detachedGolden = detachedIssue.artDirection.references.find((item) => item.kind === "golden_image");
      assert.equal(detachedGolden.assetId, "", `${failureMode} failure must clear the active asset ID`);
      assert.equal(detachedGolden.url, "", `${failureMode} failure must clear the active URL`);
      assert.equal(detachedGolden.assetSnapshot, undefined, `${failureMode} failure must clear the image binding`);
      assert.equal(detachedGolden.approval, null, `${failureMode} failure must require fresh confirmation`);
      assert.equal(detachedGolden.version, goldenReference.version + 1);
      assert.match(detachedGolden.registrationNotes, /supply and confirm a fresh reference/i);
      assert.deepEqual(
        detachedIssue.artDirection.history.find((item) => item.id === goldenReference.id && item.version === goldenReference.version),
        goldenReference,
        `${failureMode} failure must preserve the archived Golden Image reference`,
      );
      assert.deepEqual(detachedIssue.pageOneApprovalHistory, [verification]);
      assert.deepEqual(
        detachedIssue.assets.find((asset) => asset.id === protectedGoldenAsset.id).styleReview,
        styleReviewEvidence,
        `${failureMode} failure must preserve saved style-review evidence`,
      );
      assert.deepEqual(harness.getTestStorageReads(), [protectedGoldenPath]);

      if (failureMode === "create-only write") {
        assert.deepEqual(harness.getTestStorageWrites(), [], "a failed create-only write must not be recorded as saved");
        assert.deepEqual(harness.getTestStorageAclAttempts(), [], "ACL setup is not attempted when the write fails");
      } else {
        const attemptedCopy = harness.getTestStorageWrites()[0];
        assert.ok(attemptedCopy, "ACL failure must happen after a create-only copy was written");
        assert.deepEqual(harness.getTestStorageAclAttempts(), [attemptedCopy.path]);
        assert.deepEqual(harness.getTestStorageBytes(attemptedCopy.path), mediaBytes);
        assert.equal(
          detachedIssue.assets.some((asset) => asset.objectPath === attemptedCopy.path),
          false,
          "an object whose ACL setup failed must not be attached to a saved asset",
        );
      }

      const historyAfterFailure = structuredClone(detachedIssue.artDirection.history);
      const revisionAfterFailure = detachedIssue.revision;
      const retried = await harness.getPersistentIssue();
      assert.equal(retried.revision, revisionAfterFailure, `${failureMode} retry must not create another migration version`);
      assert.deepEqual(retried.artDirection.history, historyAfterFailure, `${failureMode} retry must preserve archive history`);
      assert.deepEqual(retried.pageOneApprovalHistory, [verification]);
      assert.deepEqual(
        retried.assets.find((asset) => asset.id === protectedGoldenAsset.id).styleReview,
        styleReviewEvidence,
      );
      assert.equal(harness.getTestStorageWrites().length, failureMode === "ACL setup" ? 1 : 0);
      assert.equal(harness.getTestStorageAclAttempts().length, failureMode === "ACL setup" ? 1 : 0);
      assert.deepEqual(harness.getTestStorageReads(), [protectedGoldenPath], "retry must not reopen the failed legacy migration");
    }
  } finally {
    try {
      if (harness) await harness.closeTestDatabase();
    } finally {
      if (schemaCreated) await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await adminPool.end();
      await rm(outputDir, { recursive: true, force: true });
    }
  }
});
