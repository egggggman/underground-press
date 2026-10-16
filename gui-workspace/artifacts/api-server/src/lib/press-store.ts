import {
  db,
  pressGitHubMediaReplacementsTable,
  pressGitHubMediaRestoresTable,
  pressIssuesTable,
  pressVersionsTable,
  usersTable,
  type NewGitHubMediaReplacementAudit,
  type NewGitHubMediaRestoreAudit,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { GetIssueResponse } from "@workspace/api-zod";
import { initialIssue } from "./press-seed";
import { ensureCurrentRevision, PressError, type Issue } from "./press-workflow";
import {
  isProtectedRegisteredAssetPath,
  lockedSnapshot,
  migrateLegacyGoldenImageReference,
  migrateLegacyPageOneReference,
} from "./page-production";
import { ObjectStorageService } from "./objectStorage";
import { createWorkingAssetAclPolicy } from "./objectAcl";
import { matchesDeclaredMediaType } from "./github-media-paths";

function document(issue: Issue) { return issue as unknown as Record<string, unknown>; }
const storage = new ObjectStorageService();

async function protectedArtReferenceCopy(issue: Issue, kind: "front_page" | "golden_image") {
  const reference = issue.artDirection?.references.find(candidate => candidate.kind === kind);
  const snapshot = reference?.assetSnapshot;
  const legacyPath = snapshot?.objectPath || "";
  if (!legacyPath.startsWith("/objects/uploads/")) return undefined;

  const savedAsset = issue.assets.find(asset => asset.id === snapshot?.id);
  if (
    !savedAsset ||
    !isProtectedRegisteredAssetPath(savedAsset.objectPath) ||
    savedAsset.contentType !== snapshot?.contentType ||
    savedAsset.size !== snapshot?.size ||
    !savedAsset.contentType.startsWith("image/")
  ) return undefined;

  try {
    const source = await storage.getObjectEntityFile(savedAsset.objectPath);
    const [metadata] = await source.getMetadata();
    const [bytes] = await source.download();
    if (
      Number(metadata.size) !== savedAsset.size ||
      metadata.contentType !== savedAsset.contentType ||
      bytes.length !== savedAsset.size ||
      !matchesDeclaredMediaType(bytes, savedAsset.contentType)
    ) return undefined;

    const objectPath = `/objects/registered-assets/${randomUUID()}`;
    await storage.saveObjectEntityAtPath(objectPath, bytes, savedAsset.contentType);
    await storage.trySetObjectEntityAclPolicy(
      objectPath,
      createWorkingAssetAclPolicy(reference!.suppliedBy || `${kind}-reference-migration`),
    );
    return { ...structuredClone(snapshot!), objectPath };
  } catch {
    // A missing or unverifiable original must never retain an active mutable binding.
    return undefined;
  }
}

export async function getIssue() {
  const initial = initialIssue();
  // Concurrent first requests are safe; only one seed creates a version.
  await db.transaction(async tx => {
    const inserted = await tx.insert(pressIssuesTable).values({ id: 1, document: document(initial) }).onConflictDoNothing().returning();
    if (inserted.length) await tx.insert(pressVersionsTable).values({
      revision: 1, action: "Initial sample issue — no verified repository assets", actor: "System", document: document(initial),
    });
    // Additive legacy capture: preserve existing locks verbatim, without granting approval.
    const [stored] = await tx.select().from(pressIssuesTable).where(eq(pressIssuesTable.id, 1)).for("update");
    const current = GetIssueResponse.parse(stored!.document);
    const frontPageReference = current.artDirection?.references.find(reference => reference.kind === "front_page");
    if (frontPageReference?.assetSnapshot?.objectPath.startsWith("/objects/uploads/")) {
      const protectedSnapshot = await protectedArtReferenceCopy(current, "front_page");
      const migrated = migrateLegacyPageOneReference(current, protectedSnapshot);
      migrated.revision++;
      migrated.updatedAt = new Date().toISOString();
      await tx.update(pressIssuesTable).set({ document: document(migrated) }).where(eq(pressIssuesTable.id, 1));
      await tx.insert(pressVersionsTable).values({
        revision: migrated.revision,
        action: protectedSnapshot
          ? "Moved Page 1 reference onto a protected image version; confirmation required"
          : "Removed unverifiable Page 1 upload binding; fresh reference required",
        actor: "System",
        document: document(migrated),
      });
      Object.assign(current, migrated);
    }
    const goldenImageReference = current.artDirection?.references.find(reference => reference.kind === "golden_image");
    if (goldenImageReference?.assetSnapshot?.objectPath.startsWith("/objects/uploads/")) {
      const protectedSnapshot = await protectedArtReferenceCopy(current, "golden_image");
      const migrated = migrateLegacyGoldenImageReference(current, protectedSnapshot);
      migrated.revision++;
      migrated.updatedAt = new Date().toISOString();
      await tx.update(pressIssuesTable).set({ document: document(migrated) }).where(eq(pressIssuesTable.id, 1));
      await tx.insert(pressVersionsTable).values({
        revision: migrated.revision,
        action: protectedSnapshot
          ? "Moved Golden Image reference onto a protected image version; confirmation required"
          : "Removed unverifiable Golden Image upload binding; fresh reference required",
        actor: "System",
        document: document(migrated),
      });
      Object.assign(current, migrated);
    }
    const missing = current.pages.filter(page => page.locked && !(current.pageSnapshots || []).some(s => s.page.number === page.number));
    if (missing.length) {
      current.pageSnapshots = [...(current.pageSnapshots || []), ...missing.map(page =>
        lockedSnapshot(current, page, "System — preserved existing lock", "Existing locked evidence captured unchanged; this is not a new approval or verification."))];
      current.revision++;
      current.updatedAt = new Date().toISOString();
      await tx.update(pressIssuesTable).set({ document: document(current) }).where(eq(pressIssuesTable.id, 1));
      await tx.insert(pressVersionsTable).values({
        revision: current.revision, action: "Preserved existing locks as immutable snapshots — no new approvals", actor: "System", document: document(current),
      });
    }
  });
  const [row] = await db.select().from(pressIssuesTable).where(eq(pressIssuesTable.id, 1));
  return GetIssueResponse.parse(row!.document);
}

export async function mutateIssue(revision: number, action: string, actor: string, change: (issue: Issue) => Issue) {
  await getIssue();
  return db.transaction(async tx => {
    const [row] = await tx.select().from(pressIssuesTable).where(eq(pressIssuesTable.id, 1)).for("update");
    const issue = GetIssueResponse.parse(row!.document);
    ensureCurrentRevision(issue.revision, revision);
    const next = change(issue);
    await tx.update(pressIssuesTable).set({ document: document(next) }).where(eq(pressIssuesTable.id, 1));
    await tx.insert(pressVersionsTable).values({ revision: next.revision, action, actor, document: document(next) });
    return next;
  });
}

export async function withIssueRevisionLock<T>(revision: number, action: (issue: Issue) => Promise<T>): Promise<T> {
  await getIssue();
  return db.transaction(async tx => {
    const [row] = await tx.select().from(pressIssuesTable).where(eq(pressIssuesTable.id, 1)).for("update");
    const issue = GetIssueResponse.parse(row!.document);
    if (revision !== issue.revision) {
      throw new PressError("This issue changed in another session. Refresh before pushing; no GitHub commit was created.", 409);
    }
    return action(issue);
  });
}
export async function listVersions() {
  const rows = await db.select({
    id: pressVersionsTable.id, revision: pressVersionsTable.revision,
    at: pressVersionsTable.at, action: pressVersionsTable.action, actor: pressVersionsTable.actor,
  }).from(pressVersionsTable).orderBy(desc(pressVersionsTable.revision));
  return rows.map(row => ({ ...row, at: row.at.toISOString() }));
}
export async function getVersion(id: number) {
  const [row] = await db.select().from(pressVersionsTable).where(eq(pressVersionsTable.id, id));
  if (!row) throw new PressError("Version not found.", 404);
  return GetIssueResponse.parse(row.document);
}

export async function recordGitHubMediaReplacement(
  replacement: Omit<NewGitHubMediaReplacementAudit, "id" | "at">,
) {
  const [record] = await db
    .insert(pressGitHubMediaReplacementsTable)
    .values(replacement)
    .returning();
  return record;
}

export async function listGitHubMediaReplacementAudits() {
  return db
    .select()
    .from(pressGitHubMediaReplacementsTable)
    .orderBy(desc(pressGitHubMediaReplacementsTable.at), desc(pressGitHubMediaReplacementsTable.id));
}

export async function recordGitHubMediaRestore(
  restore: Omit<NewGitHubMediaRestoreAudit, "id" | "at">,
) {
  const [record] = await db
    .insert(pressGitHubMediaRestoresTable)
    .values(restore)
    .returning();
  return record;
}

export async function listGitHubMediaRestores() {
  const rows = await db
    .select({
      id: pressGitHubMediaRestoresTable.id,
      at: pressGitHubMediaRestoresTable.at,
      owner: pressGitHubMediaRestoresTable.owner,
      repo: pressGitHubMediaRestoresTable.repo,
      branch: pressGitHubMediaRestoresTable.branch,
      issuePath: pressGitHubMediaRestoresTable.issuePath,
      assetId: pressGitHubMediaRestoresTable.assetId,
      fileName: pressGitHubMediaRestoresTable.fileName,
      filePath: pressGitHubMediaRestoresTable.filePath,
      outcome: pressGitHubMediaRestoresTable.outcome,
      failureReason: pressGitHubMediaRestoresTable.failureReason,
      actorFirstName: usersTable.firstName,
      actorLastName: usersTable.lastName,
      actorEmail: usersTable.email,
    })
    .from(pressGitHubMediaRestoresTable)
    .leftJoin(usersTable, eq(pressGitHubMediaRestoresTable.accountId, usersTable.id))
    .orderBy(desc(pressGitHubMediaRestoresTable.at), desc(pressGitHubMediaRestoresTable.id));
  return rows.map(({ actorFirstName, actorLastName, actorEmail, ...row }) => ({
    ...row,
    actorDisplayName: [actorFirstName, actorLastName].filter(Boolean).join(" ").trim()
      || actorEmail?.trim()
      || "Authenticated newsroom account",
    at: row.at.toISOString(),
  }));
}
