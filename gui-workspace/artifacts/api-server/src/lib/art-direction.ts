import type { Issue } from "./press-workflow";

export const STYLE_CHECK_KEYS = [
  "referenceMatch", "spotInks", "typography", "inkIllustration",
  "halftoneRegistration", "boxedComposition", "legibilityPrint", "provenancePreserved",
] as const;

export function confirmedArtReferences(issue: Issue) {
  return ["golden_image", "front_page"].every(kind =>
    issue.artDirection?.references.some(r => r.kind === kind &&
      r.approval?.reviewerRole === "myrtle_editor" && !!r.approval.reviewerAccountId &&
      !!r.approval.notes.trim() &&
      !!r.sourceIdentity.trim() && !!(r.assetSnapshot?.objectPath || r.url)));
}

export function artReferenceIds(issue: Issue) {
  return (issue.artDirection?.references || []).map(r => r.id).sort();
}

/** A past pass never implies compliance with a newer reference version. */
export function assetStyleReady(issue: Issue, asset: Issue["assets"][number]) {
  const review = asset.styleReview;
  return confirmedArtReferences(issue) && review?.decision === "passed" &&
    !!review.notes.trim() && !!review.reviewerAccountId.trim() &&
    STYLE_CHECK_KEYS.every(key => review.checks[key] === true) &&
    JSON.stringify([...review.referenceIds].sort()) === JSON.stringify(artReferenceIds(issue));
}
