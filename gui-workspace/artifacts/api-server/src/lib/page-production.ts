import { createHash, randomUUID } from "node:crypto";
import type { Issue } from "./press-workflow";
import { assetStyleReady, confirmedArtReferences } from "./art-direction";

type Page = Issue["pages"][number];
export function pageAssets(issue: Issue, page: Page) {
  const ids = new Set([
    ...(page.artworkSlots || []).map(s => s.assetId),
    ...issue.puzzles.filter(p => p.pages.includes(page.number)).map(p => p.artworkId),
  ]);
  return issue.assets.filter(a => a.pages.includes(page.number) || ids.has(a.id));
}

const registeredAssetPathMatches = (path: string) =>
  /^\/objects\/registered-assets\/[0-9a-f-]{36}$/i.test(path);

export function isProtectedRegisteredAssetPath(path: string) {
  return registeredAssetPathMatches(path);
}

/**
 * Rebind a legacy art reference to a verified protected copy, or remove the
 * unsafe current binding when its original bytes cannot be established.
 * Archived reference versions and review evidence are never rewritten.
 */
function migrateLegacyArtReference(
  issue: Issue,
  kind: "front_page" | "golden_image",
  protectedSnapshot?: Issue["assets"][number],
): Issue {
  const current = issue.artDirection?.references.find(reference => reference.kind === kind);
  const legacyPath = current?.assetSnapshot?.objectPath || "";
  if (!current || !legacyPath.startsWith("/objects/uploads/")) return issue;

  const next = structuredClone(issue);
  const direction = next.artDirection!;
  const previous = direction.references.find(reference => reference.kind === kind)!;
  const original = structuredClone(previous);
  if (!direction.history.some(reference => reference.id === original.id && reference.version === original.version)) {
    direction.history.push(original);
  }

  const canRebind = !!protectedSnapshot &&
    protectedSnapshot.id === previous.assetSnapshot?.id &&
    registeredAssetPathMatches(protectedSnapshot.objectPath) &&
    protectedSnapshot.size === previous.assetSnapshot.size &&
    protectedSnapshot.contentType === previous.assetSnapshot.contentType &&
    protectedSnapshot.contentType.startsWith("image/");
  const migrated = {
    ...structuredClone(previous),
    id: randomUUID(),
    version: previous.version + 1,
    at: new Date().toISOString(),
    assetId: canRebind ? protectedSnapshot.id : "",
    url: "",
    approval: null,
    registrationNotes: canRebind
      ? `Legacy ${kind === "front_page" ? "Page 1" : "Golden Image"} copied to protected storage; confirm this new reference version before using it.`
      : `The original ${kind === "front_page" ? "Page 1" : "Golden Image"} bytes could not be established. Supply and confirm a fresh reference.`,
  };
  if (canRebind) {
    migrated.assetSnapshot = {
      ...structuredClone(previous.assetSnapshot!),
      objectPath: protectedSnapshot.objectPath,
    };
  } else {
    delete migrated.assetSnapshot;
  }

  direction.references = direction.references.map(reference =>
    reference.kind === kind ? migrated : reference,
  );
  direction.history.push(structuredClone(migrated));
  return next;
}

export function migrateLegacyPageOneReference(issue: Issue, protectedSnapshot?: Issue["assets"][number]): Issue {
  return migrateLegacyArtReference(issue, "front_page", protectedSnapshot);
}

export function migrateLegacyGoldenImageReference(issue: Issue, protectedSnapshot?: Issue["assets"][number]): Issue {
  return migrateLegacyArtReference(issue, "golden_image", protectedSnapshot);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

/** Page 1 source recovery must have come from a specific authoritative GitHub commit. */
export function hasAuthoritativePageOneSource(issue: Issue) {
  const cover = issue.pages.find(candidate => candidate.number === 1);
  return !!cover && cover.locked && cover.provenance === "repository_reference" &&
    !!cover.copy.trim() && !/SAMPLE (DRAFT|EDITORIAL)|NOT REPOSITORY COPY/i.test(cover.copy) &&
    /@[\da-f]{40}$/i.test(cover.sourceIdentity || "");
}

export function pageOneApprovalReference(issue: Issue, referenceId: string) {
  const reference = issue.artDirection?.references.find(candidate => candidate.id === referenceId);
  if (!reference || reference.kind !== "front_page" || !reference.title.trim() ||
      !reference.sourceIdentity.trim() || !(reference.assetSnapshot?.objectPath || reference.url.trim()) ||
      reference.approval?.reviewerRole !== "myrtle_editor" ||
      !reference.approval.reviewerAccountId?.trim() || !reference.approval.notes.trim()) return undefined;
  return reference;
}

function pageOneSourceBasis(issue: Issue) {
  if (!hasAuthoritativePageOneSource(issue)) return undefined;
  const cover = issue.pages.find(candidate => candidate.number === 1)!;
  const assets = pageAssets(issue, cover).sort((a, b) => a.id.localeCompare(b.id));
  return {
    sourceIdentity: cover.sourceIdentity!,
    sourceFingerprint: fingerprint({ page: cover, assets }),
  };
}

export function pageOneApprovalVerificationBasis(issue: Issue, referenceId: string) {
  const source = pageOneSourceBasis(issue);
  if (!source) return undefined;
  const reference = pageOneApprovalReference(issue, referenceId);
  if (!reference) return undefined;
  return {
    ...source,
    referenceId: reference.id,
    referenceVersion: reference.version,
    referenceSourceIdentity: reference.sourceIdentity,
    referenceFingerprint: fingerprint(reference),
  };
}

export function pageOneReferenceVersionKey(referenceId: string, version: number) {
  return `${referenceId}@${version}`;
}

/** Historical verification stays immutable; currentness is derived from the exact bound versions. */
export function isCurrentPageOneApprovalVerification(
  issue: Issue,
  verification: NonNullable<Issue["pageOneApprovalHistory"]>[number],
  unavailableReferenceVersions: ReadonlySet<string> = new Set(),
) {
  if (unavailableReferenceVersions.has(pageOneReferenceVersionKey(verification.referenceId, verification.referenceVersion))) {
    return false;
  }
  const basis = pageOneApprovalVerificationBasis(issue, verification.referenceId);
  return !!basis &&
    basis.sourceIdentity === verification.sourceIdentity &&
    basis.sourceFingerprint === verification.sourceFingerprint &&
    basis.referenceVersion === verification.referenceVersion &&
    basis.referenceSourceIdentity === verification.referenceSourceIdentity &&
    basis.referenceFingerprint === verification.referenceFingerprint;
}

type PageOneApprovalVerification = NonNullable<Issue["pageOneApprovalHistory"]>[number];
type PageOneApprovalStaleReason = NonNullable<PageOneApprovalVerification["staleReasons"]>[number];

function referenceImageBinding(reference: NonNullable<Issue["artDirection"]>["references"][number]) {
  return {
    assetId: reference.assetId,
    objectPath: reference.assetSnapshot?.objectPath || "",
    url: reference.url,
  };
}

/** Explain stale bindings from current data and the immutable reference-version archive. */
export function pageOneApprovalStaleReasons(
  issue: Issue,
  verification: PageOneApprovalVerification,
  unavailableReferenceVersions: ReadonlySet<string> = new Set(),
): PageOneApprovalStaleReason[] {
  const reasons: PageOneApprovalStaleReason[] = [];
  const cover = issue.pages.find(candidate => candidate.number === 1);
  const source = pageOneSourceBasis(issue);

  if (!source) reasons.push("source_unavailable");
  if (cover?.sourceIdentity !== verification.sourceIdentity) reasons.push("source_identity_changed");
  if (source && source.sourceFingerprint !== verification.sourceFingerprint) reasons.push("source_content_changed");

  const currentReference = issue.artDirection?.references.find(reference => reference.kind === "front_page");
  if (!currentReference) {
    reasons.push("reference_missing");
  } else {
    const historicalReference = [...(issue.artDirection?.history ?? [])].reverse().find(reference =>
      reference.id === verification.referenceId && reference.version === verification.referenceVersion,
    );
    const boundReference = historicalReference ?? (
      currentReference.id === verification.referenceId && currentReference.version === verification.referenceVersion
        ? currentReference
        : undefined
    );
    const referenceVersionChanged =
      currentReference.id !== verification.referenceId || currentReference.version !== verification.referenceVersion;
    const referenceSourceChanged = currentReference.sourceIdentity !== verification.referenceSourceIdentity;
    const referenceImageChanged = !!boundReference &&
      stableJson(referenceImageBinding(boundReference)) !== stableJson(referenceImageBinding(currentReference));

    if (referenceVersionChanged) reasons.push("reference_version_changed");
    if (referenceSourceChanged) reasons.push("reference_source_changed");
    if (referenceImageChanged) reasons.push("reference_image_changed");
    if (unavailableReferenceVersions.has(pageOneReferenceVersionKey(verification.referenceId, verification.referenceVersion))) {
      reasons.push("reference_image_unavailable");
    }
    if (!pageOneApprovalReference(issue, currentReference.id)) reasons.push("reference_unavailable");

    if (
      !referenceVersionChanged &&
      !referenceSourceChanged &&
      !referenceImageChanged &&
      fingerprint(currentReference) !== verification.referenceFingerprint
    ) {
      reasons.push("reference_record_changed");
    }
  }

  if (!reasons.length) reasons.push("reference_record_changed");
  return reasons;
}

export function pageOneApprovalHistoryWithCurrentness(
  issue: Issue,
  unavailableReferenceVersions: ReadonlySet<string> = new Set(),
): Issue {
  const result = structuredClone(issue);
  if (result.artDirection) {
    result.artDirection.references = result.artDirection.references.map(reference => {
      if (reference.kind !== "front_page") return reference;
      const objectPath = reference.assetSnapshot?.objectPath;
      if (objectPath) {
        return {
          ...reference,
          imageAvailable: !unavailableReferenceVersions.has(pageOneReferenceVersionKey(reference.id, reference.version)),
        };
      }
      if (reference.url.trim()) return { ...reference, imageAvailable: true };
      return reference;
    });
  }
  result.pageOneApprovalHistory = (result.pageOneApprovalHistory || []).map(verification => {
    const isCurrent = isCurrentPageOneApprovalVerification(issue, verification, unavailableReferenceVersions);
    return {
      ...verification,
      isCurrent,
      staleReasons: isCurrent ? [] : pageOneApprovalStaleReasons(issue, verification, unavailableReferenceVersions),
    };
  });
  return result;
}

/** Gates are computed from saved evidence, never inferred from a badge or repository presence. */
export function pageReadiness(issue: Issue, page: Page) {
  const blockers: string[] = [];
  const copyReady = !!page.copy.trim() && !/SAMPLE (DRAFT|EDITORIAL)|NOT REPOSITORY COPY/i.test(page.copy) &&
    (page.number === 1 || !!page.sourceIdentity?.trim());
  const editorial = copyReady && page.editorialApproval?.reviewerRole === "myrtle_editor" && !!page.editorialApproval.reviewerAccountId?.trim();
  const assigned = issue.puzzles.filter(p => p.pages.includes(page.number));
  const puzzle = page.number === 1 || (assigned.length > 0 && assigned.every(p =>
    p.validation === "passed" && !!p.source.trim() && !!p.solution.trim() &&
    !!p.sourceIdentity?.trim() && !!p.reviewer.trim() && !!p.validationNotes.trim()));
  const assets = pageAssets(issue, page);
  const unresolvedSlot = (page.artworkSlots || []).some(s => !s.assetId || !issue.assets.some(a => a.id === s.assetId));
  const puzzleArtwork = assigned.every(p => issue.assets.some(a => a.id === p.artworkId && a.review === "approved"));
  const styleReady = page.number === 1 || (confirmedArtReferences(issue) && assets.every(a => assetStyleReady(issue, a)));
  const art = !!page.artApproval && !unresolvedSlot && puzzleArtwork && styleReady &&
    assets.every(a => a.review === "approved" && !!a.credit.trim() && !!a.source.trim());
  const resolutionReady = assets.every(a => !a.contentType.startsWith("image/") || a.dpi >= 300);
  // The locked cover can use the explicitly recorded whole-issue print reviews without modifying its frozen page.
  const coverPrintReview = page.number === 1 && ["pagination", "fonts"].every(id =>
    issue.checklist.some(c => c.id === id && c.checked && !!c.reviewer.trim() && !!c.notes.trim()));
  const print = (!!page.printApproval?.notes.trim() && !!page.printApproval.reviewer.trim() || coverPrintReview) && resolutionReady;
  if (!copyReady) blockers.push("Replace seeded/sample copy with actual editorial copy and record its source identity.");
  if (!editorial) blockers.push("A verified Myrtle editor must record editorial approval.");
  if (!puzzle) blockers.push("Assign a puzzle with source identity, protected solution, and human correctness evidence.");
  if (!art) blockers.push("Fill artwork slots, review every assigned asset, and record the page art/layout sign-off.");
  if (!styleReady) blockers.push("Open Style Guide: supply and confirm both original references, then record current human style checks for each placed asset.");
  if (!resolutionReady) blockers.push("Confirm at least 300 effective DPI for each placed image.");
  if (!print) blockers.push("A human must inspect pagination, trim, bleed, grayscale and type, then record page print evidence.");
  const canLock = blockers.length === 0;
  return {
    page: page.number, editorial, art, puzzle, print, canLock, blockers,
    nextMove: page.number === 1
      ? (page.copy.trim()
        ? (blockers.length ? "In History, compare the recovered authoritative cover and confirmed original front-page reference with the original approval document. This records evidence only; keep the locked page and snapshots unchanged." : "Keep the authoritative locked front page unchanged; inspect its preserved evidence.")
        : "Supply authoritative front-page evidence through the separate repository workflow; do not create replacement copy.")
      : blockers[0] || (page.locked ? "Inspect the immutable locked snapshot, or explicitly branch a new draft before making changes." : "Have a verified Myrtle editor explicitly lock this reviewed version."),
  };
}

export function lockedSnapshot(issue: Issue, page: Page, actor: string, notes: string) {
  return {
    id: randomUUID(), issueRevision: issue.revision + 1, at: new Date().toISOString(), actor, notes,
    page: structuredClone(page),
    puzzles: structuredClone(issue.puzzles.filter(p => p.pages.includes(page.number))),
    assets: structuredClone(pageAssets(issue, page)),
  };
}

/** Public responses must not include stored solutions or answer-bearing review notes. */
export function readerSafeIssue(issue: Issue): Issue {
  const result = structuredClone(issue);
  const sanitize = (p: Issue["puzzles"][number]) => ({
    ...p, solution: "", validationNotes: "",
    ...(p.sourceEvidence ? { sourceEvidence: { ...p.sourceEvidence, notes: "" } } : {}),
  });
  const sanitizePage = (p: Issue["pages"][number]) => ({
    ...p, ...(p.sourceEvidence ? { sourceEvidence: { ...p.sourceEvidence, notes: "" } } : {}),
  });
  result.pages = result.pages.map(sanitizePage);
  result.pageOneApprovalHistory = (result.pageOneApprovalHistory || []).map(verification => ({
    ...verification,
    reviewerAccountId: "",
    approvalDocumentIdentity: "",
    notes: "",
    sourceFingerprint: "",
    referenceSourceIdentity: "",
    referenceFingerprint: "",
  }));
  result.puzzles = result.puzzles.map(sanitize);
  result.pageSnapshots = result.pageSnapshots?.map(s => ({
    ...s, page: sanitizePage(s.page), puzzles: s.puzzles.map(sanitize),
  }));
  if (result.artDirection) {
    const protect = (r: NonNullable<Issue["artDirection"]>["references"][number]) => ({
      ...r, url: "", registrationNotes: "", approval: r.approval ? { ...r.approval, notes: "" } : null,
    });
    result.artDirection.references = result.artDirection.references.map(protect);
    result.artDirection.history = result.artDirection.history.map(protect);
  }
  result.reportedPreflightPresent = !!result.reportedPreflight;
  delete result.reportedPreflight;
  return result;
}
