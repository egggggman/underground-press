import { createHash } from "node:crypto";
import type { Issue, ProductionBlocker, ProductionStage } from "@workspace/api-zod";
import { confirmedArtReferences } from "./art-direction";
import { pageReadiness } from "./page-production";

const hasCopy = (copy: string, identity?: string) =>
  !!copy.trim() && !!identity?.trim() && !/SAMPLE (DRAFT|EDITORIAL)|NOT REPOSITORY COPY/i.test(copy);

/** An explanatory projection only: no check is removed, merged, or marked approved. */
export function productionQueue(issue: Issue, descriptions: string[], proofApproved: boolean) {
  const details: ProductionBlocker[] = descriptions.map((description, i) => {
    const pageNumber = Number(/^Page (\d+):/i.exec(description)?.[1]) || undefined;
    const page = issue.pages.find(p => p.number === pageNumber);
    const quotedPuzzle = /^Puzzle “(.*)”:/s.exec(description)?.[1];
    const quotedAsset = /^Artwork “(.*)”:/s.exec(description)?.[1];
    const puzzle = issue.puzzles.find(p => p.title === quotedPuzzle);
    const asset = issue.assets.find(a => a.name === quotedAsset);
    const assetPages = asset ? [...new Set([
      ...asset.pages,
      ...issue.puzzles.filter(p => p.artworkId === asset.id).flatMap(p => p.pages),
      ...issue.pages.filter(p => p.artworkSlots?.some(s => s.assetId === asset.id)).map(p => p.number),
    ])].sort((a, b) => a - b) : [];
    const assigned = page ? issue.puzzles.filter(p => p.pages.includes(page.number)) : [];
    const check = page ? pageReadiness(issue, page) : undefined;
    const b: ProductionBlocker = {
      id: `check-${createHash("sha256").update(description).digest("hex").slice(0, 16)}-${i + 1}`,
      ordinal: i + 1, description, pages: page ? [page.number] : puzzle?.pages || assetPages,
      rootCause: "Unclassified check", owner: "human editor", priority: 5, state: "unknown",
      prerequisite: "Inspect the exact original description; do not infer an empty check's meaning.",
      nextMove: "Inspect this check and its saved preflight record. Supply missing context before taking action.",
      href: "/proof",
    };
    if (pageNumber === 1 && !/pagination|page print evidence/i.test(description)) {
      Object.assign(b, {
        priority: 1, rootCause: "Protected front-page evidence", owner: "Press",
        state: page?.copy.trim() ? "awaiting_human_approval" : "missing_source",
        prerequisite: "The exact authoritative cover source, current confirmed original front-page reference, and original approval document. Page 1 cannot be edited or branched.",
        nextMove: page?.copy.trim()
          ? "In History, have a currently authorized Myrtle editor compare the preserved cover and exact confirmed reference with the original approval document and record evidence notes. This does not create editorial or art approval."
          : "Supply the authoritative repository Issue #1 file and approved front-page benchmark. Use Repository's separate missing-source preview/confirmation; do not import Page 1 as draft copy.",
        href: page?.copy.trim() ? "/history" : "/repository",
      });
    } else if (/Style Guide/i.test(description)) {
      const supplied = ["golden_image", "front_page"].every(kind => issue.artDirection?.references.some(r => r.kind === kind));
      const confirmed = confirmedArtReferences(issue);
      Object.assign(b, {
        priority: confirmed ? 4 : 1, rootCause: confirmed ? "Current asset style evidence" : "Original art references",
        owner: confirmed ? "human editor" : "Press",
        state: confirmed ? "awaiting_human_approval" : supplied ? "awaiting_human_approval" : "missing_source",
        prerequisite: "Both exact originals must be supplied and explicitly confirmed by a Myrtle editor before asset style checks can pass.",
        nextMove: confirmed
          ? "Compare every placed asset with the current original references and record its complete human style checklist in Artwork."
          : supplied
            ? "Have a verified Myrtle editor inspect both supplied originals and explicitly confirm their identity in Style Guide."
            : "Upload/select or link the exact approved Golden Image and front-page benchmark in Style Guide. Supply original provenance; no substitute will be generated.",
        href: confirmed ? "/artwork" : "/style-guide",
      });
    } else if (/final sourced copy|seeded\/sample copy|source identity.*copy|copy.*source identity|Sample copy replaced/i.test(description)) {
      Object.assign(b, {
        priority: pageNumber === 8 || pageNumber === 9 ? 3 : page ? 2 : 1,
        rootCause: "Sourced editorial copy", owner: pageNumber === 8 || pageNumber === 9 ? "Puzzle Dojo" : "Press",
        state: "missing_source",
        prerequisite: "Actual source text plus author/document/repository identity. A file receipt is not acceptance or editorial approval.",
        nextMove: page
          ? `Import or enter actual sourced draft copy for page ${page.number}, record source identity and evidence notes, then save an unapproved draft.`
          : "Replace seeded copy with actual sourced drafts and check repository sources/credits in Continuity.",
        href: page ? `/pages?page=${page.number}` : "/continuity",
      });
    } else if (/editorial (sign-off|approval)/i.test(description)) {
      Object.assign(b, {
        priority: 4, rootCause: "Myrtle editorial sign-off", owner: "human editor",
        state: page && hasCopy(page.copy, page.sourceIdentity) && check?.puzzle ? "awaiting_human_approval" : "blocked_by_prerequisite",
        prerequisite: "Sourced copy, actual puzzle correctness/placement evidence, submitted Review state, and a currently authorized Myrtle editor.",
        nextMove: `After prerequisites, submit page ${pageNumber} for review. A verified Myrtle editor must read it and explicitly record editorial approval with evidence notes.`,
        href: `/pages?page=${pageNumber}`,
      });
    } else if (/assign a puzzle|human-validated solution|source, solution, and correctness|page assignment required/i.test(description)) {
      const present = puzzle ? [puzzle] : assigned;
      const sourcesPresent = present.length > 0 && present.every(p => p.source.trim() && p.solution.trim() && p.sourceIdentity?.trim());
      Object.assign(b, {
        priority: 3, rootCause: "Puzzle source, correctness and placement", owner: "Puzzle Dojo",
        state: present.some(p => p.validation === "failed") ? "needs_changes" : sourcesPresent ? "awaiting_human_approval" : "missing_source",
        prerequisite: "Real puzzle source, protected complete answer, source identity, original artwork and a human correctness review. Pages 8–9 remain the main section.",
        nextMove: puzzle
          ? `Supply missing source/answer/provenance for “${puzzle.title}”, inspect it with a human solver, record actual validation evidence, and assign it to unlocked pages 2–10.`
          : "Import or enter real puzzles as unvalidated inventory in Puzzle Dojo. Have a human solver check the source against the protected answer, then assign integrated puzzles to 2–7/10 and main puzzles to 8–9.",
        href: "/puzzles",
      });
    } else if (/artwork\/layout|art\/layout sign-off|artwork slots|approved artwork required|human review required/i.test(description)) {
      Object.assign(b, {
        priority: 4, rootCause: "Original artwork and layout review", owner: "human editor",
        state: "blocked_by_prerequisite",
        prerequisite: "Original artwork, metadata/credits, artwork-slot assignments, confirmed reference originals and current asset style sign-offs.",
        nextMove: asset
          ? `Inspect original asset “${asset.name}” in Artwork and record a separate human art review and current style checklist.`
          : puzzle
            ? "Supply and review original puzzle artwork in Assets/Artwork, then assign it to this puzzle in Puzzle Dojo."
            : `Fill page ${pageNumber}'s artwork slots using actual reviewed assets. After current asset style sign-offs, record the page layout approval explicitly.`,
        href: asset ? "/artwork" : puzzle ? "/puzzles" : `/pages?page=${pageNumber}`,
      });
    } else if (/source and credit required/i.test(description)) {
      Object.assign(b, {
        priority: 1, rootCause: "Artwork source and permissions", owner: "Press", state: "missing_source",
        prerequisite: "Actual original file, creator/source identity, credit and permission evidence.",
        nextMove: `Record original provenance, credit and permissions for “${asset?.name || quotedAsset}” in Assets. Do not describe sample uploads as verified repository art.`,
        href: "/assets",
      });
    } else if (/print|DPI|pagination|trim|bleed|resolution/i.test(description)) {
      Object.assign(b, {
        priority: 5, rootCause: "Human print inspection", owner: "human print inspector",
        state: check && (!check.editorial || !check.art || !check.puzzle) ? "blocked_by_prerequisite" : "awaiting_human_approval",
        prerequisite: "Accepted sources, human puzzle validation, current editorial/art/style sign-offs, then actual pagination/trim/bleed/font/grayscale/resolution inspection.",
        nextMove: asset
          ? "Measure effective resolution at the intended printed size; record actual metadata in Assets, then inspect the proof."
          : page?.number === 1
            ? "Inspect the preserved front page in Proof and record whole-issue print inspection in Continuity. Do not edit locked Page 1 to add print evidence."
          : page
            ? `Inspect page ${page.number} in Proof, then record its human print evidence in page detail. Final whole-issue proof approval remains separate.`
            : "Inspect the actual ten-page working proof and record print evidence in Continuity. Run fresh preflight; a verified Myrtle editor must explicitly approve the exact current proof.",
        href: asset ? "/assets" : page?.number === 1 ? "/continuity" : page ? `/pages?page=${page.number}` : "/proof",
      });
    } else if (/Motto matches|Anonymous attribution|Canon advertisers|Story continuity|1991 setting|Integrated puzzles/i.test(description)) {
      Object.assign(b, {
        priority: 5, rootCause: "Canon and editorial continuity", owner: "Canon", state: "awaiting_human_approval",
        prerequisite: "Actual sourced page content and advertiser permission evidence, not seeded canon labels alone.",
        nextMove: "Compare all pages against the motto, anonymous masthead, 1991 Portland setting and four canonical advertisers. Record actual continuity evidence with human notes.",
        href: "/continuity",
      });
    }
    return b;
  });
  const specs: Omit<ProductionStage, "state" | "blockerIds">[] = [
    { priority: 1, title: "Recover original sources and references", owner: "Press", pages: [1], prerequisite: "Owner supplies the authoritative Issue #1 source, exact approved Golden Image, front-page benchmark and original provenance/approval records.", nextMove: "Recover protected Page 1 through Repository's separate source preview; register and confirm exact originals in Style Guide. Never replace locked art.", href: "/repository" },
    { priority: 2, title: "Prepare sourced editorial drafts", owner: "Press", pages: [2, 3, 4, 5, 6, 7, 10], prerequisite: "Original source recovery and actual authored copy with source identity/evidence. Independent draft gathering is safe; approvals remain blocked.", nextMove: "Preview source-copy imports or edit sourced drafts for pages 2–7 and 10. Save as unapproved drafts.", href: "/pages" },
    { priority: 3, title: "Supply and human-validate real puzzles", owner: "Puzzle Dojo", pages: [2, 3, 4, 5, 6, 7, 8, 9, 10], prerequisite: "Actual puzzle sources, protected answers, creator/version identity and original artwork. Earlier phases gate final approval, not safe inventory intake.", nextMove: "Import unvalidated inventory with preview/confirmation; a human solver records correctness evidence. Assign pages 2–10, retaining main Puzzle Dojo on 8–9.", href: "/puzzles" },
    { priority: 4, title: "Record editorial and artwork approvals", owner: "human editor", pages: [2, 3, 4, 5, 6, 7, 8, 9, 10], prerequisite: "Sourced copy, human-validated placed puzzles and exact confirmed original art references; all affected locked pages require explicit branching first.", nextMove: "Record current per-asset art/style reviews and page layout approvals. A verified Myrtle editor records editorial sign-offs; lock only through explicit human confirmation.", href: "/artwork" },
    { priority: 5, title: "Inspect continuity and the print proof", owner: "Canon / human print inspector", pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], prerequisite: "All earlier live source, correctness and approval checks must pass. A grouped queue does not clear any underlying check.", nextMove: "Inspect canon and all ten printed pages, record continuity/page-print evidence, run fresh preflight and obtain an explicit current Myrtle proof approval.", href: "/continuity" },
  ];
  const stages: ProductionStage[] = specs.map(s => {
    const blockerIds = details.filter(b => b.priority === s.priority).map(b => b.id);
    const earlier = details.some(b => b.priority < s.priority);
    const state: ProductionStage["state"] = earlier ? "waiting_on_prerequisite"
      : blockerIds.length ? "actionable" : s.priority === 5 && !proofApproved ? "awaiting_human_approval" : "clear";
    const pages = [...new Set([...s.pages, ...details.filter(b => b.priority === s.priority).flatMap(b => b.pages)])].sort((a, b) => a - b);
    return { ...s, pages, blockerIds, state };
  });
  return { blockerDetails: details, productionQueue: stages };
}
