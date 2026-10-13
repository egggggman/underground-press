import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const entry = `
  import { assetStyleReady } from "./art-direction.ts";
  import {
    hasAuthoritativePageOneSource, isCurrentPageOneApprovalVerification,
    pageOneApprovalHistoryWithCurrentness, pageOneApprovalStaleReasons,
    migrateLegacyPageOneReference, migrateLegacyGoldenImageReference
  } from "./page-production.ts";
  import {
    applyCommand, applyGitHubPageOneSource, ensureCurrentRevision, ensureGitHubPreviewRevision,
    ensureGitHubSourceLoadConfirmed, ensureUploadedAssetMetadata, preserveGitHubPageOneForPush,
    PressError, readiness, safeImport, readerSafeIssue
  } from "./press-workflow.ts";
  import { hasMyrtleEditorRole, hasNewsroomAdminRole } from "./press-roles.ts";
  import { initialIssue } from "./press-seed.ts";
  import { ImportIssueBody, RequestUploadUrlBody } from "@workspace/api-zod";
  export {
    assetStyleReady,
    hasAuthoritativePageOneSource, isCurrentPageOneApprovalVerification,
    pageOneApprovalHistoryWithCurrentness, pageOneApprovalStaleReasons,
    migrateLegacyPageOneReference, migrateLegacyGoldenImageReference,
    applyCommand, applyGitHubPageOneSource, ensureCurrentRevision, ensureGitHubPreviewRevision,
    ensureGitHubSourceLoadConfirmed, ensureUploadedAssetMetadata, preserveGitHubPageOneForPush,
    PressError, readiness, safeImport, readerSafeIssue, initialIssue, ImportIssueBody,
    RequestUploadUrlBody, hasMyrtleEditorRole, hasNewsroomAdminRole
  };
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: sourceDir, sourcefile: "press-workflow-test-entry.ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  external: ["node:*"],
});
const workflow = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
test("production queue preserves every granular check and never mutates issue evidence", () => {
  const issue = workflow.initialIssue();
  const before = structuredClone(issue);
  const r = workflow.readiness(issue);
  assert.deepEqual(r.blockerDetails.map(b => b.description), r.blockers);
  assert.deepEqual(r.blockerDetails.map(b => b.ordinal), r.blockers.map((_, i) => i + 1));
  assert.deepEqual(r.productionQueue.map(s => s.priority), [1, 2, 3, 4, 5]);
  assert.equal(r.productionQueue[0].state, "actionable");
  assert.equal(r.productionQueue[4].state, "waiting_on_prerequisite");
  assert.ok(r.blockerDetails.every(b => b.owner && b.rootCause && b.prerequisite && b.nextMove && b.href.startsWith("/")));
  assert.equal(r.blockerDetails[47].description, r.blockers[47]);
  assert.equal(r.readyToPrint, false);
  assert.equal(r.approvedPages, 0, "A locked seeded placeholder is not a verified editorial/art approval.");
  assert.deepEqual(issue, before);
});
test("artwork blockers include indirect puzzle and artwork-slot page assignments", () => {
  const issue = workflow.initialIssue();
  issue.assets = [{ id: "original-fixture", name: "Original asset fixture", kind: "illustration", objectPath: "/objects/unit-fixture", contentType: "image/png", size: 10, source: "", credit: "", dpi: 300, review: "pending", reviewNotes: "", reviewer: "", notes: "", pages: [], provenance: "uploaded_unverified" }];
  issue.puzzles = [{ id: "puzzle-fixture", title: "Unit fixture only", kind: "logic", source: "", solution: "", validation: "unvalidated", validationNotes: "", reviewer: "", artworkId: "original-fixture", pages: [8], provenance: "incoming" }];
  issue.pages[1].artworkSlots = [{ id: "slot-fixture", label: "Original art", assetId: "original-fixture", required: true }];
  const detail = workflow.readiness(issue).blockerDetails.find(b => b.description === "Artwork “Original asset fixture”: source and credit required.");
  assert.deepEqual(detail.pages, [2, 8]);
  assert.equal(detail.owner, "Press");
});

test("reported preflight preserves all 48 raw descriptions including blank #48 without clearing live checks", () => {
  const issue = workflow.initialIssue();
  const entries = Array.from({ length: 48 }, (_, i) => i === 47 ? "" : `  Original report ${i + 1}\nfull unabridged text  `);
  const command = { action: "record_reported_preflight", revision: issue.revision, checked: true, sourceIdentity: "Owner's original report — unit fixture", notes: "Received verbatim; no clearance claimed.", reportedEntries: entries };
  const next = workflow.applyCommand(issue, command, undefined, "actual-test-recorder");
  assert.deepEqual(next.reportedPreflight.entries, entries);
  assert.equal(next.reportedPreflight.evidence.actor, "actual-test-recorder");
  assert.deepEqual(workflow.readiness(next).blockers, workflow.readiness(issue).blockers);
  assert.deepEqual(next.pages, issue.pages);
  assert.deepEqual(next.pageSnapshots, issue.pageSnapshots);
  assert.deepEqual(next.proofs, issue.proofs);
  for (const patch of [{ checked: false }, { reportedEntries: entries.slice(0, 47) }, { reportedEntries: [...entries, "49"] }, { sourceIdentity: "" }, { notes: "" }]) {
    assert.throws(() => workflow.applyCommand(issue, { ...command, ...patch }, undefined, "actual-test-recorder"));
  }
  assert.throws(() => workflow.applyCommand(issue, command));
  assert.equal(issue.reportedPreflight, undefined);
});

test("source-copy imports create only unapproved drafts with authenticated receipts", () => {
  const issue = workflow.initialIssue();
  const next = workflow.applyCommand(issue, {
    action: "import_page_sources", revision: issue.revision, checked: true, notes: "Human inspected the original contributor documents.",
    pageSources: [{ page: 2, title: "Actual supplied title", copy: "Actual supplied contributor draft — unit fixture.", sourceIdentity: "contributor/document/version" },
      { page: 10, copy: "Actual supplied advertisement copy — unit fixture.", sourceIdentity: "advertiser/document/version" }],
  }, undefined, "signed-in-recorder");
  for (const n of [2, 10]) {
    const page = next.pages.find(p => p.number === n);
    assert.equal(page.status, "draft");
    assert.equal(page.provenance, "imported_unverified");
    assert.equal(page.editorialApproval, null);
    assert.equal(page.artApproval, null);
    assert.equal(page.printApproval, null);
    assert.equal(page.sourceEvidence.actor, "signed-in-recorder");
    assert.equal(page.draftRevision, (issue.pages.find(p => p.number === n).draftRevision || 1) + 1);
  }
  assert.deepEqual(next.pages[0], issue.pages[0]);
  assert.deepEqual(next.pageSnapshots, issue.pageSnapshots);
  assert.deepEqual(next.pages[2], issue.pages[2]);
});

test("source-copy batches reject protected, locked, duplicate and stale destinations atomically", () => {
  const issue = workflow.initialIssue();
  issue.pages[2].locked = true;
  const before = structuredClone(issue);
  const row = { page: 2, copy: "Actual supplied draft.", sourceIdentity: "actual document" };
  const base = { action: "import_page_sources", revision: issue.revision, checked: true, notes: "Read source preview.", pageSources: [row] };
  for (const patch of [
    { checked: false }, { pageSources: [row, { ...row, page: 1 }] },
    { pageSources: [row, { ...row, page: 3 }] }, { pageSources: [row, row] },
    { pageSources: [row, { ...row, page: 4, sourceIdentity: "" }] }, { revision: issue.revision - 1 },
  ]) {
    assert.throws(() => workflow.applyCommand(issue, { ...base, ...patch }, undefined, "signed-in-recorder"));
    assert.deepEqual(issue, before);
  }
});

test("puzzle inventory imports new IDs but never inherit validation or approval claims", () => {
  const issue = workflow.initialIssue();
  const record = { id: "foreign-id", title: "Real submitted puzzle — fixture only", kind: "crossword", source: "Submitted source", solution: "Protected submitted answer",
    validation: "passed", validationNotes: "Foreign claimed pass", validationAt: "forged-time", validationAccountId: "forged-account", reviewer: "Myrtle",
    artworkId: "", pages: [8, 9], provenance: "repository_verified", sourceIdentity: "", sourceEvidence: { actor: "forged", at: "old", notes: "forged" } };
  const command = { action: "import_puzzle_inventory", revision: issue.revision, checked: true, sourceIdentity: "actual incoming file/version", notes: "Inspected source inventory; requires human solving.", puzzleInventory: [record, record] };
  const next = workflow.applyCommand(issue, command, undefined, "signed-in-recorder");
  assert.equal(next.puzzles.length, 2);
  assert.notEqual(next.puzzles[0].id, record.id);
  assert.notEqual(next.puzzles[0].id, next.puzzles[1].id);
  for (const p of next.puzzles) {
    assert.equal(p.validation, "unvalidated");
    assert.equal(p.validationNotes, "");
    assert.equal(p.reviewer, "");
    assert.equal(p.validationAt, undefined);
    assert.equal(p.validationAccountId, undefined);
    assert.equal(p.provenance, "imported_unverified");
    assert.equal(p.sourceIdentity, command.sourceIdentity);
    assert.equal(p.sourceEvidence.actor, "signed-in-recorder");
    assert.equal(p.solution, record.solution);
  }
  assert.deepEqual(next.pages[0], issue.pages[0]);
  assert.deepEqual(next.pageSnapshots, issue.pageSnapshots);
  assert.equal(workflow.readiness(next).validatedPuzzles, 0);
});

test("puzzle import rejects a bad final row without partial inventory writes", () => {
  const issue = workflow.initialIssue();
  const before = structuredClone(issue);
  const row = { id: "", title: "Submitted puzzle", kind: "logic", source: "", solution: "", validation: "unvalidated", validationNotes: "", reviewer: "", artworkId: "", pages: [], provenance: "incoming" };
  const command = { action: "import_puzzle_inventory", revision: issue.revision, checked: true, sourceIdentity: "file/version", notes: "Preview inspected.", puzzleInventory: [row] };
  for (const bad of [{ ...row, pages: [1] }, { ...row, artworkId: "unknown-original" }, { ...row, title: "" }]) {
    assert.throws(() => workflow.applyCommand(issue, { ...command, puzzleInventory: [row, bad] }, undefined, "signed-in-recorder"));
    assert.deepEqual(issue, before);
  }
  assert.throws(() => workflow.applyCommand(issue, { ...command, checked: false }, undefined, "signed-in-recorder"));
});

test("raw reported descriptions and source notes cannot leak protected answers to readers or snapshots", () => {
  const issue = workflow.initialIssue();
  const evidence = { actor: "signed-in-recorder", at: "test-time", notes: "PROTECTED ANSWER IN SOURCE NOTES" };
  issue.pages[1].sourceEvidence = evidence;
  issue.puzzles = [{ id: "p", title: "Submitted puzzle", kind: "logic", source: "question", solution: "PROTECTED ANSWER", validation: "unvalidated", validationNotes: "", reviewer: "", artworkId: "", pages: [8], provenance: "incoming", sourceEvidence: evidence }];
  issue.pageSnapshots = [{ id: "frozen-fixture", issueRevision: issue.revision, actor: "original-recorder", at: "test-time", notes: "Unit fixture only",
    page: { ...structuredClone(issue.pages[0]), sourceEvidence: evidence }, puzzles: structuredClone(issue.puzzles), assets: [] }];
  issue.reportedPreflight = { id: "report", sourceIdentity: "actual report", entries: Array(48).fill("PROTECTED ANSWER IN RAW REPORT"), evidence };
  const safe = workflow.readerSafeIssue(issue);
  assert.equal(safe.reportedPreflight, undefined);
  assert.equal(safe.reportedPreflightPresent, true);
  assert.ok(!JSON.stringify(safe).includes("PROTECTED ANSWER"));
  assert.equal(issue.reportedPreflight.entries.length, 48);
});

test("general issue imports cannot forge source receipts or replace the reported preflight snapshot", () => {
  const issue = workflow.applyCommand(workflow.initialIssue(), { action: "record_reported_preflight", revision: 1, checked: true, sourceIdentity: "actual report", notes: "Read verbatim.", reportedEntries: Array(48).fill("") }, undefined, "signed-in-recorder");
  const candidate = structuredClone(issue);
  candidate.reportedPreflight.entries[47] = "Invented replacement";
  candidate.pages[1].sourceEvidence = { actor: "Myrtle", at: "forged", notes: "Forged accepted source" };
  const next = workflow.safeImport(issue, candidate);
  assert.deepEqual(next.reportedPreflight, issue.reportedPreflight);
  assert.equal(next.pages[1].sourceEvidence, null);
  assert.deepEqual(next.pages[0], issue.pages[0]);
});
const {
  assetStyleReady,
  hasAuthoritativePageOneSource, isCurrentPageOneApprovalVerification,
  pageOneApprovalHistoryWithCurrentness, pageOneApprovalStaleReasons,
  applyCommand, applyGitHubPageOneSource, ensureCurrentRevision, ensureGitHubPreviewRevision,
  ensureGitHubSourceLoadConfirmed, ensureUploadedAssetMetadata, ImportIssueBody, initialIssue,
  preserveGitHubPageOneForPush, PressError, readiness, RequestUploadUrlBody, safeImport,
  readerSafeIssue, hasMyrtleEditorRole, hasNewsroomAdminRole
} = workflow;
const verifiedEditor = { accountId: "oidc-myrtle-1", displayName: "Myrtle Editor", role: "myrtle_editor" };

const allStyleChecks = () => ({ referenceMatch: true, spotInks: true, typography: true, inkIllustration: true, halftoneRegistration: true, boxedComposition: true, legibilityPrint: true, provenancePreserved: true });

test("reference registration is authorized, unapproved, versioned and never changes the cover or source art", () => {
  const issue = makeReadyIssue();
  const cover = structuredClone(issue.pages[0]);
  const art = structuredClone(issue.assets[0]);
  const command = { revision: issue.revision, action: "set_art_reference", notes: "Register the actual original for inspection.",
    artReference: { kind: "golden_image", title: "Original golden artwork", assetId: art.id, url: "", sourceIdentity: "Original archive scan — unit test only" } };
  const legacyUploadIssue = structuredClone(issue);
  legacyUploadIssue.assets[0].objectPath = `/objects/uploads/users/${"x".repeat(43)}/${randomUUID()}`;
  assert.throws(() => applyCommand(legacyUploadIssue, command, verifiedEditor, verifiedEditor.accountId), /protected image/i);
  assert.throws(() => applyCommand(issue, command), /Myrtle|verified/i);
  const registered = applyCommand(issue, command, verifiedEditor, verifiedEditor.accountId);
  const reference = registered.artDirection.references.find(r => r.kind === "golden_image");
  assert.equal(reference.approval, null);
  assert.deepEqual(reference.assetSnapshot, art);
  assert.deepEqual(registered.assets[0], art);
  assert.deepEqual(registered.pages[0], cover);
  assert.throws(() => applyCommand(registered, { action: "confirm_art_reference", revision: registered.revision, id: reference.id, notes: "Inspected actual original." }, verifiedEditor), /Explicit/i);
  const confirmed = applyCommand(registered, { action: "confirm_art_reference", revision: registered.revision, id: reference.id, notes: "Inspected the exact approved original scan.", checked: true }, verifiedEditor);
  const latest = confirmed.artDirection.references.find(r => r.kind === "golden_image");
  assert.equal(latest.approval.reviewerAccountId, verifiedEditor.accountId);
  assert.notEqual(latest.id, reference.id);
  assert.equal(confirmed.artDirection.history.find(r => r.id === reference.id).approval, null);
  assert.deepEqual(confirmed.pages[0], cover);
  assert.deepEqual(confirmed.assets[0], art);
  assert.throws(() => applyCommand(confirmed, { action: "delete_asset", revision: confirmed.revision, id: art.id }), /reference artwork cannot be deleted/i);

  const mutableCurrentReference = structuredClone(registered);
  mutableCurrentReference.artDirection.references.find(r => r.id === reference.id).assetSnapshot.objectPath = `/objects/uploads/users/${"x".repeat(43)}/${randomUUID()}`;
  assert.throws(() => applyCommand(mutableCurrentReference, {
    action: "confirm_art_reference",
    revision: mutableCurrentReference.revision,
    id: reference.id,
    checked: true,
    notes: "Inspected the exact image.",
  }, verifiedEditor), /protected image/i);
});

test("reference links reject active protocols and credential-bearing URLs", () => {
  const issue = makeReadyIssue();
  for (const url of ["javascript:alert(1)", "http://example.org/image", "https://user:password@example.org/image", "https://example.org/image?token=secret"]) {
    assert.throws(() => applyCommand(issue, { action: "set_art_reference", revision: issue.revision, notes: "Human supplied source.",
      artReference: { kind: "golden_image", title: "Original", assetId: "", url, sourceIdentity: "Original archive" } }, verifiedEditor), /HTTPS|credential|signed/i);
  }
});

test("legacy Golden Image migration preserves history, stales style reviews, and requires a fresh reference when unverified", () => {
  const issue = makeReadyIssue();
  const originalReference = structuredClone(issue.artDirection.references.find(reference => reference.kind === "golden_image"));
  const originalAsset = {
    id: "legacy-golden-image",
    name: "Original Golden Image",
    objectPath: `/objects/uploads/users/${"y".repeat(43)}/${randomUUID()}`,
    contentType: "image/png",
    size: 100,
    caption: "",
    credit: "",
    source: "",
    provenance: "uploaded_unverified",
    pages: [],
    review: "pending",
    reviewer: "",
    reviewNotes: "",
    dpi: 0,
    styleReview: null,
  };
  originalReference.assetId = originalAsset.id;
  originalReference.assetSnapshot = structuredClone(originalAsset);
  issue.artDirection.references = issue.artDirection.references.map(reference =>
    reference.kind === "golden_image" ? originalReference : reference,
  );
  issue.artDirection.history = issue.artDirection.history.filter(reference =>
    reference.kind !== "golden_image",
  );
  issue.artDirection.history.push(structuredClone(originalReference));
  issue.assets.push(originalAsset);
  const originalStyleReviews = issue.assets.map(asset => structuredClone(asset.styleReview));
  const protectedAsset = {
    ...structuredClone(originalAsset),
    objectPath: `/objects/registered-assets/${randomUUID()}`,
  };

  const migrated = workflow.migrateLegacyGoldenImageReference(issue, protectedAsset);
  const current = migrated.artDirection.references.find(reference => reference.kind === "golden_image");
  assert.notEqual(current.id, originalReference.id);
  assert.equal(current.version, originalReference.version + 1);
  assert.equal(current.assetSnapshot.objectPath, protectedAsset.objectPath);
  assert.equal(current.approval, null, "the protected copy still requires a new human confirmation");
  assert.deepEqual(migrated.artDirection.history.find(reference =>
    reference.id === originalReference.id && reference.version === originalReference.version,
  ), originalReference);
  assert.deepEqual(migrated.assets.map(asset => asset.styleReview), originalStyleReviews);
  assert.equal(workflow.assetStyleReady(migrated, migrated.assets[0]), false);
  assert.deepEqual(
    workflow.migrateLegacyGoldenImageReference(migrated, protectedAsset),
    migrated,
    "repeating migration leaves the protected current version unchanged",
  );

  for (const mismatch of [
    { ...protectedAsset, id: "different-asset-id" },
    { ...protectedAsset, objectPath: `/objects/uploads/users/${"z".repeat(43)}/${randomUUID()}` },
    { ...protectedAsset, size: protectedAsset.size + 1 },
    { ...protectedAsset, contentType: "image/jpeg" },
    { ...protectedAsset, contentType: "application/octet-stream" },
  ]) {
    const unresolved = workflow.migrateLegacyGoldenImageReference(issue, mismatch);
    const fresh = unresolved.artDirection.references.find(reference => reference.kind === "golden_image");
    assert.equal(fresh.assetId, "");
    assert.equal(fresh.url, "");
    assert.equal(fresh.assetSnapshot, undefined);
    assert.equal(fresh.approval, null);
    assert.match(fresh.registrationNotes, /fresh reference/i);
    assert.deepEqual(unresolved.artDirection.history.find(reference =>
      reference.id === originalReference.id && reference.version === originalReference.version,
    ), originalReference);
    assert.deepEqual(unresolved.assets.map(asset => asset.styleReview), originalStyleReviews);
    assert.equal(workflow.assetStyleReady(unresolved, unresolved.assets[0]), false);
  }
});

test("legacy Page 1 image migration preserves evidence, stales old verification, and can require a fresh reference", () => {
  const issue = workflow.initialIssue();
  issue.pages[0].copy = "Authoritative recovered Page 1 migration fixture.";
  issue.pages[0].provenance = "repository_reference";
  issue.pages[0].sourceIdentity = `owner/repository:issue.json@${"a".repeat(40)}`;
  const originalAsset = {
    id: "legacy-page-one-art",
    name: "Original Page 1 scan",
    objectPath: `/objects/uploads/users/${"x".repeat(43)}/${randomUUID()}`,
    contentType: "image/png",
    size: 100,
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
  const originalReference = {
    id: "legacy-front-reference",
    version: 4,
    kind: "front_page",
    title: "Original Page 1 scan",
    assetId: originalAsset.id,
    url: "",
    sourceIdentity: "Original archival scan",
    at: "2026-01-01T00:00:00.000Z",
    suppliedBy: "assigned-editor",
    registrationNotes: "Original registration.",
    assetSnapshot: structuredClone(originalAsset),
    approval: {
      reviewer: "Myrtle",
      reviewerAccountId: "assigned-editor",
      reviewerRole: "myrtle_editor",
      notes: "Confirmed the exact original image.",
      at: "2026-01-02T00:00:00.000Z",
    },
  };
  issue.assets = [originalAsset];
  issue.artDirection = {
    references: [structuredClone(originalReference)],
    history: [structuredClone(originalReference)],
  };
  const verification = {
    id: "old-page-one-verification",
    issueRevision: issue.revision,
    at: "2026-01-03T00:00:00.000Z",
    decision: "verified",
    reviewer: "Myrtle",
    reviewerAccountId: "assigned-editor",
    reviewerRole: "myrtle_editor",
    approvalDocumentIdentity: "Archive ledger entry",
    notes: "Compared the exact original Page 1 scan with its approval ledger entry.",
    sourceIdentity: issue.pages[0].sourceIdentity,
    sourceFingerprint: "old-source-fingerprint",
    referenceId: originalReference.id,
    referenceVersion: originalReference.version,
    referenceSourceIdentity: originalReference.sourceIdentity,
    referenceFingerprint: "old-reference-fingerprint",
  };
  issue.pageOneApprovalHistory = [verification];

  const protectedAsset = {
    ...structuredClone(originalAsset),
    objectPath: `/objects/registered-assets/${randomUUID()}`,
  };
  const migrated = workflow.migrateLegacyPageOneReference(issue, protectedAsset);
  const current = migrated.artDirection.references[0];
  assert.equal(current.id === originalReference.id, false);
  assert.equal(current.version, originalReference.version + 1);
  assert.equal(current.assetSnapshot.objectPath, protectedAsset.objectPath);
  assert.equal(current.approval, null, "a copied image cannot inherit the old human confirmation");
  assert.deepEqual(migrated.artDirection.history[0], originalReference);
  assert.deepEqual(migrated.pageOneApprovalHistory, [verification]);
  const stale = workflow.pageOneApprovalHistoryWithCurrentness(migrated).pageOneApprovalHistory[0];
  assert.equal(stale.isCurrent, false);
  assert.ok(stale.staleReasons.includes("reference_version_changed"));
  assert.ok(stale.staleReasons.includes("reference_image_changed"));
  assert.deepEqual(
    workflow.migrateLegacyPageOneReference(migrated, protectedAsset),
    migrated,
    "repeating the migration leaves an already-protected current version unchanged",
  );

  const unresolved = workflow.migrateLegacyPageOneReference(issue);
  assert.equal(unresolved.artDirection.references[0].assetId, "");
  assert.equal(unresolved.artDirection.references[0].url, "");
  assert.equal(unresolved.artDirection.references[0].assetSnapshot, undefined);
  assert.equal(unresolved.artDirection.references[0].approval, null);
  assert.match(unresolved.artDirection.references[0].registrationNotes, /fresh reference/i);
  assert.deepEqual(unresolved.artDirection.history[0], originalReference);
  assert.deepEqual(unresolved.pageOneApprovalHistory, [verification]);
  assert.throws(() => workflow.applyCommand(unresolved, {
    action: "confirm_art_reference",
    revision: unresolved.revision,
    id: unresolved.artDirection.references[0].id,
    checked: true,
    notes: "I inspected the newly supplied original image.",
  }, verifiedEditor), /Supply a fresh reference image/);
});

test("original Page 1 documentation verification is role-bound, version-bound and evidence-only", () => {
  const issue = initialIssue();
  const cover = issue.pages[0];
  cover.copy = "Authoritative recovered cover text — verification fixture.";
  cover.provenance = "repository_reference";
  cover.sourceIdentity = `owner/repository:issues/issue-1.json@${"a".repeat(40)}`;
  const coverAsset = {
    id: "page-one-original-image", name: "Original cover scan",
    objectPath: "/objects/page-one-original-image", contentType: "image/png", size: 17,
    caption: "Original Page 1 scan", credit: "Original creator", source: "Issue #1 archive",
    provenance: "repository_reference", pages: [2], review: "pending",
    reviewer: "", reviewNotes: "", dpi: 300,
  };
  issue.assets = [coverAsset];
  const frontPageReference = {
    id: "confirmed-front-page-v3", version: 3, kind: "front_page",
    title: "Original front-page benchmark", assetId: coverAsset.id, url: "",
    sourceIdentity: "Original archive scan, box 4, item 2",
    at: "2026-01-01T00:00:00.000Z", suppliedBy: verifiedEditor.accountId,
    registrationNotes: "Original supplied for comparison.",
    assetSnapshot: structuredClone(coverAsset),
    approval: {
      reviewer: verifiedEditor.displayName, reviewerAccountId: verifiedEditor.accountId,
      reviewerRole: "myrtle_editor", notes: "Confirmed exact reference identity.",
      at: "2026-01-02T00:00:00.000Z",
    },
  };
  issue.artDirection = { references: [frontPageReference], history: [structuredClone(frontPageReference)] };
  issue.pageSnapshots = [{
    id: "frozen-page-one", issueRevision: issue.revision, at: "2026-01-01T00:00:00.000Z",
    actor: "seeded-fixture", notes: "Existing immutable Page 1 snapshot.",
    page: structuredClone(cover), puzzles: [], assets: [structuredClone(coverAsset)],
  }];
  issue.proofs = [{
    id: "existing-proof", revision: issue.revision, createdAt: "2026-01-01T00:00:00.000Z",
    blockers: ["Fixture blocker"], status: "blocked", approval: null,
  }];
  issue.pageOneApprovalHistory = [];
  const preservedPage = structuredClone(issue.pages[0]);
  const preservedAssets = structuredClone(issue.assets);
  const preservedSnapshots = structuredClone(issue.pageSnapshots);
  const preservedReferences = structuredClone(issue.artDirection);
  const preservedProofs = structuredClone(issue.proofs);
  const command = {
    action: "verify_page_one_approval", revision: issue.revision,
    referenceId: frontPageReference.id, checked: true, decision: "verified",
    approvalDocumentIdentity: "Issue #1 approval ledger, archival entry 1991-01",
    notes: "Compared the original cover masthead and title with the cited approval ledger. The entry names this exact Page 1 as approved.",
    reviewer: "Typed Myrtle name must be ignored.",
  };

  assert.equal(hasAuthoritativePageOneSource(issue), true);
  assert.throws(() => applyCommand(issue, command), error => error.status === 403);
  assert.throws(() => applyCommand(issue, command, { ...verifiedEditor, role: "contributor" }), error => error.status === 403);
  for (const patch of [
    { checked: false },
    { decision: "approved" },
    { approvalDocumentIdentity: "upload" },
    { approvalDocumentIdentity: "" },
    { notes: "" },
    { notes: "Reviewed." },
    { referenceId: "an-old-reference-version" },
  ]) {
    assert.throws(() => applyCommand(issue, { ...command, ...patch }, verifiedEditor));
  }
  const unbacked = structuredClone(issue);
  unbacked.pages[0].provenance = "uploaded_unverified";
  assert.equal(hasAuthoritativePageOneSource(unbacked), false);
  assert.throws(() => applyCommand(unbacked, command, verifiedEditor), /authoritative locked Page 1/);
  const unconfirmed = structuredClone(issue);
  unconfirmed.artDirection.references[0].approval = null;
  assert.throws(() => applyCommand(unconfirmed, command, verifiedEditor), /current confirmed original front-page reference/);

  const updated = applyCommand(issue, command, verifiedEditor);
  const verification = updated.pageOneApprovalHistory[0];
  assert.equal(verification.decision, "verified");
  assert.equal(verification.reviewer, verifiedEditor.displayName);
  assert.equal(verification.reviewerAccountId, verifiedEditor.accountId);
  assert.equal(verification.reviewerRole, "myrtle_editor");
  assert.notEqual(verification.reviewer, command.reviewer);
  assert.equal(verification.sourceIdentity, cover.sourceIdentity);
  assert.equal(verification.referenceId, frontPageReference.id);
  assert.equal(verification.referenceVersion, frontPageReference.version);
  assert.equal(isCurrentPageOneApprovalVerification(updated, verification), true);
  assert.deepEqual(updated.pages[0], preservedPage);
  assert.deepEqual(updated.assets, preservedAssets);
  assert.deepEqual(updated.pageSnapshots, preservedSnapshots);
  assert.deepEqual(updated.artDirection, preservedReferences);
  assert.deepEqual(updated.proofs, preservedProofs);
  assert.equal(updated.pages[0].editorialApproval, null, "document verification must not create an editorial sign-off");
  assert.equal(updated.pages[0].artApproval, null, "document verification must not create an art sign-off");
  assert.deepEqual(readiness(updated).blockers, readiness(issue).blockers);
  const publicIssue = readerSafeIssue(updated);
  assert.equal(publicIssue.pageOneApprovalHistory[0].decision, "verified");
  assert.equal(publicIssue.pageOneApprovalHistory[0].reviewerAccountId, "");
  assert.equal(publicIssue.pageOneApprovalHistory[0].approvalDocumentIdentity, "");
  assert.equal(publicIssue.pageOneApprovalHistory[0].notes, "");
  assert.equal(publicIssue.pageOneApprovalHistory[0].sourceFingerprint, "");
  assert.equal(publicIssue.pageOneApprovalHistory[0].referenceSourceIdentity, "");
  assert.equal(publicIssue.pageOneApprovalHistory[0].referenceFingerprint, "");

  const sourceChanged = structuredClone(updated);
  sourceChanged.pages[0].copy += "\nchanged";
  assert.equal(isCurrentPageOneApprovalVerification(sourceChanged, verification), false);
  assert.deepEqual(pageOneApprovalStaleReasons(sourceChanged, verification), ["source_content_changed"]);
  const reportedSourceChange = pageOneApprovalHistoryWithCurrentness(sourceChanged);
  assert.equal(reportedSourceChange.pageOneApprovalHistory[0].isCurrent, false);
  assert.deepEqual(reportedSourceChange.pageOneApprovalHistory[0].staleReasons, ["source_content_changed"]);
  assert.deepEqual(sourceChanged.pageOneApprovalHistory[0], verification, "stale explanations are derived without changing saved evidence");
  const referenceChanged = applyCommand(updated, {
    action: "set_art_reference", revision: updated.revision, notes: "Register the next original reference version.",
    artReference: {
      kind: "front_page", title: "Next confirmed version", assetId: "", url: "https://example.org/front-page-v4",
      sourceIdentity: "Newly supplied original archive scan",
    },
  }, verifiedEditor);
  assert.equal(isCurrentPageOneApprovalVerification(referenceChanged, verification), false);
  const referenceStaleReasons = pageOneApprovalStaleReasons(referenceChanged, verification);
  assert.ok(referenceStaleReasons.includes("reference_version_changed"));
  assert.ok(referenceStaleReasons.includes("reference_image_changed"));
  assert.deepEqual(referenceChanged.pageOneApprovalHistory[0], verification, "old evidence remains immutable when it becomes stale");
  assert.deepEqual(referenceChanged.pages[0], preservedPage);
  assert.deepEqual(referenceChanged.assets, preservedAssets);
  assert.deepEqual(referenceChanged.pageSnapshots, preservedSnapshots);
  for (const [label, replaceReferenceImage] of [
    ["a changed saved reference-image snapshot", reference => {
      reference.assetSnapshot = {
        ...reference.assetSnapshot,
        objectPath: "/objects/replacement-front-page-scan",
        size: reference.assetSnapshot.size + 1,
      };
    }],
    ["a replaced reference-image asset identity", reference => {
      reference.assetId = "replacement-front-page-asset";
      reference.assetSnapshot = {
        ...reference.assetSnapshot,
        id: "replacement-front-page-asset",
      };
    }],
  ]) {
    const imageChanged = structuredClone(updated);
    replaceReferenceImage(imageChanged.artDirection.references[0]);
    assert.equal(imageChanged.pages[0].copy, updated.pages[0].copy, "the cover copy remains unchanged");
    assert.equal(isCurrentPageOneApprovalVerification(imageChanged, verification), false, label);
    assert.deepEqual(imageChanged.pageOneApprovalHistory[0], verification, `${label}: historical evidence remains unchanged`);
    assert.deepEqual(imageChanged.pages[0], preservedPage, `${label}: the locked Page 1 remains unchanged`);
    assert.deepEqual(imageChanged.pageSnapshots, preservedSnapshots, `${label}: the locked Page 1 snapshot remains unchanged`);
  }
  assert.throws(
    () => applyCommand(referenceChanged, { ...command, revision: referenceChanged.revision }),
    /current confirmed original front-page reference/,
    "a stale reference ID cannot be attested against a newer current reference",
  );
  assert.throws(
    () => applyCommand(updated, { ...command, revision: issue.revision }),
    error => error.status === 409,
    "an old saved session cannot submit a verification against a newer issue revision",
  );

  const savedReplacement = applyCommand(updated, {
    action: "add_asset",
    revision: updated.revision,
    asset: {
      ...coverAsset,
      name: "Replacement original Page 1 scan",
      objectPath: "/objects/replacement-front-page-scan",
      source: "Replacement original archive scan",
      pages: [],
    },
  });
  const replacementAssetId = savedReplacement.assets.find(a => a.objectPath === "/objects/replacement-front-page-scan").id;
  const originalPageOne = structuredClone(updated.pages[0]);
  const originalPageSnapshots = structuredClone(updated.pageSnapshots);
  const originalPageOneHistory = structuredClone(updated.pageOneApprovalHistory);
  const originalReferenceHistory = structuredClone(updated.artDirection.history);
  const replacementRegistered = applyCommand(savedReplacement, {
    action: "set_art_reference",
    revision: savedReplacement.revision,
    notes: "Register the newly saved original Page 1 scan for inspection.",
    artReference: {
      kind: "front_page",
      title: "Replacement original front page",
      assetId: replacementAssetId,
      url: "",
      sourceIdentity: "Replacement original archive scan, box 4, item 3",
    },
  }, verifiedEditor);
  const replacementReference = replacementRegistered.artDirection.references.find(r => r.kind === "front_page");
  assert.equal(replacementReference.assetId, replacementAssetId);
  assert.deepEqual(replacementReference.assetSnapshot, savedReplacement.assets.find(a => a.id === replacementAssetId));
  assert.equal(replacementReference.approval, null, "a saved replacement image cannot inherit the previous reference's confirmation");
  assert.deepEqual(replacementRegistered.artDirection.history.slice(0, originalReferenceHistory.length), originalReferenceHistory, "registering a proposal preserves all existing reference versions");
  assert.equal(replacementRegistered.artDirection.history.at(-1).approval, null, "the proposed history version remains unconfirmed");
  assert.deepEqual(replacementRegistered.pages[0], originalPageOne, "registering a proposal does not change locked Page 1");
  assert.deepEqual(replacementRegistered.pageSnapshots, originalPageSnapshots, "registering a proposal does not change Page 1 snapshots");
  assert.deepEqual(replacementRegistered.pageOneApprovalHistory, originalPageOneHistory, "registering a proposal does not change Page 1 approval history");
  assert.throws(
    () => applyCommand(replacementRegistered, {
      ...command,
      revision: replacementRegistered.revision,
      referenceId: replacementReference.id,
    }, verifiedEditor),
    /current confirmed original front-page reference/,
    "Page 1 verification must wait for explicit confirmation of the replacement image",
  );

  const replacementConfirmed = applyCommand(replacementRegistered, {
    action: "confirm_art_reference",
    revision: replacementRegistered.revision,
    id: replacementReference.id,
    notes: "Inspected the exact replacement original Page 1 scan.",
    checked: true,
  }, verifiedEditor);
  const confirmedReplacementReference = replacementConfirmed.artDirection.references.find(r => r.kind === "front_page");
  assert.equal(confirmedReplacementReference.approval.reviewerAccountId, verifiedEditor.accountId);
  assert.deepEqual(replacementConfirmed.artDirection.history.slice(0, replacementRegistered.artDirection.history.length), replacementRegistered.artDirection.history, "explicit confirmation appends a version without rewriting the proposal or existing references");
  assert.deepEqual(replacementConfirmed.pages[0], originalPageOne, "confirming a reference does not change locked Page 1");
  assert.deepEqual(replacementConfirmed.pageSnapshots, originalPageSnapshots, "confirming a reference does not change Page 1 snapshots");
  assert.deepEqual(replacementConfirmed.pageOneApprovalHistory, originalPageOneHistory, "confirming a reference does not change Page 1 approval history");
  const replacementVerified = applyCommand(replacementConfirmed, {
    ...command,
    revision: replacementConfirmed.revision,
    referenceId: confirmedReplacementReference.id,
  }, verifiedEditor);
  assert.equal(replacementVerified.pageOneApprovalHistory.length, 2);
  assert.deepEqual(replacementVerified.pageOneApprovalHistory[0], verification, "the earlier verification remains unchanged in history");
  const replacementVerification = replacementVerified.pageOneApprovalHistory[1];
  assert.equal(replacementVerification.referenceId, confirmedReplacementReference.id);
  assert.equal(replacementVerification.referenceVersion, confirmedReplacementReference.version);
  assert.equal(isCurrentPageOneApprovalVerification(replacementVerified, replacementVerification), true);
  assert.equal(isCurrentPageOneApprovalVerification(replacementVerified, verification), false);

  const importedClaim = structuredClone(updated);
  importedClaim.pageOneApprovalHistory = [{ id: "forged-imported-approval-claim" }];
  const imported = safeImport(updated, importedClaim);
  assert.deepEqual(imported.pageOneApprovalHistory, updated.pageOneApprovalHistory);
});

test("human style passes need both originals, every check, evidence and authenticated identity", () => {
  const issue = makeReadyIssue();
  const command = { action: "review_asset_style", revision: issue.revision, id: issue.assets[0].id, decision: "passed",
    reviewer: "Human art reviewer", notes: "Compared the original source and both benchmarks at print size.", checked: true, styleChecks: allStyleChecks() };
  const missing = structuredClone(issue); delete missing.artDirection;
  assert.throws(() => applyCommand(missing, command, undefined, "actual-account"), /Both exact original/i);
  assert.throws(() => applyCommand(issue, { ...command, styleChecks: { ...allStyleChecks(), legibilityPrint: false } }, undefined, "actual-account"), /Every style criterion/i);
  assert.throws(() => applyCommand(issue, { ...command, notes: "" }, undefined, "actual-account"), /notes|review/i);
  assert.throws(() => applyCommand(issue, command), /Authenticated/i);
  const reviewed = applyCommand(issue, command, undefined, "actual-account");
  assert.equal(reviewed.assets[0].styleReview.reviewerAccountId, "actual-account");
  assert.equal(assetStyleReady(reviewed, reviewed.assets[0]), true);
  assert.equal(reviewed.pages[1].artApproval, null);
  assert.deepEqual(reviewed.pages[0], issue.pages[0]);
  const rejected = applyCommand(missing, { ...command, decision: "failed", styleChecks: { ...allStyleChecks(), referenceMatch: false } }, undefined, "actual-account");
  assert.equal(rejected.assets[0].styleReview.decision, "failed");
});

test("new reference versions make old style evidence stale without rewriting it or locked pages", () => {
  const issue = makeReadyIssue();
  const locked = applyCommand(issue, { action: "lock_page", revision: issue.revision, page: 2, notes: "Human inspected the frozen issue page." }, verifiedEditor);
  const updated = applyCommand(locked, { action: "set_art_reference", revision: locked.revision, notes: "Register another actual reference version.",
    artReference: { kind: "golden_image", title: "Next original reference scan", assetId: "", url: "https://example.org/new-original", sourceIdentity: "Owner provided original — fixture" } }, verifiedEditor);
  assert.equal(assetStyleReady(updated, updated.assets[0]), false);
  assert.deepEqual(updated.assets[0].styleReview, locked.assets[0].styleReview);
  assert.deepEqual(updated.pageSnapshots, locked.pageSnapshots);
  assert.deepEqual(updated.pages[0], issue.pages[0]);
  assert.throws(() => applyCommand(updated, { action: "review_asset_style", revision: updated.revision, id: updated.assets[0].id, decision: "failed", checked: true, reviewer: "Human", notes: "Needs changes.", styleChecks: allStyleChecks() }, undefined, "actual-account"), /locked|Branch/i);
});

test("imports and asset metadata cannot smuggle style approval or replace local original references", () => {
  const issue = makeReadyIssue();
  const candidate = structuredClone(issue);
  candidate.artDirection.references[0].sourceIdentity = "Fake imported replacement";
  const imported = safeImport(issue, candidate);
  assert.deepEqual(imported.artDirection, issue.artDirection);
  assert.equal(imported.assets[0].styleReview, null);
  const edited = applyCommand(issue, { action: "edit_asset", revision: issue.revision, id: issue.assets[0].id, asset: { ...issue.assets[0], caption: "Explicit metadata edit" } });
  assert.equal(edited.assets[0].styleReview, null);
  assert.equal(edited.assets[0].provenance, issue.assets[0].provenance);
  const added = applyCommand(issue, { action: "add_asset", revision: issue.revision, asset: { ...issue.assets[0], id: "new-id", pages: [] } });
  assert.equal(added.assets.at(-1).styleReview, null);
  assert.equal(added.assets.at(-1).review, "pending");
});

test("locking is explicit, role verified, and snapshots freeze copy plus dependencies", () => {
  const issue = makeReadyIssue();
  const command = { revision: issue.revision, action: "lock_page", page: 2, notes: "Human inspected all page evidence." };
  assert.throws(() => applyCommand(issue, command), error => error.status === 403);
  const locked = applyCommand(issue, command, verifiedEditor);
  assert.equal(issue.pages[1].locked, false);
  assert.equal(locked.pages[1].locked, true);
  assert.equal(locked.pageSnapshots.length, 1);
  assert.deepEqual(locked.pageSnapshots[0].page, locked.pages[1]);
  assert.equal(locked.pageSnapshots[0].puzzles[0].solution, "Solution 2");
  assert.equal(locked.pageSnapshots[0].assets[0].dpi, 300);
  assert.equal(locked.pageSnapshots[0].actor, verifiedEditor.accountId);
  assert.throws(() => applyCommand(locked, { revision: locked.revision, action: "edit_page", page: 2, title: "Changed", copy: "Changed" }), /locked/);
  assert.throws(() => applyCommand(locked, { revision: locked.revision, action: "validate_puzzle", id: "puzzle-2", decision: "failed", reviewer: "Reviewer", notes: "Changed" }), /locked/);
  assert.throws(() => applyCommand(locked, { revision: locked.revision, action: "edit_asset", id: "asset-2", asset: { ...locked.assets[0], caption: "Changed" } }), /locked/);
});

test("branching keeps the frozen lock and creates an unapproved persistent draft", () => {
  const issue = makeReadyIssue();
  const locked = applyCommand(issue, { revision: issue.revision, action: "lock_page", page: 2, notes: "Ready." }, verifiedEditor);
  const frozen = structuredClone(locked.pageSnapshots);
  const draft = applyCommand(locked, { revision: locked.revision, action: "branch_page", page: 2, notes: "Correct editorial text." }, undefined, "contributor-account");
  assert.deepEqual(draft.pageSnapshots, frozen);
  assert.equal(draft.pages[1].locked, false);
  assert.equal(draft.pages[1].status, "draft");
  assert.equal(draft.pages[1].editorialApproval, null);
  assert.equal(draft.pages[1].artApproval, null);
  assert.equal(draft.pages[1].printApproval, null);
  assert.equal(draft.pages[1].branchedFrom, frozen[0].id);
  const saved = applyCommand(draft, { revision: draft.revision, action: "edit_page", page: 2, title: "New title", copy: "New sourced editorial copy", sourceIdentity: "Editorial contributor manuscript" });
  assert.deepEqual(saved.pageSnapshots, frozen);
  assert.equal(saved.pages[1].copy, "New sourced editorial copy");
  assert.equal(saved.pages[1].draftRevision, 3);
  assert.equal(saved.pages.length, 10);
  assert.deepEqual(saved.pages[0], issue.pages[0]);
});

test("no branch or alternative new command can change protected Page 1", () => {
  const issue = makeReadyIssue();
  for (const action of ["branch_page", "lock_page", "check_page_print", "set_artwork_slots"]) {
    assert.throws(() => applyCommand(issue, { revision: issue.revision, action, page: 1, notes: "Change.", reviewer: "Editor", checked: true, artworkSlots: [] }, verifiedEditor));
  }
});

test("source identity, human print evidence and effective DPI are genuine lock blockers", () => {
  for (const mutate of [
    issue => { issue.pages[1].sourceIdentity = ""; },
    issue => { issue.pages[1].printApproval = null; },
    issue => { issue.assets[0].dpi = 72; },
    issue => { issue.puzzles[0].sourceIdentity = ""; },
    issue => { issue.puzzles[0].validationNotes = ""; },
    issue => { issue.pages[1].artworkSlots = [{ id: "planned", label: "Masthead illustration", assetId: "" }]; },
  ]) {
    const issue = makeReadyIssue();
    mutate(issue);
    const check = readiness(issue).pageChecks.find(c => c.page === 2);
    assert.equal(check.canLock, false);
    assert.ok(check.blockers.length);
    assert.throws(() => applyCommand(issue, { revision: issue.revision, action: "lock_page", page: 2, notes: "Attempted lock." }, verifiedEditor), /cannot be locked/);
  }
});

test("artwork slot edits persist, reject missing assets and reset evidence", () => {
  const issue = makeReadyIssue();
  const slots = [{ id: "feature", label: "Feature illustration", assetId: "asset-2" }];
  const next = applyCommand(issue, { revision: issue.revision, action: "set_artwork_slots", page: 2, artworkSlots: slots });
  assert.deepEqual(next.pages[1].artworkSlots, slots);
  assert.equal(next.pages[1].printApproval, null);
  assert.equal(next.pages[1].editorialApproval, null);
  assert.throws(() => applyCommand(issue, { revision: issue.revision, action: "set_artwork_slots", page: 2, artworkSlots: [{ ...slots[0], assetId: "missing" }] }), /valid asset/);
  assert.throws(() => applyCommand(next, { revision: next.revision, action: "delete_asset", id: "asset-2" }), /Unassign|slots/);
});

test("imports preserve local locks and evidence and cannot fabricate new frozen approvals", () => {
  const issue = makeReadyIssue();
  const locked = applyCommand(issue, { revision: issue.revision, action: "lock_page", page: 2, notes: "Ready." }, verifiedEditor);
  const imported = structuredClone(locked);
  imported.pages[1].copy = "Untrusted replacement.";
  imported.pageSnapshots[0].page.copy = "Fake frozen copy.";
  imported.assets[0].credit = "Untrusted credit.";
  imported.puzzles[0].solution = "Untrusted answer.";
  const next = safeImport(locked, imported);
  assert.deepEqual(next.pages[1], locked.pages[1]);
  assert.deepEqual(next.pageSnapshots, locked.pageSnapshots);
  assert.deepEqual(next.assets.find(a => a.id === "asset-2"), locked.assets.find(a => a.id === "asset-2"));
  assert.deepEqual(next.puzzles.find(p => p.id === "puzzle-2"), locked.puzzles.find(p => p.id === "puzzle-2"));
  assert.equal(next.pages[2].status, "draft");
  assert.equal(next.pages[2].printApproval, null);
  assert.equal(next.puzzles.find(p => p.id === "puzzle-3").validation, "unvalidated");
});

test("public current and historical responses remove solutions and answer-bearing validation notes", () => {
  const issue = makeReadyIssue();
  const locked = applyCommand(issue, { revision: issue.revision, action: "lock_page", page: 2, notes: "Ready." }, verifiedEditor);
  const safe = readerSafeIssue(locked);
  assert.equal(safe.puzzles[0].solution, "");
  assert.equal(safe.puzzles[0].validationNotes, "");
  assert.equal(safe.pageSnapshots[0].puzzles[0].solution, "");
  assert.equal(safe.pageSnapshots[0].puzzles[0].validationNotes, "");
  assert.equal(locked.puzzles[0].solution, "Solution 2");
  assert.equal(locked.pageSnapshots[0].puzzles[0].solution, "Solution 2");
});

test("human puzzle validation records identity and time but never accepts a missing source identity", () => {
  const issue = makeReadyIssue();
  issue.puzzles[0].validation = "unvalidated";
  const command = { revision: issue.revision, action: "validate_puzzle", id: "puzzle-2", decision: "passed", reviewer: "Named human", notes: "Solved clues against the protected stored solution." };
  const next = applyCommand(issue, command, undefined, "authenticated-reviewer");
  assert.equal(next.puzzles[0].validationAccountId, "authenticated-reviewer");
  assert.ok(Date.parse(next.puzzles[0].validationAt));
  assert.equal(next.pages[1].printApproval, null);
  issue.puzzles[0].sourceIdentity = "";
  assert.throws(() => applyCommand(issue, command), /source identity/);
});

test("stale draft commands never overwrite newer revisions", () => {
  const issue = makeReadyIssue();
  assert.throws(() => applyCommand(issue, { revision: 0, action: "branch_page", page: 2, notes: "Stale." }), error => error.status === 409);
});

test("the locked cover's print readiness uses explicit whole-issue human evidence without editing it", () => {
  const issue = makeReadyIssue();
  const cover = structuredClone(issue.pages[0]);
  issue.pages[0].printApproval = null;
  const preservedCover = structuredClone(issue.pages[0]);
  assert.equal(readiness(issue).pageChecks[0].print, true);
  issue.checklist.find(c => c.id === "pagination").checked = false;
  assert.equal(readiness(issue).pageChecks[0].print, false);
  assert.deepEqual(issue.pages[0], preservedCover);
  assert.equal(issue.pages[0].copy, cover.copy);
  assert.equal(issue.pages[0].locked, true);
});

function makeReadyIssue() {
  const issue = initialIssue();
  issue.pages = issue.pages.map((page) => ({
    ...page,
    copy: `Sourced copy for page ${page.number}.`,
    sourceIdentity: "Manual test fixture — not production data",
    status: "approved",
    editorialApproval: { reviewer: "Myrtle Editor", reviewerAccountId: "oidc-myrtle-1", reviewerRole: "myrtle_editor", notes: "Verified review.", at: "2026-01-01T00:00:00.000Z" },
    artApproval: { reviewer: "Contributor", notes: "Self-attested review.", at: "2026-01-01T00:00:00.000Z" },
    printApproval: { reviewer: "Contributor", notes: "Manually inspected print fixture.", at: "2026-01-01T00:00:00.000Z" },
  }));
  issue.assets = Array.from({ length: 9 }, (_, index) => {
    const page = index + 2;
    return {
      id: `asset-${page}`,
      name: `Artwork for page ${page}`,
      objectPath: `/objects/asset-${page}`,
      contentType: "image/png",
      size: 1,
      caption: `Artwork ${page}`,
      credit: "Contributor",
      source: "Original source",
      provenance: "uploaded_unverified",
      pages: [page],
      review: "approved",
      reviewer: "Contributor",
      reviewNotes: "Self-attested review.",
      dpi: 300,
    };
  });
  issue.puzzles = Array.from({ length: 9 }, (_, index) => {
    const page = index + 2;
    return {
      id: `puzzle-${page}`,
      title: `Puzzle ${page}`,
      kind: "crossword",
      source: `Puzzle source ${page}`,
      sourceIdentity: "Manual test fixture — not production data",
      solution: `Solution ${page}`,
      validation: "passed",
      validationNotes: "Self-attested correctness check.",
      reviewer: "Contributor",
      artworkId: `asset-${page}`,
      pages: [page],
      provenance: "working_draft",
    };
  });
  issue.checklist = issue.checklist.map((item) => ({
    ...item,
    checked: true,
    reviewer: "Contributor",
    notes: "Self-attested checklist review.",
  }));
  const checks = { referenceMatch: true, spotInks: true, typography: true, inkIllustration: true, halftoneRegistration: true, boxedComposition: true, legibilityPrint: true, provenancePreserved: true };
  const references = ["golden_image", "front_page"].map(kind => ({
    id: `test-${kind}`, kind, version: 1, title: "TEST FIXTURE ONLY",
    assetId: "", url: `https://example.org/test-fixture/${kind}`, sourceIdentity: "Unit-test evidence, never seeded",
    at: "2026-01-01T00:00:00.000Z", suppliedBy: verifiedEditor.accountId,
    approval: { reviewer: verifiedEditor.displayName, reviewerAccountId: verifiedEditor.accountId, reviewerRole: "myrtle_editor", notes: "Test fixture only.", at: "2026-01-01T00:00:00.000Z" },
  }));
  issue.artDirection = { references, history: structuredClone(references) };
  issue.assets = issue.assets.map(a => ({
    ...a, styleReview: { decision: "passed", checks: { ...checks }, reviewer: "Fixture reviewer", reviewerAccountId: "test-actor", notes: "Unit test only.", at: "2026-01-01T00:00:00.000Z", referenceIds: references.map(r => r.id) },
  }));
  return issue;
}

test("legacy Myrtle labels do not satisfy editorial or final proof readiness gates", () => {
  const issue = makeReadyIssue();
  issue.pages[1].editorialApproval = {
    reviewer: "Myrtle", notes: "Old typed-name sign-off.", at: "2026-01-01T00:00:00.000Z",
  };
  assert.ok(readiness(issue).blockers.some((blocker) => blocker.includes("Page 2: a verified Myrtle editor account")));

  issue.pages[1].editorialApproval = {
    reviewer: "Myrtle Editor", reviewerAccountId: verifiedEditor.accountId,
    reviewerRole: "myrtle_editor", notes: "Verified.", at: "2026-01-01T00:00:00.000Z",
  };
  issue.proofs = [{
    id: "legacy-approved-proof", revision: issue.revision, createdAt: "2026-01-01T00:00:00.000Z",
    blockers: [], status: "approved",
    approval: { reviewer: "Myrtle", notes: "Old typed-name sign-off.", at: "2026-01-01T00:00:00.000Z" },
  }];
  assert.equal(readiness(issue).blockers.length, 0);
  assert.equal(readiness(issue).readyToPrint, false);
});

test("every issue has ten ordered pages and Page 1 cannot be changed or approved", () => {
  const issue = initialIssue();
  assert.deepEqual(issue.pages.map((page) => page.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(issue.pages[0].locked, true);

  for (const command of [
    { action: "edit_page", page: 1, title: "Replacement", copy: "Replacement copy." },
    { action: "submit_page", page: 1 },
    { action: "approve_editorial", page: 1, reviewer: "Myrtle", notes: "Reviewed." },
    { action: "approve_art", page: 1, reviewer: "Contributor", notes: "Reviewed." },
  ]) {
    assert.throws(() => applyCommand(issue, { revision: issue.revision, ...command }), /Page 1 is locked/);
  }
});

test("only explicitly assigned account IDs receive the Myrtle editor role", () => {
  const assignments = " oidc-myrtle-1,\n oidc-myrtle-2 ";
  assert.equal(hasMyrtleEditorRole("oidc-myrtle-1", assignments), true);
  assert.equal(hasMyrtleEditorRole("oidc-myrtle-2", assignments), true);
  assert.equal(hasMyrtleEditorRole("oidc-other", assignments), false);
  assert.equal(hasMyrtleEditorRole(undefined, assignments), false);
  assert.equal(hasMyrtleEditorRole("oidc-myrtle-1", ""), false);
});

test("only explicitly configured newsroom administrators can manage editor access", () => {
  const admins = " oidc-owner-1,\n oidc-owner-2 ";
  assert.equal(hasNewsroomAdminRole("oidc-owner-1", admins), true);
  assert.equal(hasNewsroomAdminRole("oidc-owner-2", admins), true);
  assert.equal(hasNewsroomAdminRole("oidc-myrtle-1", admins), false);
  assert.equal(hasNewsroomAdminRole(undefined, admins), false);
  assert.equal(hasNewsroomAdminRole("oidc-owner-1", ""), false);
});

test("editorial approval requires a verified role and stores authenticated identity, not the submitted name", () => {
  const issue = initialIssue();
  const page = issue.pages.find((candidate) => candidate.number === 2);
  page.status = "in_review";
  page.copy = "Actual editorial copy in a unit-test fixture.";
  page.sourceIdentity = "Unit test editorial fixture";
  issue.puzzles = [{
    id: "puzzle-2", title: "Puzzle", kind: "crossword", source: "Clues", solution: "Solution",
    validation: "passed", validationNotes: "Checked.", reviewer: "Contributor", artworkId: "",
    pages: [2], provenance: "working_draft", sourceIdentity: "Manual test fixture",
  }];
  const command = { revision: issue.revision, action: "approve_editorial", page: 2, reviewer: "Myrtle", notes: "Reviewed." };
  assert.throws(() => applyCommand(issue, command), (error) => error instanceof PressError && error.status === 403);
  const updated = applyCommand(issue, command, verifiedEditor);
  const approval = updated.pages.find((candidate) => candidate.number === 2).editorialApproval;
  assert.equal(approval.reviewer, "Myrtle Editor");
  assert.equal(approval.reviewerAccountId, "oidc-myrtle-1");
  assert.equal(approval.reviewerRole, "myrtle_editor");
});

test("GitHub issue imports preserve Page 1 without inferring puzzle or artwork approval", () => {
  const current = initialIssue();
  const imported = structuredClone(current);
  imported.pages[0] = { ...imported.pages[0], title: "Tampered", copy: "Tampered", locked: false };
  imported.pages[1] = {
    ...imported.pages[1],
    status: "approved",
    editorialApproval: { reviewer: "Myrtle", notes: "Claimed approval", at: "2026-01-01T00:00:00.000Z" },
  };
  imported.assets = [{
    id: "imported-asset",
    name: "Imported art",
    objectPath: "/objects/imported-asset",
    contentType: "image/png",
    size: 10,
    caption: "",
    credit: "Contributor",
    source: "Source",
    provenance: "repository_reference",
    pages: [2],
    review: "approved",
    reviewer: "Myrtle",
    reviewNotes: "Claimed approval",
    dpi: 300,
  }];
  imported.puzzles = [{
    id: "imported-puzzle",
    title: "Imported puzzle",
    kind: "crossword",
    source: "Clues",
    solution: "Solution",
    validation: "passed",
    validationNotes: "Claimed review",
    reviewer: "Myrtle",
    artworkId: "imported-asset",
    pages: [2],
    provenance: "repository_reference",
  }];
  imported.checklist = current.checklist.map((item) => ({ ...item, checked: true, reviewer: "Myrtle", notes: "Claimed review" }));
  imported.proofs = [{ id: "old-proof", revision: 1, createdAt: "2026-01-01T00:00:00.000Z", blockers: [], status: "approved", approval: { reviewer: "Myrtle", notes: "Claimed approval", at: "2026-01-01T00:00:00.000Z" } }];

  assert.equal(ImportIssueBody.safeParse({ revision: 1, issue: { ...imported, pages: imported.pages.slice(0, 9) }, confirmed: true }).success, false);
  assert.equal(ImportIssueBody.safeParse({ revision: 1, issue: { ...imported, pages: [{ ...imported.pages[0], number: 11 }, ...imported.pages.slice(1)] }, confirmed: true }).success, false);
  assert.equal(ImportIssueBody.safeParse({ revision: 1, issue: imported, confirmed: false }).success, true);

  const result = safeImport(current, imported);
  assert.deepEqual(result.pages[0], current.pages[0]);
  assert.equal(result.pages.length, 10);
  assert.equal(result.pages[1].status, "draft");
  assert.equal(result.pages[1].editorialApproval, null);
  assert.equal(result.pages[1].artApproval, null);
  assert.equal(result.assets[0].provenance, "uploaded_unverified");
  assert.equal(result.assets[0].review, "pending");
  assert.equal(result.assets[0].reviewer, "");
  assert.equal(result.puzzles[0].provenance, "imported_unverified");
  assert.equal(result.puzzles[0].validation, "unvalidated");
  assert.equal(result.puzzles[0].reviewer, "");
  assert.ok(result.checklist.every((item) => !item.checked && !item.reviewer));
  assert.deepEqual(result.proofs, []);

  const duplicatePages = structuredClone(imported);
  duplicatePages.pages[9].number = 9;
  assert.throws(() => safeImport(current, duplicatePages), /exactly pages 1 through 10/);
});

test("only separately confirmed GitHub source loading can replace the locked Page 1 copy", () => {
  const current = initialIssue();
  const remote = structuredClone(current);
  remote.pages[0] = {
    ...remote.pages[0],
    title: "Authoritative cover",
    copy: "Copy from the selected GitHub source.",
    provenance: "repository_reference",
  };

  const pushed = preserveGitHubPageOneForPush(current, remote);
  assert.deepEqual(pushed.pages[0], remote.pages[0], "push preserves GitHub's authoritative cover");
  assert.deepEqual(current.pages[0], initialIssue().pages[0], "push does not mutate the local working copy");

  assert.throws(
    () => ensureGitHubSourceLoadConfirmed(false),
    (error) => error instanceof PressError && error.status === 400 && /separate explicit authorization/.test(error.message),
  );
  ensureGitHubSourceLoadConfirmed(true);

  const loaded = applyGitHubPageOneSource(
    current,
    remote.pages[0],
    "owner/repo:issues/1.json@head-sha",
    "authorized-editor",
  );
  assert.equal(loaded.pages[0].copy, remote.pages[0].copy);
  assert.equal(loaded.pages[0].title, remote.pages[0].title);
  assert.equal(loaded.pages[0].locked, true);
  assert.equal(loaded.pages[0].provenance, "repository_reference");
  assert.equal(loaded.pages[0].sourceIdentity, "owner/repo:issues/1.json@head-sha");
  assert.equal(loaded.pages[0].status, "draft");
  assert.equal(loaded.pages[0].editorialApproval, null);
  assert.equal(loaded.pages[0].artApproval, null);
  assert.equal(loaded.pages[0].printApproval, null);
  assert.equal(loaded.pageSnapshots.at(-1).actor, "authorized-editor");
  assert.match(loaded.pageSnapshots.at(-1).notes, /no editorial\/art\/print approval granted/);
  assert.equal(loaded.revision, current.revision + 1);
  assert.deepEqual(loaded.pages.slice(1), current.pages.slice(1));
  assert.throws(
    () => applyGitHubPageOneSource(loaded, { ...remote.pages[0], copy: "Replacement copy." }),
    (error) => error instanceof PressError && error.status === 409,
  );
});

test("uploads are limited to the documented 20 MB App Storage cap", () => {
  const metadata = { name: "press.png", size: 20 * 1024 * 1024, contentType: "image/png" };
  assert.equal(RequestUploadUrlBody.safeParse(metadata).success, true);
  assert.equal(RequestUploadUrlBody.safeParse({ ...metadata, size: metadata.size + 1 }).success, false);
  assert.equal(RequestUploadUrlBody.safeParse({ ...metadata, size: 0 }).success, false);
});

test("asset metadata is saved only when it matches the completed App Storage object", () => {
  const asset = { size: 10, contentType: "image/png" };
  assert.doesNotThrow(() => ensureUploadedAssetMetadata(asset, { size: "10", contentType: "image/png" }));
  assert.throws(() => ensureUploadedAssetMetadata(asset, { size: "9", contentType: "image/png" }), /size does not match/);
  assert.throws(() => ensureUploadedAssetMetadata(asset, { size: "10", contentType: "text/plain" }), /type does not match/);
});

test("stale writes return a 409 conflict instead of overwriting a newer issue", () => {
  assert.doesNotThrow(() => ensureCurrentRevision(7, 7));
  assert.throws(
    () => ensureCurrentRevision(8, 7),
    (error) => error instanceof PressError && error.status === 409 && /another session/.test(error.message),
  );
  assert.throws(
    () => ensureGitHubPreviewRevision(8, 7),
    (error) => error instanceof PressError && error.status === 409 && /working copy changed/.test(error.message),
  );
});

test("editing a puzzle clears its human validation and both page sign-offs", () => {
  const issue = initialIssue();
  const page = issue.pages.find((candidate) => candidate.number === 2);
  page.status = "approved";
  page.editorialApproval = { reviewer: "Myrtle", notes: "Self-attested.", at: "2026-01-01T00:00:00.000Z" };
  page.artApproval = { reviewer: "Contributor", notes: "Self-attested.", at: "2026-01-01T00:00:00.000Z" };
  issue.puzzles = [{
    id: "puzzle-2", title: "Puzzle", kind: "crossword", source: "Clues", solution: "Solution",
    validation: "passed", validationNotes: "Checked.", reviewer: "Contributor", artworkId: "",
    pages: [2], provenance: "working_draft",
  }];

  const updated = applyCommand(issue, {
    revision: issue.revision,
    action: "edit_puzzle",
    id: "puzzle-2",
    puzzle: { ...issue.puzzles[0], source: "Changed clues" },
  });
  assert.equal(updated.puzzles[0].validation, "unvalidated");
  assert.equal(updated.pages.find((candidate) => candidate.number === 2).status, "draft");
  assert.equal(updated.pages.find((candidate) => candidate.number === 2).editorialApproval, null);
  assert.equal(updated.pages.find((candidate) => candidate.number === 2).artApproval, null);
});

test("re-reviewing artwork invalidates page sign-offs and leaves it pending until explicitly reviewed", () => {
  const issue = initialIssue();
  const page = issue.pages.find((candidate) => candidate.number === 2);
  page.status = "approved";
  page.editorialApproval = { reviewer: "Myrtle", notes: "Self-attested.", at: "2026-01-01T00:00:00.000Z" };
  page.artApproval = { reviewer: "Contributor", notes: "Self-attested.", at: "2026-01-01T00:00:00.000Z" };
  issue.assets = [{
    id: "asset-2", name: "Art", objectPath: "/objects/asset-2", contentType: "image/png",
    size: 1, caption: "", credit: "Contributor", source: "Source", provenance: "uploaded_unverified",
    pages: [2], review: "approved", reviewer: "Contributor", reviewNotes: "Reviewed.", dpi: 300,
  }];
  issue.puzzles = [{
    id: "puzzle-2", title: "Puzzle", kind: "crossword", source: "Clues", solution: "Solution",
    validation: "passed", validationNotes: "Checked.", reviewer: "Contributor", artworkId: "asset-2",
    pages: [2], provenance: "working_draft",
  }];

  const updated = applyCommand(issue, {
    revision: issue.revision,
    action: "review_asset",
    id: "asset-2",
    decision: "rejected",
    reviewer: "Contributor",
    notes: "Re-check required.",
  });
  assert.equal(updated.assets[0].review, "rejected");
  assert.equal(updated.pages.find((candidate) => candidate.number === 2).status, "draft");
  assert.equal(updated.pages.find((candidate) => candidate.number === 2).editorialApproval, null);
  assert.equal(updated.pages.find((candidate) => candidate.number === 2).artApproval, null);
});

test("preflight approvals are bound to one exact issue revision", () => {
  const ready = makeReadyIssue();
  assert.equal(readiness(ready).blockers.length, 0);

  const preflight = applyCommand(ready, { revision: ready.revision, action: "run_preflight" });
  const proof = preflight.proofs.at(-1);
  assert.equal(proof.status, "awaiting_review");
  assert.equal(proof.revision, preflight.revision);

  const changed = applyCommand(preflight, {
    revision: preflight.revision,
    action: "check_continuity",
    id: preflight.checklist[0].id,
    checked: true,
    reviewer: "Contributor",
    notes: "Rechecked after preflight.",
  });
  assert.equal(changed.revision, proof.revision + 1);
  assert.throws(
    () => applyCommand(changed, {
      revision: changed.revision,
      action: "approve_proof",
      id: proof.id,
      reviewer: "Myrtle",
      notes: "Self-attested review.",
    }),
    /fresh, unblocked preflight/,
  );

  const refreshed = applyCommand(changed, { revision: changed.revision, action: "run_preflight" });
  const currentProof = refreshed.proofs.at(-1);
  assert.equal(currentProof.revision, refreshed.revision);
  assert.throws(
    () => applyCommand(refreshed, {
      revision: refreshed.revision,
      action: "approve_proof",
      id: currentProof.id,
      reviewer: "Myrtle",
      notes: "A typed name is not a verified role.",
    }),
    (error) => error instanceof PressError && error.status === 403,
  );
  const approved = applyCommand(refreshed, {
    revision: refreshed.revision,
    action: "approve_proof",
    id: currentProof.id,
    reviewer: "Myrtle",
    notes: "Self-attested review.",
  }, verifiedEditor);
  assert.equal(approved.proofs.at(-1).status, "approved");
  assert.equal(readiness(approved).readyToPrint, true);
  assert.equal(readiness(applyCommand(approved, {
    revision: approved.revision,
    action: "check_continuity",
    id: approved.checklist[0].id,
    checked: true,
    reviewer: "Contributor",
    notes: "Later revision.",
  })).readyToPrint, false);
});
