import { randomUUID } from "node:crypto";
import { GetIssueResponse, ExecutePressCommandBody, GetReadinessResponse } from "@workspace/api-zod";
import { MYRTLE_EDITOR_ROLE } from "./press-roles";
import {
  hasAuthoritativePageOneSource,
  lockedSnapshot, pageAssets, pageOneApprovalVerificationBasis, pageReadiness,
} from "./page-production";
import { assetStyleReady, artReferenceIds, confirmedArtReferences, STYLE_CHECK_KEYS } from "./art-direction";
import { productionQueue } from "./production-queue";
export { readerSafeIssue, pageOneApprovalHistoryWithCurrentness } from "./page-production";

export type Issue = ReturnType<typeof GetIssueResponse.parse>;
export type Command = ReturnType<typeof ExecutePressCommandBody.parse>;
export type VerifiedMyrtleEditor = {
  accountId: string;
  displayName: string;
  role: typeof MYRTLE_EDITOR_ROLE;
};

export class PressError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function ensureCurrentRevision(current: number, supplied: number) {
  if (supplied !== current) {
    throw new PressError("This issue changed in another session. Refresh before saving; your change was not applied.", 409);
  }
}
export function ensureUploadedAssetMetadata(
  asset: Pick<Issue["assets"][number], "size" | "contentType">,
  metadata: { size?: string | number; contentType?: string },
) {
  if (Number(metadata.size) !== asset.size) {
    throw new PressError("Uploaded file size does not match metadata.");
  }
  if (metadata.contentType !== asset.contentType) {
    throw new PressError("Uploaded file type does not match metadata.");
  }
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PressError(message);
}
const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
function approval(command: Command) {
  ensure(command.reviewer && command.reviewer.trim(), "A named human reviewer is required.");
  ensure(command.notes && command.notes.trim(), "Review evidence or sign-off notes are required.");
  return { reviewer: command.reviewer.trim(), notes: command.notes.trim(), at: new Date().toISOString() };
}
function verifiedMyrtleApproval(command: Command, editor?: VerifiedMyrtleEditor) {
  if (!editor?.accountId.trim() || editor.role !== MYRTLE_EDITOR_ROLE) {
    throw new PressError("A verified Myrtle editor account is required for this sign-off.", 403);
  }
  ensure(command.notes && command.notes.trim(), "Review evidence or sign-off notes are required.");
  return {
    reviewer: editor.displayName,
    reviewerAccountId: editor.accountId,
    reviewerRole: editor.role,
    notes: command.notes.trim(),
    at: new Date().toISOString(),
  };
}
function isVerifiedMyrtleApproval(value: Issue["pages"][number]["editorialApproval"] | Issue["proofs"][number]["approval"]) {
  return value?.reviewerRole === MYRTLE_EDITOR_ROLE && !!value.reviewerAccountId?.trim();
}
function invalidatePages(issue: Issue, numbers: number[], editorial = true) {
  for (const number of numbers) {
    const page = issue.pages.find(p => p.number === number);
    if (!page || page.locked) continue;
    page.artApproval = null;
    page.printApproval = null;
    if (editorial) page.editorialApproval = null;
    page.status = "draft";
  }
}
function sampleText(text: string) {
  return /SAMPLE (DRAFT|EDITORIAL)|NOT REPOSITORY COPY/i.test(text);
}
export function readiness(issue: Issue) {
  const blockers: string[] = [];
  const manifest = Array.from({ length: 9 }, (_, i) => {
    const page = i + 2;
    const puzzles = issue.puzzles.filter(p => p.pages.includes(page));
    return {
      page, role: page === 8 || page === 9 ? "Main Puzzle Dojo" : "Integrated puzzle",
      puzzleIds: puzzles.map(p => p.id),
      validated: puzzles.length > 0 && puzzles.every(p => p.validation === "passed"),
    };
  });
  for (const page of issue.pages) {
    if (page.number === 1 && !page.copy.trim()) blockers.push("Page 1: locked source has not been supplied; do not replace it with sample copy.");
    if (!page.copy.trim() || sampleText(page.copy)) blockers.push(`Page ${page.number}: final sourced copy required.`);
    if (!isVerifiedMyrtleApproval(page.editorialApproval)) blockers.push(`Page ${page.number}: a verified Myrtle editor account must record the editorial sign-off.`);
    if (!page.artApproval) blockers.push(`Page ${page.number}: a self-attested human artwork/layout sign-off is required.`);
    const check = pageReadiness(issue, page);
    for (const blocker of check.blockers) {
      const text = `Page ${page.number}: ${blocker}`;
      if (!blockers.includes(text)) blockers.push(text);
    }
  }
  for (const entry of manifest) if (!entry.validated) blockers.push(`Page ${entry.page}: assign a puzzle with a human-validated solution.`);
  for (const puzzle of issue.puzzles) {
    if (!puzzle.source.trim() || !puzzle.solution.trim() || puzzle.validation !== "passed") blockers.push(`Puzzle “${puzzle.title}”: source, solution, and correctness review required.`);
    if (!puzzle.pages.length) blockers.push(`Puzzle “${puzzle.title}”: page assignment required.`);
    const artwork = issue.assets.find(a => a.id === puzzle.artworkId);
    if (!artwork || artwork.review !== "approved") blockers.push(`Puzzle “${puzzle.title}”: approved artwork required.`);
  }
  for (const asset of issue.assets.filter(a => a.pages.length > 0 || issue.puzzles.some(p => p.artworkId === a.id))) {
    if (asset.review !== "approved") blockers.push(`Artwork “${asset.name}”: human review required.`);
    if (!asset.credit.trim() || !asset.source.trim()) blockers.push(`Artwork “${asset.name}”: source and credit required.`);
    if (asset.contentType.startsWith("image/") && asset.dpi < 300) blockers.push(`Artwork “${asset.name}”: confirm at least 300 effective DPI.`);
  }
  for (const item of issue.checklist) if (!item.checked) blockers.push(item.label);
  const proofApproved = issue.proofs.some(p => p.revision === issue.revision && p.status === "approved" && isVerifiedMyrtleApproval(p.approval));
  const production = productionQueue(issue, blockers, proofApproved);
  const nextBlocker = [...production.blockerDetails].sort((a, b) => a.priority - b.priority || a.ordinal - b.ordinal)[0];
  return GetReadinessResponse.parse({
    revision: issue.revision,
    approvedPages: issue.pages.filter(p => {
      const gates = pageReadiness(issue, p);
      return p.status === "approved" && gates.editorial && gates.art;
    }).length, totalPages: 10,
    validatedPuzzles: issue.puzzles.filter(p => p.validation === "passed").length,
    totalPuzzles: issue.puzzles.length,
    reviewedAssets: issue.assets.filter(a => a.review === "approved").length,
    totalAssets: issue.assets.length,
    continuityComplete: issue.checklist.filter(c => c.checked).length, continuityTotal: issue.checklist.length,
    readyToPrint: blockers.length === 0 && proofApproved, blockers, manifest,
    pageChecks: issue.pages.map(page => pageReadiness(issue, page)),
    ...production,
    nextMove: nextBlocker?.nextMove || (proofApproved ? "Export the approved issue and commit it to the authoritative GitHub repository." : "Run preflight, inspect the working print proof, and have a verified Myrtle editor sign off."),
  });
}

export function applyCommand(issue: Issue, command: Command, editor?: VerifiedMyrtleEditor, actor?: string) {
  ensureCurrentRevision(issue.revision, command.revision);
  const next = structuredClone(issue);
  const page = next.pages.find(p => p.number === command.page);
  const puzzle = next.puzzles.find(p => p.id === command.id);
  const asset = next.assets.find(a => a.id === command.id);
  const pageActions = ["edit_page", "submit_page", "approve_editorial", "approve_art", "check_page_print", "set_artwork_slots", "lock_page"];
  if (pageActions.includes(command.action)) {
    ensure(page, "Page not found.");
    ensure(page.number !== 1 && !page.locked, `Page ${page.number} is locked. Branch an explicit new draft first; Page 1 can never be branched or edited.`);
  }
  // Locked evidence includes its dependencies, not just the text. Require branching all affected pages.
  let affected: number[] = [];
  if (["add_puzzle", "edit_puzzle", "delete_puzzle", "validate_puzzle"].includes(command.action)) {
    affected = [...(puzzle?.pages || []), ...(command.puzzle?.pages || [])];
  }
  if (["add_asset", "edit_asset", "delete_asset", "review_asset", "review_asset_style"].includes(command.action)) {
    const ids = [asset?.id, command.asset?.id].filter(Boolean);
    affected = [...affected, ...(asset?.pages || []), ...(command.asset?.pages || []),
      ...next.pages.filter(p => (p.artworkSlots || []).some(s => ids.includes(s.assetId))).map(p => p.number),
      ...next.puzzles.filter(p => ids.includes(p.artworkId)).flatMap(p => p.pages)];
  }
  const lockedPages = next.pages.filter(p => p.locked && affected.includes(p.number));
  ensure(!lockedPages.length, `This change affects locked page(s) ${lockedPages.map(p => p.number).join(", ")}. Branch those pages before changing their evidence.`);
  const sourceReceipt = () => {
    const notes = command.notes?.trim() || "";
    ensure(actor?.trim() && notes, "A signed-in source recorder and explicit evidence notes are required.");
    ensure(notes.length <= 10000, "Keep source evidence notes within 10,000 characters.");
    return { actor: actor!, at: new Date().toISOString(), notes };
  };
  switch (command.action) {
    case "record_reported_preflight": {
      ensure(command.checked === true, "Explicit human confirmation of the preview is required.");
      const entries = command.reportedEntries;
      ensure(entries?.length === 48 && entries.every(s => typeof s === "string" && s.length <= 10000), "Supply the exact 48 descriptions, including explicit blank strings. Missing entries cannot be invented or padded.");
      const identity = command.sourceIdentity?.trim() || "";
      ensure(identity, "Identify the actual reported preflight source.");
      next.reportedPreflight = {
        id: randomUUID(), entries: structuredClone(entries),
        sourceIdentity: identity, evidence: sourceReceipt(),
      };
      next.reportedPreflightPresent = true;
      break;
    }
    case "verify_page_one_approval": {
      ensure(command.checked === true, "Explicitly compare the preserved Page 1 with its original approval documentation.");
      ensure(command.decision === "verified" || command.decision === "not_verified", "Choose whether the original approval documentation verifies this exact cover.");
      const identity = command.approvalDocumentIdentity?.trim() || "";
      ensure(identity.length >= 4 && identity.length <= 2000 && !/^(upload|uploaded|import|imported)(\s+approval)?$/i.test(identity),
        "Identify the original approval document or archival record; an upload or imported claim alone is not evidence.");
      ensure(command.notes?.trim() && command.notes.trim().length >= 20 && command.notes.trim().length <= 10000,
        "Record at least 20 characters describing the comparison and evidence observed, up to 10,000 characters.");
      ensure(hasAuthoritativePageOneSource(next),
        "Recover the authoritative locked Page 1 from its exact GitHub commit before verifying its original approval documentation.");
      const basis = pageOneApprovalVerificationBasis(next, command.referenceId || "");
      ensure(basis,
        "Select the current confirmed original front-page reference in Style Guide; reference confirmation alone is not approval evidence.");
      const signoff = verifiedMyrtleApproval(command, editor);
      const record = {
        id: randomUUID(),
        issueRevision: issue.revision + 1,
        at: signoff.at,
        decision: command.decision as "verified" | "not_verified",
        reviewer: signoff.reviewer,
        reviewerAccountId: signoff.reviewerAccountId,
        reviewerRole: signoff.reviewerRole,
        approvalDocumentIdentity: identity,
        notes: command.notes!.trim(),
        ...basis,
      };
      next.pageOneApprovalHistory = [...(next.pageOneApprovalHistory || []), record];
      break;
    }
    case "import_page_sources": {
      ensure(command.checked === true, "Explicit human confirmation of the source-copy preview is required.");
      const rows = command.pageSources;
      ensure(rows?.length && rows.length <= 9, "Supply 1–9 actual page sources.");
      ensure(Buffer.byteLength(JSON.stringify(rows), "utf8") <= 1024 * 1024, "Source-copy imports must not exceed 1 MiB.");
      ensure(new Set(rows.map(r => r.page)).size === rows.length, "Duplicate page destinations are not allowed.");
      const receipt = sourceReceipt();
      // Check the complete batch before changing anything. The caller commits only a returned Issue.
      for (const row of rows) {
        const target = next.pages.find(p => p.number === row.page);
        ensure(Number.isInteger(row.page) && row.page >= 2 && row.page <= 10 && target && !target.locked, "Source-copy imports may only target unlocked pages 2–10. Page 1 stays protected; explicitly branch any other locked page first.");
        ensure(typeof row.copy === "string" && row.copy.trim() && row.copy.length <= 100000 && row.sourceIdentity?.trim(), "Each draft needs actual copy and its source identity.");
        ensure(row.title === undefined || row.title.trim(), "A supplied title cannot be blank.");
      }
      for (const row of rows) {
        const target = next.pages.find(p => p.number === row.page)!;
        if (row.title !== undefined) target.title = row.title.trim();
        target.copy = row.copy;
        target.sourceIdentity = row.sourceIdentity.trim();
        target.sourceEvidence = structuredClone(receipt);
        target.provenance = "imported_unverified";
        target.draftRevision = (target.draftRevision || 1) + 1;
        invalidatePages(next, [target.number]);
      }
      break;
    }
    case "import_puzzle_inventory": {
      ensure(command.checked === true, "Explicit human confirmation of the puzzle inventory preview is required.");
      const rows = command.puzzleInventory;
      ensure(rows?.length && rows.length <= 100, "Supply 1–100 actual puzzle records.");
      ensure(Buffer.byteLength(JSON.stringify(rows), "utf8") <= 1024 * 1024, "Puzzle imports must not exceed 1 MiB.");
      const identity = command.sourceIdentity?.trim() || "";
      ensure(identity, "Record the actual inventory source identity.");
      const receipt = sourceReceipt();
      for (const row of rows) {
        ensure(row.title?.trim() && typeof row.source === "string" && typeof row.solution === "string", "Each inventory record needs a title and source/answer fields; missing content remains unvalidated.");
        ensure(row.pages.every(p => Number.isInteger(p) && p >= 2 && p <= 10 && !next.pages.find(page => page.number === p)?.locked), "Puzzle placements may only use unlocked pages 2–10; branch affected locked pages first.");
        ensure(!row.artworkId || next.assets.some(a => a.id === row.artworkId), "An imported artwork reference must already exist in Assets; upload it or remove the unknown reference before importing.");
      }
      for (const row of rows) {
        const { validationAt: _at, validationAccountId: _account, ...data } = row;
        next.puzzles.push({
          ...data, id: randomUUID(), title: row.title.trim(), pages: unique(row.pages),
          sourceIdentity: row.sourceIdentity?.trim() || identity,
          sourceEvidence: structuredClone(receipt), provenance: "imported_unverified",
          validation: "unvalidated", validationNotes: "", reviewer: "",
        });
      }
      invalidatePages(next, rows.flatMap(r => r.pages));
      break;
    }
    case "edit_page": {
      ensure(page && command.title && command.title.trim() && typeof command.copy === "string", "Title and copy are required.");
      page.title = command.title.trim();
      page.copy = command.copy;
      page.provenance = "working_draft";
      page.sourceIdentity = command.sourceIdentity?.trim() || "";
      page.sourceEvidence = command.notes?.trim() && actor?.trim() ? sourceReceipt() : null;
      page.draftRevision = (page.draftRevision || 1) + 1;
      invalidatePages(next, [page.number]);
      break;
    }
    case "submit_page":
      ensure(page && page.copy.trim() && !sampleText(page.copy), "Replace the sample with actual copy before requesting review.");
      ensure(page.sourceIdentity?.trim(), "Record the copy's actual source identity before requesting review.");
      page.status = "in_review";
      break;
    case "approve_editorial": {
      ensure(page?.status === "in_review", "Submit the page for review first.");
      const signoff = verifiedMyrtleApproval(command, editor);
      const assigned = next.puzzles.filter(p => p.pages.includes(page.number));
      ensure(assigned.length && assigned.every(p => p.validation === "passed"), "The puzzle correctness gate must pass before editorial approval.");
      ensure(pageReadiness(next, page).puzzle, "The puzzle correctness gate needs actual source identity and human validation evidence, not just a passed label.");
      ensure(page.copy.trim() && !sampleText(page.copy) && page.sourceIdentity?.trim(), "Actual sourced editorial copy is required.");
      page.editorialApproval = signoff;
      if (page.artApproval) page.status = "approved";
      break;
    }
    case "approve_art": {
      ensure(page && page.status !== "draft", "Submit the page for review first.");
      ensure((page.artworkSlots || []).every(s => s.assetId && next.assets.some(a => a.id === s.assetId)),
        "Fill every declared artwork slot with an existing asset before recording the page art/layout approval.");
      const assigned = pageAssets(next, page);
      const puzzleArt = next.puzzles.filter(p => p.pages.includes(page.number)).map(p => next.assets.find(a => a.id === p.artworkId));
      ensure(puzzleArt.length > 0 && puzzleArt.every(a => a?.review === "approved"), "Puzzle artwork must be assigned and approved first.");
      ensure(assigned.every(a => a.review === "approved" && !!a.credit.trim() && !!a.source.trim()), "All assigned artwork must be reviewed with source and credit.");
      ensure(confirmedArtReferences(next) && assigned.every(a => assetStyleReady(next, a)), "Confirm the original references in Style Guide and record current human style sign-offs for all placed assets first.");
      page.artApproval = approval(command);
      if (page.editorialApproval) page.status = "approved";
      break;
    }
    case "set_artwork_slots": {
      ensure(page && command.artworkSlots, "Explicit artwork slots are required.");
      ensure(new Set(command.artworkSlots.map(s => s.id)).size === command.artworkSlots.length, "Slot IDs must be unique.");
      ensure(command.artworkSlots.every(s => s.id.trim() && s.label.trim() && (!s.assetId || next.assets.some(a => a.id === s.assetId))), "Slots need an identity, label, and valid asset reference.");
      page.artworkSlots = structuredClone(command.artworkSlots);
      page.draftRevision = (page.draftRevision || 1) + 1;
      invalidatePages(next, [page.number]);
      break;
    }
    case "check_page_print": {
      ensure(page && command.checked === true, "Explicit human print inspection is required.");
      page.printApproval = { ...approval(command), reviewerAccountId: actor };
      break;
    }
    case "lock_page": {
      ensure(page, "Page not found.");
      const signoff = verifiedMyrtleApproval(command, editor);
      const check = pageReadiness(next, page);
      ensure(check.canLock, `Page cannot be locked: ${check.blockers.join(" ")}`);
      page.locked = true;
      page.status = "approved";
      next.pageSnapshots = [...(next.pageSnapshots || []), lockedSnapshot(next, page, signoff.reviewerAccountId, signoff.notes)];
      break;
    }
    case "branch_page": {
      ensure(page && page.number !== 1 && page.locked, "Only a locked page 2–10 can be branched. Page 1 is permanently protected.");
      ensure(command.notes?.trim(), "Explain why a new draft is needed.");
      const existing = [...(next.pageSnapshots || [])].reverse().find(s => s.page.number === page.number);
      if (!existing) {
        const snapshot = lockedSnapshot(next, page, actor || editor?.accountId || "authenticated contributor", "Preserved existing locked version before explicit branching.");
        next.pageSnapshots = [...(next.pageSnapshots || []), snapshot];
      }
      page.branchedFrom = [...next.pageSnapshots!].reverse().find(s => s.page.number === page.number)!.id;
      page.locked = false;
      page.status = "draft";
      page.provenance = "working_draft";
      page.draftRevision = (page.draftRevision || 1) + 1;
      page.editorialApproval = null;
      page.artApproval = null;
      page.printApproval = null;
      break;
    }
    case "set_art_reference": {
      const signoff = verifiedMyrtleApproval(command, editor);
      const input = command.artReference;
      ensure(input && input.title.trim() && input.sourceIdentity.trim(), "Reference title and original source identity are required.");
      ensure(Boolean(input.assetId) !== Boolean(input.url.trim()), "Choose exactly one uploaded asset or HTTPS reference link.");
      const original = next.assets.find(a => a.id === input.assetId);
      if (input.assetId) {
        ensure(original, "Upload and save the original reference asset first.");
        ensure(!original.objectPath.startsWith("/objects/uploads/"), "Save a fresh protected image before registering a reference; temporary upload paths cannot be used as references.");
      }
      if (input.url.trim()) {
        let url: URL;
        try { url = new URL(input.url); } catch { throw new PressError("Use a valid HTTPS reference link."); }
        ensure(url.protocol === "https:" && !url.username && !url.password, "Use an HTTPS reference link without credentials.");
        ensure(![...url.searchParams.keys()].some(k => /token|secret|signature|credential|password|x-amz|x-goog/i.test(k)), "Use a stable source link, not a signed credential-bearing download URL.");
      }
      const direction = next.artDirection ||= { references: [], history: [] };
      const previous = direction.references.find(r => r.kind === input.kind);
      const record = {
        ...input, url: input.url.trim(), sourceIdentity: input.sourceIdentity.trim(),
        id: randomUUID(), version: (previous?.version || 0) + 1, at: new Date().toISOString(),
        suppliedBy: signoff.reviewerAccountId!, registrationNotes: signoff.notes, approval: null,
        ...(original ? { assetSnapshot: structuredClone(original) } : {}),
      };
      direction.references = [...direction.references.filter(r => r.kind !== input.kind), record];
      direction.history.push(structuredClone(record));
      break;
    }
    case "confirm_art_reference": {
      ensure(command.checked === true, "Explicitly confirm that you inspected the exact previously approved original, not a generated substitute.");
      const signoff = verifiedMyrtleApproval(command, editor);
      const direction = next.artDirection;
      const reference = direction?.references.find(r => r.id === command.id);
      ensure(reference, "Current reference not found. Reload Style Guide.");
      ensure(reference.assetSnapshot?.objectPath || reference.url.trim(), "Supply a fresh reference image before confirming this reference.");
      ensure(!reference.assetSnapshot?.objectPath.startsWith("/objects/uploads/"), "Save a fresh protected image before confirming this reference.");
      const confirmed = { ...structuredClone(reference), id: randomUUID(), version: reference.version + 1, approval: signoff, at: new Date().toISOString() };
      direction!.references = direction!.references.map(r => r.id === reference.id ? confirmed : r);
      direction!.history.push(structuredClone(confirmed));
      break;
    }
    case "review_asset_style": {
      ensure(asset && command.checked === true && command.styleChecks, "Asset, complete checklist and explicit human acknowledgement are required.");
      ensure(command.decision === "passed" || command.decision === "failed", "Choose passed or failed.");
      const evidence = approval(command);
      ensure(actor?.trim(), "Authenticated style-review identity is required.");
      if (command.decision === "passed") {
        ensure(confirmedArtReferences(next), "Both exact original references must be supplied and explicitly confirmed before a style pass.");
        ensure(STYLE_CHECK_KEYS.every(key => command.styleChecks![key]), "Every style criterion must be checked before a pass.");
        ensure(asset.provenance !== "sample" && asset.source.trim() && asset.credit.trim(), "Original source and credit, not sample art, are required.");
      }
      asset.styleReview = {
        decision: command.decision, checks: structuredClone(command.styleChecks),
        reviewer: evidence.reviewer, reviewerAccountId: actor!, notes: evidence.notes,
        at: evidence.at, referenceIds: artReferenceIds(next),
      };
      invalidatePages(next, [...asset.pages, ...next.pages.filter(p => pageAssets(next, p).some(a => a.id === asset.id)).map(p => p.number)]);
      break;
    }
    case "add_puzzle":
    case "edit_puzzle": {
      ensure(command.puzzle && command.puzzle.title.trim(), "Puzzle title is required.");
      if (command.action === "edit_puzzle") ensure(puzzle, "Puzzle not found.");
      const data = command.puzzle;
      if (data.artworkId) ensure(next.assets.some(a => a.id === data.artworkId), "Artwork reference does not exist.");
      const record = {
        ...data, id: puzzle?.id || randomUUID(), pages: unique(data.pages),
        sourceEvidence: command.notes?.trim() && actor?.trim() ? sourceReceipt() : null,
        validation: "unvalidated" as const, reviewer: "", validationNotes: "",
        validationAt: "", validationAccountId: "",
        provenance: /sample|demo|seed/i.test(data.provenance) ? "sample" : /import/i.test(data.provenance) ? "imported_unverified" : "working_draft",
      };
      if (puzzle) next.puzzles[next.puzzles.indexOf(puzzle)] = record;
      else next.puzzles.push(record);
      invalidatePages(next, [...(puzzle?.pages || []), ...record.pages]);
      break;
    }
    case "delete_puzzle":
      ensure(puzzle, "Puzzle not found.");
      next.puzzles = next.puzzles.filter(p => p.id !== puzzle.id);
      invalidatePages(next, puzzle.pages);
      break;
    case "validate_puzzle": {
      ensure(puzzle, "Puzzle not found.");
      const reviewer = approval(command);
      ensure(["passed", "failed"].includes(command.decision || ""), "Choose passed or failed.");
      if (command.decision === "passed") {
        ensure(puzzle.source.trim() && puzzle.solution.trim(), "Actual puzzle source and solution are required. Validation is a human correctness attestation, not an automatic solver.");
        ensure(puzzle.sourceIdentity?.trim(), "Record the puzzle's actual source identity before validation.");
        ensure(!sampleText(puzzle.source) && !/sample|demo|seed/i.test(puzzle.provenance), "Seeded/demo puzzles cannot become correctness evidence. Supply an actual source.");
      }
      puzzle.validation = command.decision as "passed" | "failed";
      puzzle.reviewer = reviewer.reviewer;
      puzzle.validationNotes = reviewer.notes;
      puzzle.validationAt = reviewer.at;
      puzzle.validationAccountId = actor || editor?.accountId || "";
      invalidatePages(next, puzzle.pages);
      break;
    }
    case "add_asset":
    case "edit_asset": {
      ensure(command.asset && command.asset.name.trim(), "Asset metadata is required.");
      if (command.action === "edit_asset") ensure(asset, "Asset not found.");
      const data = command.asset;
      ensure(data.objectPath.startsWith("/objects/") && !data.objectPath.includes(".."), "An uploaded object path is required.");
      if (asset) ensure(data.objectPath === asset.objectPath, "An existing asset's file cannot be silently replaced. Upload a new asset.");
      const record = {
        ...data, id: asset?.id || randomUUID(), pages: unique(data.pages),
        provenance: asset?.provenance || "uploaded_unverified" as const, review: "pending" as const, reviewer: "", reviewNotes: "", styleReview: null,
      };
      if (asset) next.assets[next.assets.indexOf(asset)] = record;
      else next.assets.push(record);
      const affected = next.puzzles.filter(p => p.artworkId === record.id);
      invalidatePages(next, [...(asset?.pages || []), ...record.pages, ...affected.flatMap(p => p.pages), ...next.pages.filter(p => (p.artworkSlots || []).some(s => s.assetId === record.id)).map(p => p.number)]);
      break;
    }
    case "delete_asset":
      ensure(asset, "Asset not found.");
      ensure(!next.artDirection?.history.some(r => r.assetId === asset.id), "Preserved reference artwork cannot be deleted. Keep its original provenance and versions.");
      ensure(!next.puzzles.some(p => p.artworkId === asset.id), "Unassign this artwork from puzzles before deleting its metadata.");
      ensure(!next.pages.some(p => (p.artworkSlots || []).some(s => s.assetId === asset.id)), "Remove this asset from artwork slots before deleting its metadata.");
      next.assets = next.assets.filter(a => a.id !== asset.id);
      invalidatePages(next, asset.pages);
      break;
    case "review_asset": {
      ensure(asset, "Asset not found.");
      ensure(["approved", "rejected"].includes(command.decision || ""), "Choose approved or rejected.");
      const reviewer = approval(command);
      if (command.decision === "approved") ensure(asset.credit.trim() && asset.source.trim(), "Source and credit are required for artwork approval.");
      asset.review = command.decision as "approved" | "rejected";
      asset.reviewer = reviewer.reviewer;
      asset.reviewNotes = reviewer.notes;
      invalidatePages(next, [...asset.pages, ...next.puzzles.filter(p => p.artworkId === asset.id).flatMap(p => p.pages), ...next.pages.filter(p => (p.artworkSlots || []).some(s => s.assetId === asset.id)).map(p => p.number)]);
      break;
    }
    case "check_continuity": {
      const item = next.checklist.find(c => c.id === command.id);
      ensure(item && typeof command.checked === "boolean", "Checklist item and explicit decision required.");
      const reviewer = approval(command);
      item.checked = command.checked;
      item.reviewer = reviewer.reviewer;
      item.notes = reviewer.notes;
      break;
    }
    case "run_preflight": {
      const result = readiness(next);
      next.proofs.push({
        id: randomUUID(), revision: issue.revision + 1, createdAt: new Date().toISOString(),
        blockers: result.blockers, status: result.blockers.length ? "blocked" : "awaiting_review", approval: null,
      });
      break;
    }
    case "approve_proof": {
      const proof = next.proofs.find(p => p.id === command.id);
      ensure(proof && proof.revision === issue.revision && proof.status === "awaiting_review", "Run a fresh, unblocked preflight before proof approval.");
      ensure(!readiness(next).blockers.length, "Outstanding issue blockers prevent proof approval.");
      const reviewer = verifiedMyrtleApproval(command, editor);
      proof.status = "approved";
      proof.approval = reviewer;
      proof.revision = issue.revision + 1;
      break;
    }
  }
  if (["edit_page", "set_artwork_slots", "branch_page", "add_puzzle", "edit_puzzle", "delete_puzzle", "add_asset", "edit_asset", "delete_asset", "import_page_sources", "import_puzzle_inventory"].includes(command.action)) {
    next.checklist = next.checklist.map(c => ({ ...c, checked: false, reviewer: "", notes: "" }));
  }
  next.revision++;
  next.updatedAt = new Date().toISOString();
  next.githubSync = "inactive";
  return GetIssueResponse.parse(next);
}

export function safeImport(current: Issue, imported: Issue) {
  ensure(imported.pages.length === 10 && new Set(imported.pages.map(p => p.number)).size === 10, "The import must contain exactly pages 1 through 10.");
  ensure(new Set(imported.assets.map(a => a.id)).size === imported.assets.length && new Set(imported.puzzles.map(p => p.id)).size === imported.puzzles.length, "Duplicate asset or puzzle IDs are not allowed.");
  for (const puzzle of imported.puzzles) ensure(!puzzle.artworkId || imported.assets.some(a => a.id === puzzle.artworkId), "Puzzle artwork reference not found.");
  // Import cannot replace the protected cover or attest to verified GitHub provenance.
  const next = structuredClone(imported);
  next.pages = current.pages.map(original => {
    if (original.number === 1 || original.locked) return structuredClone(original);
    const p = next.pages.find(candidate => candidate.number === original.number)!;
    return { ...p, locked: false, draftRevision: (original.draftRevision || 1) + 1, branchedFrom: original.branchedFrom, status: "draft" as const, provenance: "imported_unverified", sourceEvidence: null, editorialApproval: null, artApproval: null, printApproval: null };
  });
  next.assets = next.assets.map(a => {
    ensure(a.objectPath.startsWith("/objects/") && !a.objectPath.includes(".."), "Unsafe asset path in import.");
    return { ...a, provenance: "uploaded_unverified", review: "pending", reviewer: "", reviewNotes: "", styleReview: null, pages: unique(a.pages) };
  });
  next.puzzles = next.puzzles.map(p => ({ ...p, validation: "unvalidated", reviewer: "", validationNotes: "", validationAt: "", validationAccountId: "", sourceEvidence: null, provenance: "imported_unverified", pages: unique(p.pages) }));
  // Only locally recorded immutable locks are trusted. Imported "approved" snapshots are not evidence.
  next.pageSnapshots = structuredClone(current.pageSnapshots || []);
  // Original Page 1 document reviews are local human evidence, never imported approval claims.
  next.pageOneApprovalHistory = structuredClone(current.pageOneApprovalHistory || []);
  const protectedPuzzles = current.puzzles.filter(p => current.pages.some(page => page.locked && p.pages.includes(page.number)));
  const protectedAssets = current.assets.filter(a =>
    current.artDirection?.history.some(r => r.assetId === a.id) ||
    current.pages.some(page => page.locked && pageAssets(current, page).some(ref => ref.id === a.id)));
  for (const p of protectedPuzzles) next.puzzles = [...next.puzzles.filter(other => other.id !== p.id), structuredClone(p)];
  for (const a of protectedAssets) next.assets = [...next.assets.filter(other => other.id !== a.id), structuredClone(a)];
  ensure(!next.puzzles.some(p => !protectedPuzzles.some(saved => saved.id === p.id) && current.pages.some(page => page.locked && p.pages.includes(page.number))), "Import would place a new puzzle on a locked page. Branch first.");
  ensure(!next.assets.some(a => !protectedAssets.some(saved => saved.id === a.id) && current.pages.some(page => page.locked && a.pages.includes(page.number))), "Import would place new artwork on a locked page. Branch first.");
  for (const page of next.pages) ensure((page.artworkSlots || []).every(s => !s.assetId || next.assets.some(a => a.id === s.assetId)), "Imported artwork slot references missing metadata.");
  next.checklist = current.checklist.map(c => ({ ...c, checked: false, reviewer: "", notes: "" }));
  next.proofs = [];
  next.motto = current.motto;
  next.attribution = current.attribution;
  next.advertisers = current.advertisers;
  next.name = current.name;
  next.artDirection = structuredClone(current.artDirection);
  next.reportedPreflight = structuredClone(current.reportedPreflight);
  next.reportedPreflightPresent = !!current.reportedPreflight;
  next.revision = current.revision + 1;
  next.updatedAt = new Date().toISOString();
  next.githubSync = "inactive";
  return GetIssueResponse.parse(next);
}

export function ensureGitHubPreviewRevision(current: number, preview: number) {
  if (preview !== current) {
    throw new PressError("The working copy changed before this preview. Reload it and preview again.", 409);
  }
}

export function applyGitHubPageOneSource(
  current: Issue,
  source: Issue["pages"][number],
  sourceIdentity = source.sourceIdentity,
  actor = "authenticated contributor",
) {
  const next = structuredClone(current);
  const pageOne = next.pages.find(page => page.number === 1);
  ensure(pageOne, "Locked Page 1 is missing.");
  if (
    pageOne.status === "approved" ||
    pageOne.editorialApproval ||
    pageOne.artApproval ||
    (pageOne.copy.trim() && pageOne.provenance !== "sample")
  ) {
    throw new PressError("The locked front page already has source copy. It cannot be overwritten.", 409);
  }

  pageOne.title = source.title;
  pageOne.section = source.section;
  pageOne.copy = source.copy;
  pageOne.locked = true;
  pageOne.status = "draft";
  pageOne.provenance = "repository_reference";
  pageOne.sourceIdentity = sourceIdentity;
  pageOne.editorialApproval = null;
  pageOne.artApproval = null;
  pageOne.printApproval = null;

  next.pageSnapshots = [
    ...(next.pageSnapshots || []),
    lockedSnapshot(next, pageOne, actor, "Separately authorized loading of missing repository source; no editorial/art/print approval granted."),
  ];
  next.revision++;
  next.updatedAt = new Date().toISOString();
  next.githubSync = "inactive";
  return GetIssueResponse.parse(next);
}

export function preserveGitHubPageOneForPush(current: Issue, remote: Issue) {
  const remoteCover = remote.pages.find(page => page.number === 1);
  const localCover = current.pages.find(page => page.number === 1);
  ensure(remoteCover && localCover, "Page 1 is missing; no GitHub commit was created.");

  const outgoing = structuredClone(current);
  outgoing.pages = outgoing.pages.map(page => page.number === 1 ? structuredClone(remoteCover) : page);
  return outgoing;
}

export function ensureGitHubSourceLoadConfirmed(confirmed: boolean) {
  ensure(confirmed, "Page 1 source loading requires its separate explicit authorization.");
}
