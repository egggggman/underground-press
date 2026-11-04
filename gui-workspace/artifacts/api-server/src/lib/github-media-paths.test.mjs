import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const entry = `
  import {
    getMediaDirectory, getRepositoryMediaPath, isSupportedMediaType,
    MAX_MEDIA_FILE_BYTES, MAX_MEDIA_TRANSFER_BYTES, MAX_MEDIA_FILES,
    matchesDeclaredMediaType, matchesGitBlobSha, mediaFingerprintsMatch, resolveMediaFileSelection,
  } from "./github-media-paths.ts";
  export {
    getMediaDirectory, getRepositoryMediaPath, isSupportedMediaType,
    MAX_MEDIA_FILE_BYTES, MAX_MEDIA_TRANSFER_BYTES, MAX_MEDIA_FILES,
    matchesDeclaredMediaType, matchesGitBlobSha, mediaFingerprintsMatch, resolveMediaFileSelection,
  };
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: sourceDir, sourcefile: "github-media-paths-test-entry.ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  external: ["node:*"],
});
const media = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("repository media uses the JSON file's sibling folder and safe deterministic filenames", () => {
  assert.equal(media.getMediaDirectory("issues/issue-7.JSON"), "issues/issue-7.media");
  assert.equal(
    media.getRepositoryMediaPath("issues/issue-7.json", {
      id: "../asset id",
      name: "../../Artwork: cover",
      contentType: "image/png",
    }),
    "issues/issue-7.media/asset-id-Artwork-cover.png",
  );
  const path = media.getRepositoryMediaPath("issue.json", {
    id: "same-id",
    name: "Artwork",
    contentType: "application/pdf",
  });
  assert.equal(path, "issue.media/same-id-Artwork.pdf");
  assert.equal(media.getRepositoryMediaPath("issue.json", {
    id: "same-id",
    name: "Artwork",
    contentType: "application/pdf",
  }), path);
});

test("media allowlist excludes active formats and transfer limits match upload policy", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff", "application/pdf", "text/plain", "application/octet-stream"]) {
    assert.equal(media.isSupportedMediaType(type), true, `${type} should be accepted`);
  }
  for (const type of ["image/svg+xml", "text/html", "application/xhtml+xml"]) {
    assert.equal(media.isSupportedMediaType(type), false, `${type} should be rejected`);
  }
  assert.equal(media.MAX_MEDIA_FILE_BYTES, 20 * 1024 * 1024);
  assert.equal(media.MAX_MEDIA_TRANSFER_BYTES, 50 * 1024 * 1024);
  assert.equal(media.MAX_MEDIA_FILES, 50);
});

test("declared image, PDF, text, and binary types must match their payload bytes", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhN8AAAAASUVORK5CYII=", "base64");
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n", "ascii");
  const text = Buffer.from("A plain text source file.\n", "utf8");
  const binary = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x01]);
  const activeHtml = Buffer.from("<!doctype html><html><script>alert(1)</script></html>", "utf8");
  const commentedHtml = Buffer.from("<!-- not harmless when followed by markup -->\n<html><body>Active</body></html>", "utf8");
  const truncatedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.equal(media.matchesDeclaredMediaType(png, "image/png"), true);
  assert.equal(media.matchesDeclaredMediaType(png, "image/jpeg"), false);
  assert.equal(media.matchesDeclaredMediaType(truncatedPng, "image/png"), false);
  assert.equal(media.matchesDeclaredMediaType(truncatedPng, "application/octet-stream"), false);
  assert.equal(media.matchesDeclaredMediaType(pdf, "application/pdf"), true);
  assert.equal(media.matchesDeclaredMediaType(pdf, "text/plain"), false);
  assert.equal(media.matchesDeclaredMediaType(text, "text/plain"), true);
  assert.equal(media.matchesDeclaredMediaType(text, "application/octet-stream"), false);
  assert.equal(media.matchesDeclaredMediaType(binary, "application/octet-stream"), true);
  assert.equal(media.matchesDeclaredMediaType(binary, "text/plain"), false);
  assert.equal(media.matchesDeclaredMediaType(activeHtml, "text/plain"), false);
  assert.equal(media.matchesDeclaredMediaType(commentedHtml, "text/plain"), false);
  assert.equal(media.matchesDeclaredMediaType(activeHtml, "application/octet-stream"), false);
  assert.equal(media.matchesDeclaredMediaType(Buffer.alloc(0), "image/png"), false);
  assert.equal(media.matchesDeclaredMediaType(Buffer.from("not a PDF"), "application/pdf"), false);
});

test("backup compares bytes against GitHub's Git blob fingerprint without re-downloading the remote file", () => {
  const bytes = Buffer.from("hello\n");
  assert.equal(media.matchesGitBlobSha(bytes, "ce013625030ba8dba906f756967f9e9ca394464a"), true);
  assert.equal(media.matchesGitBlobSha(bytes, "ce013625030ba8dba906f756967f9e9ca394464b"), false);
});

test("confirmation fingerprints ignore ordering but detect changed media status or bytes", () => {
  const first = {
    assetId: "asset-a",
    path: "issue.media/asset-a-a.png",
    status: "ready",
    localSha256: "local-a",
    remoteSha256: null,
    remoteBlobSha: null,
  };
  const second = {
    assetId: "asset-b",
    path: "issue.media/asset-b-b.jpg",
    status: "already_current",
    localSha256: "local-b",
    remoteSha256: "remote-b",
    remoteBlobSha: "blob-b",
  };
  const file = (fingerprint) => ({ ...fingerprint, assetName: fingerprint.assetId, contentType: "image/png", size: 1, localSize: 1, remoteSize: null, message: null });
  assert.equal(media.mediaFingerprintsMatch([second, first], [file(first), file(second)]), true);
  assert.equal(media.mediaFingerprintsMatch([first, second], [file(first), file({ ...second, remoteBlobSha: "changed" })]), false);
  assert.equal(media.mediaFingerprintsMatch([first], [file(first), file(second)]), false);
});

test("media transfer selection returns only selected files and names every skipped file", () => {
  const files = [
    { assetId: "ready-a", assetName: "Cover", size: 120, status: "ready", message: "Ready." },
    { assetId: "ready-b", assetName: "Puzzle", size: 240, status: "ready", message: "Ready." },
    { assetId: "remote-conflict", assetName: "Existing cover", size: 180, status: "remote_conflict", message: "A different repository file already exists." },
    { assetId: "bad-type", assetName: "Vector", size: 30, status: "unsupported_type", message: "Active SVG is not supported." },
  ];

  const result = media.resolveMediaFileSelection(files, ["ready-b"], "to_repository", false);
  assert.equal(result.ok, true);
  assert.deepEqual(result.selectedFiles.map((file) => file.assetId), ["ready-b"]);
  assert.deepEqual(result.skippedFiles, [
    { assetId: "ready-a", assetName: "Cover", reason: "Not selected for this transfer." },
    { assetId: "remote-conflict", assetName: "Existing cover", reason: "Not selected for this transfer." },
    { assetId: "bad-type", assetName: "Vector", reason: "Active SVG is not supported." },
  ]);
});

test("media transfer selection enforces conflicts, uniqueness, eligibility, file count, and combined size", () => {
  const file = (assetId, status = "ready", size = 1) => ({
    assetId,
    assetName: assetId,
    path: `issue.media/${assetId}.png`,
    contentType: "image/png",
    size,
    localSize: size,
    remoteSize: null,
    status,
    localSha256: null,
    remoteSha256: null,
    remoteBlobSha: null,
    message: `${status} message`,
  });

  const conflict = file("conflict", "remote_conflict");
  assert.equal(
    media.resolveMediaFileSelection([conflict], ["conflict"], "to_repository", false).ok,
    false,
    "a selected remote conflict needs separate replacement consent",
  );
  assert.equal(
    media.resolveMediaFileSelection([conflict], ["conflict"], "to_repository", true).ok,
    true,
  );
  assert.equal(media.resolveMediaFileSelection([file("one")], ["one", "one"], "to_repository", false).ok, false);
  assert.equal(media.resolveMediaFileSelection([file("one")], ["unknown"], "to_repository", false).ok, false);
  assert.equal(media.resolveMediaFileSelection([file("blocked", "storage_conflict")], ["blocked"], "from_repository", false).ok, false);

  const tooMany = Array.from({ length: media.MAX_MEDIA_FILES + 1 }, (_, index) => file(`asset-${index}`));
  assert.equal(
    media.resolveMediaFileSelection(tooMany, tooMany.map((item) => item.assetId), "to_repository", false).ok,
    false,
  );

  const tooLarge = [file("a", "ready", media.MAX_MEDIA_TRANSFER_BYTES), file("b", "ready", 1)];
  assert.equal(
    media.resolveMediaFileSelection(tooLarge, ["a", "b"], "to_repository", false).ok,
    false,
  );
});
