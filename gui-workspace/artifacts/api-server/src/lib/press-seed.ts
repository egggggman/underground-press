import { GetIssueResponse } from "@workspace/api-zod";

export function initialIssue() {
  const titles = [
    "Front Page", "Something's Moving Beneath Portland", "The City Below the City",
    "A Place to Land", "Shellshock Open", "Heroes & Villains File",
    "Classifieds", "Puzzle Dojo", "Puzzle Dojo", "Support Our Advertisers",
  ];
  const sections = ["Cover", "Neighborhood", "Dispatches", "Editorial", "Culture", "People", "Community", "Puzzles", "Puzzles", "Advertisers"];
  const drafts = [
    "",
    "SAMPLE DRAFT — NOT REPOSITORY COPY\n\nSomething's moving beneath Portland. Maybe it's a story, maybe it's a neighbor with something to say. This space awaits sourced reporting and a voice from the block.\n\nEditorial task: replace this sample with the repository draft, check every attribution, and reserve space for the integrated puzzle.",
    "SAMPLE DRAFT — NOT REPOSITORY COPY\n\nThe city below the city is a place to begin asking questions, not a license to invent answers. Collect the voices, the maps, and the details that make this neighborhood its own.\n\nReporting and historical claims remain unverified. Replace this planning copy before review.",
    "SAMPLE EDITORIAL DRAFT\n\nWe're all looking for a place to land.\n\nA paper can be one small place to stand together. The Underground Press is a neighborhood conversation, open to the people who make it. Nobody owns the last word.\n\nThis is sample copy, awaiting the actual editorial and Myrtle's approval.",
    "SAMPLE DRAFT — CULTURE DESK\n\nShellshock Open\n\nThe announcement, participants, date, and venue have not been supplied. No event details are verified. Import the authoritative draft, then review the copy and puzzle placement.",
    "SAMPLE DRAFT — PEOPLE DESK\n\nHeroes & Villains File\n\nProfiles belong to real voices, not placeholder claims. This page awaits the repository copy, checked credits, artwork, and an integrated puzzle.",
    "SAMPLE DRAFT — COMMUNITY DESK\n\nClassifieds\n\nNo classified submissions have been verified. Collect notices, permissions, and contact details through the editorial process. Do not print sample listings.",
    "SAMPLE DRAFT — MAIN PUZZLE SECTION\n\nPuzzle Dojo / Part I\n\nAwaiting puzzle sources, solutions, artwork, and independent correctness review. No puzzle is validated or approved for print.",
    "SAMPLE DRAFT — MAIN PUZZLE SECTION\n\nPuzzle Dojo / Part II\n\nKeep this page and page 8 as the main puzzle section. Assign actual inventory here after source and solution review.",
    "SAMPLE DRAFT — ADVERTISER DESK\n\nSupport Our Advertisers\n\nThe Crust Bucket / Quality Shop / Great Lost Bear / Tony's Donuts\n\nThese names are canon references, not verified ad placements. Artwork, permissions, ad copy, and the integrated puzzle are still required.",
  ];
  const labels = [
    ["canon-motto", "Motto matches: We're all looking for a place to land"],
    ["canon-attribution", "Anonymous attribution: Published by Nobody / Contributors Everybody / Approved by Myrtle"],
    ["advertisers", "Canon advertisers and ad permissions checked"],
    ["continuity", "Story continuity, spelling, names, and 1991 setting reviewed"],
    ["sources", "Sample copy replaced; repository sources and credits checked"],
    ["puzzle-layout", "Integrated puzzles on 2–7 and 10; main Puzzle Dojo preserved on 8–9"],
    ["pagination", "Human print check: ten pages, pagination, trim size, and bleed"],
    ["fonts", "Human print check: fonts, legibility, grayscale, and image resolution"],
  ];
  return GetIssueResponse.parse({
    schemaVersion: 1, number: 1, name: "The Underground Press", revision: 1,
    motto: "We're all looking for a place to land",
    attribution: "Published by Nobody / Contributors Everybody / Approved by Myrtle",
    advertisers: ["The Crust Bucket", "Quality Shop", "Great Lost Bear", "Tony's Donuts"],
    githubSync: "inactive",
    pages: titles.map((title, i) => ({
      number: i + 1, title, section: sections[i], copy: drafts[i],
      status: "draft", locked: i === 0,
      provenance: i === 0 ? "Locked · authoritative front-page source not supplied" : "sample",
      editorialApproval: null, artApproval: null,
    })),
    assets: [], puzzles: [], proofs: [], pageOneApprovalHistory: [],
    checklist: labels.map(([id, label]) => ({ id, label, checked: false, reviewer: "", notes: "" })),
    updatedAt: new Date().toISOString(),
  });
}
