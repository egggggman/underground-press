import 
{
 Router, type IRouter, type Request, type Response, type NextFunction 
}
 from "express"
;

import { randomUUID } from "node:crypto";

import 
{

  ExecutePressCommandBody, GetIssueResponse, GetReadinessResponse, ListVersionsResponse,
  GetVersionParams, GetVersionResponse, ExportIssueResponse, ImportIssueBody,
  GetGitHubConnectionStatusResponse, ListGitHubRepositoriesParams, ListGitHubRepositoriesResponse,
  PreviewGitHubPullBody, PreviewGitHubPullResponse, ApplyGitHubPullBody, ApplyGitHubPullResponse,
  PreviewGitHubPushBody, PreviewGitHubPushResponse, ApplyGitHubPushBody, ApplyGitHubPushResponse,
  PreviewGitHubPageOneSourceBody, PreviewGitHubPageOneSourceResponse,
  ApplyGitHubPageOneSourceBody, ApplyGitHubPageOneSourceResponse,
  PreviewGitHubMediaTransferBody, PreviewGitHubMediaTransferResponse,
  ApplyGitHubMediaTransferBody, ApplyGitHubMediaTransferResponse,
  ListGitHubMediaReplacementAuditsResponse,
  ListGitHubMediaRestoresResponse,
}
 from "@workspace/api-zod"
;

import 
{
 getIssue, getVersion, listVersions, mutateIssue, withIssueRevisionLock,
 listGitHubMediaReplacementAudits, recordGitHubMediaReplacement,
  listGitHubMediaRestores, recordGitHubMediaRestore,
}
 from "../lib/press-store"
;

import 
{
 applyCommand, readiness, safeImport, PressError, ensureUploadedAssetMetadata, readerSafeIssue,
  ensureGitHubPreviewRevision, ensureGitHubSourceLoadConfirmed, pageOneApprovalHistoryWithCurrentness,
 preserveGitHubPageOneForPush, applyGitHubPageOneSource,
}
 from "../lib/press-workflow"
;

import 
{
 ObjectNotFoundError, ObjectStorageService
}
 from "../lib/objectStorage"
;
import { pageOneReferenceVersionKey } from "../lib/page-production";

import { createWorkingAssetAclPolicy, ObjectPermission } from "../lib/objectAcl";

import 
{

  checkGitHubPreviewVersion, createGitHubIssueCommit, getGitHubIdentity, getGitHubIssueSnapshot, listGitHubRepositories,
  createGitHubMediaCommit,
  validateGitHubSelection, type GitHubSelection,
}
 from "../lib/github"
;

import {
  buildGitHubMediaTransferPreview,
  GitHubMediaDownloadError,
  GITHUB_MEDIA_DOWNLOAD_FAILED_CODE,
  GITHUB_MEDIA_RATE_LIMITED_CODE,
  GITHUB_MEDIA_TYPE_MISMATCH_MESSAGE,
} from "../lib/github-media";
import {
  matchesDeclaredMediaType,
  mediaFingerprintsMatch,
  resolveMediaFileSelection,
} from "../lib/github-media-paths";


import { hasNewsroomAdminRole, MYRTLE_EDITOR_ROLE } from "../lib/press-roles";
import { isMyrtleEditorAssigned } from "../lib/press-role-store";
import type { VerifiedMyrtleEditor } from "../lib/press-workflow";

const router: IRouter = Router()
;

router.use("/press", (_req, res, next) => 
{
 res.setHeader("Cache-Control", "no-store")
;
 next()
;
 
}
)
;

router.get("/press/issue", async (req, res): Promise<void> => 
{
 const issue = GetIssueResponse.parse(await issueWithPageOneReferenceAvailability(await getIssue()));
 res.json(req.isAuthenticated() ? issue : readerSafeIssue(issue))
;
 
}
)
;

router.get("/press/readiness", async (_req, res): Promise<void> => 
{
 res.json(GetReadinessResponse.parse(readiness(await getIssue())))
;
 
}
)
;

router.get("/press/versions", async (_req, res): Promise<void> => 
{
 await getIssue()
;
 res.json(ListVersionsResponse.parse(await listVersions()))
;
 
}
)
;

router.get("/press/versions/:id", async (req, res): Promise<void> => 
{

  const parsed = GetVersionParams.safeParse(req.params)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid version ID." 
}
)
;
 return
;
 
}

  const issue = await getVersion(parsed.data.id);
  res.json(GetVersionResponse.parse(req.isAuthenticated() ? issue : readerSafeIssue(issue)))
;

}
)
;

router.get("/press/export", async (req, res): Promise<void> => 
{

  res.setHeader("Content-Disposition", 'attachment; filename="underground-press-issue-1.json"')
;

  const issue = ExportIssueResponse.parse(await issueWithPageOneReferenceAvailability(await getIssue()));
  res.json(req.isAuthenticated() ? issue : readerSafeIssue(issue))
;

}
)
;

function authenticated(req: Request, res: Response, next: NextFunction) 
{

  if (!req.isAuthenticated()) 
{
 res.status(401).json(
{
 error: "Log in to make changes or record human approval." 
}
)
;
 return
;
 
}

  next()
;

}

const storage = new ObjectStorageService()
;

async function unavailablePageOneReferenceVersions(issue: Awaited<ReturnType<typeof getIssue>>): Promise<Set<string>> {
  const unavailable = new Set<string>();
  const references = issue.artDirection?.references.filter(reference =>
    reference.kind === "front_page" && !!reference.assetSnapshot?.objectPath,
  ) ?? [];
  for (const reference of references) {
    try {
      await storage.getObjectEntityFile(reference.assetSnapshot!.objectPath);
    } catch (error) {
      if (!(error instanceof ObjectNotFoundError)) throw error;
      unavailable.add(pageOneReferenceVersionKey(reference.id, reference.version));
    }
  }
  return unavailable;
}

async function issueWithPageOneReferenceAvailability(issue: Awaited<ReturnType<typeof getIssue>>) {
  return pageOneApprovalHistoryWithCurrentness(
    issue,
    await unavailablePageOneReferenceVersions(issue),
  );
}

async function pageOneReferenceImageIsAvailable(
  issue: Awaited<ReturnType<typeof getIssue>>,
  referenceId: string,
): Promise<boolean> {
  const reference = issue.artDirection?.references.find(item =>
    item.id === referenceId && item.kind === "front_page",
  );
  const objectPath = reference?.assetSnapshot?.objectPath;
  if (!objectPath) return true;
  try {
    await storage.getObjectEntityFile(objectPath);
    return true;
  } catch (error) {
    if (!(error instanceof ObjectNotFoundError)) throw error;
    return false;
  }
}

router.post("/press/commands", authenticated, async (req, res): Promise<void> => 
{

  const parsed = ExecutePressCommandBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid command data.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  const command = parsed.data
;

  const needsMyrtleEditor = command.action === "approve_editorial" || command.action === "approve_proof" || command.action === "lock_page" || command.action === "set_art_reference" || command.action === "confirm_art_reference" || command.action === "verify_page_one_approval";
  let editor: VerifiedMyrtleEditor | undefined;
  if (needsMyrtleEditor) {
    if (!(await isMyrtleEditorAssigned(req.user!.id))) {
      res.status(403).json({ error: "Only an account assigned the Myrtle editor role can record this sign-off." });
      return;
    }
    const user = req.user!;
    const displayName = [user.firstName, user.lastName].filter((part) => part?.trim()).join(" ").trim()
      || user.email?.trim()
      || user.id;
    editor = { accountId: user.id, displayName, role: MYRTLE_EDITOR_ROLE };
  }

  if ((command.action === "add_asset" || command.action === "edit_asset") && command.asset)
{

    if (command.action === "add_asset" && (
      !storage.isObjectEntityUploadOwnedBy(
        command.asset.objectPath,
        req.user!.id,
      )
    )) {
      res.status(403).json({ error: "Only the account that requested this upload can register it as an asset." });
      return;
    }

    // Metadata cannot claim an upload that never completed.
    const file = await storage.getObjectEntityFile(command.asset.objectPath)
;

    const [metadata] = await file.getMetadata()
;

    ensureUploadedAssetMetadata(command.asset, metadata)
;

    const [bytes] = await file.download()
;

    if (bytes.length !== command.asset.size) {
      throw new PressError("Uploaded file size does not match metadata.");
    }

    if (!matchesDeclaredMediaType(bytes, command.asset.contentType)) {
      throw new PressError("Uploaded file contents do not match the declared supported type.");
    }

    if (command.action === "add_asset") {
      // Signed upload URLs can overwrite their temporary object path. Freeze
      // the validated bytes at a server-owned, create-only path before saving
      // the asset record so later PUTs to the upload URL cannot change it.
      const registeredObjectPath = `/objects/registered-assets/${randomUUID()}`;
      await storage.saveObjectEntityAtPath(
        registeredObjectPath,
        bytes,
        command.asset.contentType,
      );
      await storage.trySetObjectEntityAclPolicy(
        registeredObjectPath,
        createWorkingAssetAclPolicy(req.user!.id),
      );
      command.asset.objectPath = registeredObjectPath;
    }

  
}

  if (command.action === "verify_page_one_approval") {
    if (!await pageOneReferenceImageIsAvailable(await getIssue(), command.referenceId || "")) {
      res.status(409).json({
        error: "The exact confirmed front-page reference image is unavailable. Register and confirm a new reference image before recording a verification.",
      });
      return;
    }
  }

  const updated = await mutateIssue(command.revision, command.action, req.user!.id, issue => applyCommand(issue, command, editor, req.user!.id));
  res.json(GetIssueResponse.parse(await issueWithPageOneReferenceAvailability(updated)))
;

}
)
;

router.post("/press/import", authenticated, async (req, res): Promise<void> => 
{

  const parsed = ImportIssueBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Import schema is invalid. No data was changed." 
}
)
;
 return
;
 
}

  if (!parsed.data.confirmed) 
{
 res.status(400).json(
{
 error: "Review and explicitly confirm the import first." 
}
)
;
 return
;
 
}

  const 
{
 revision, issue 
}
 = parsed.data
;

  for (const asset of issue.assets) 
{

    try 
{

      const file = await storage.getObjectEntityFile(asset.objectPath)
;

      const policy = await storage.ensureWorkingObjectAclPolicy(asset.objectPath, file);
      if (
        !policy ||
        !(await storage.canAccessObjectEntity({
          userId: req.user!.id,
          objectFile: file,
          requestedPermission: ObjectPermission.READ,
        }))
      ) {
        res.status(403).json({ error: `You are not allowed to import file: ${asset.name}.` });
        return;
      }

    
}
 catch 
{

      res.status(400).json(
{
 error: `Import references unavailable file: ${asset.name}. Upload the file in this workspace first.` 
}
)
;
 return
;

    
}

  
}

  res.json(GetIssueResponse.parse(await mutateIssue(revision, "Import working copy — approval gates reset; page 1 preserved", req.user!.id, current => safeImport(current, issue))))
;

}
)
;


router.get("/press/github/status", authenticated, async (_req, res): Promise<void> => 
{

  const account = await getGitHubIdentity()
;

  res.json(GetGitHubConnectionStatusResponse.parse(
{
 connected: true, account 
}
))
;

}
)
;


router.get("/press/github/repositories/:page", authenticated, async (req, res): Promise<void> => 
{

  const parsed = ListGitHubRepositoriesParams.safeParse(req.params)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid repository page." 
}
)
;
 return
;
 
}

  res.json(ListGitHubRepositoriesResponse.parse(await listGitHubRepositories(parsed.data.page)))
;

}
)
;


async function verifyImportedAssets(
  issue: ReturnType<typeof GetIssueResponse.parse>,
  userId: string,
): Promise<string[]> 
{

  const blockers: string[] = []
;

  await Promise.all(issue.assets.map(async asset => 
{

    if (!asset.objectPath.startsWith("/objects/") || asset.objectPath.includes("..")) 
{

      blockers.push(`Asset “${asset.name}” has an unsafe object path.`)
;

      return
;

    
}

    try 
{

      const file = await storage.getObjectEntityFile(asset.objectPath)
;

      const policy = await storage.ensureWorkingObjectAclPolicy(asset.objectPath, file);
      if (
        !policy ||
        !(await storage.canAccessObjectEntity({
          userId,
          objectFile: file,
          requestedPermission: ObjectPermission.READ,
        }))
      ) {
        blockers.push(`You are not allowed to import asset “${asset.name}”.`);
        return;
      }

      await file.getMetadata()
;

    
}
 catch 
{

      blockers.push(`Asset “${asset.name}” is not available in this workspace's file storage.`)
;

    
}

  
}
))
;

  return blockers
;

}


async function makeGitHubPreview(
  selection: GitHubSelection,
  mode: "pull" | "push" | "source_load",
  userId: string,
) 
{

  const current = await getIssue()
;

  ensureGitHubPreviewRevision(current.revision, selection.revision)
;

  validateGitHubSelection(selection)
;

  const snapshot = await getGitHubIssueSnapshot(selection)
;

  const blockers: string[] = []
;

  if (mode !== "push") 
{

    if (!snapshot.fileExists) blockers.push("The selected GitHub path does not contain an issue file.")
;

    else if (!snapshot.remoteIssue) blockers.push(snapshot.remoteIssueError || "The selected GitHub file is not a valid issue.")
;

  
}

  if (mode === "pull" && snapshot.remoteIssue) 
{

    blockers.push(...await verifyImportedAssets(snapshot.remoteIssue, userId))
;

  
}

  if (mode === "source_load" && snapshot.remoteIssue) 
{

    const cover = snapshot.remoteIssue.pages.find(page => page.number === 1)
;

    if (!cover || !cover.copy.trim() || /SAMPLE DRAFT|NOT REPOSITORY COPY|placeholder|source is missing/i.test(cover.copy)) 
{

      blockers.push("The selected GitHub issue has no usable Page 1 source; nothing can be loaded.")
;

    
}

  
}

  return {

    mode,
    owner: selection.owner,
    repo: selection.repo,
    branch: selection.branch,
    path: selection.path,
    localRevision: current.revision,
    headSha: snapshot.headSha,
    fileExists: snapshot.fileExists,
    blobSha: snapshot.blobSha,
    remoteIssue: snapshot.remoteIssue,
    remoteIssueError: snapshot.remoteIssueError,
    pullBlockers: blockers,
    pushAccess: snapshot.pushAccess,
    pageOneDiffers: snapshot.remoteIssue
      ? JSON.stringify(snapshot.remoteIssue.pages.find(page => page.number === 1)) !== JSON.stringify(current.pages.find(page => page.number === 1))
      : true,
  
}
;

}


router.post("/press/github/pull/preview", authenticated, async (req, res): Promise<void> => 
{

  const parsed = PreviewGitHubPullBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid GitHub pull selection.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  res.json(PreviewGitHubPullResponse.parse(await makeGitHubPreview(parsed.data, "pull", req.user!.id)))
;

}
)
;


router.post("/press/github/pull/apply", authenticated, async (req, res): Promise<void> => 
{

  const parsed = ApplyGitHubPullBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid GitHub pull confirmation.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  const confirmation = parsed.data
;

  if (!confirmation.confirmed) 
{
 res.status(400).json(
{
 error: "Review and explicitly confirm the pull first." 
}
)
;
 return
;
 
}

  const selection: GitHubSelection = confirmation
;

  validateGitHubSelection(selection)
;

  const snapshot = await getGitHubIssueSnapshot(selection)
;

  checkGitHubPreviewVersion(snapshot, confirmation.expectedHeadSha, confirmation.expectedBlobSha)
;

  if (!snapshot.remoteIssue) 
{
 res.status(400).json(
{
 error: snapshot.remoteIssueError || "The selected file is not a valid issue." 
}
)
;
 return
;
 
}

  const blockers = await verifyImportedAssets(snapshot.remoteIssue, req.user!.id)
;

  if (blockers.length) 
{
 res.status(400).json(
{
 error: "The GitHub issue references unavailable files. Nothing was imported.", details: blockers 
}
)
;
 return
;
 
}

  const issue = await mutateIssue(
    confirmation.revision,
    `GitHub pull ${confirmation.owner}/${confirmation.repo}:${confirmation.path}@${confirmation.expectedHeadSha.slice(0, 12)} — Page 1 preserved`,
    req.user!.id,
    current => safeImport(current, snapshot.remoteIssue!),
  )
;

  res.json(ApplyGitHubPullResponse.parse(issue))
;

}
)
;


router.post("/press/github/push/preview", authenticated, async (req, res): Promise<void> => 
{

  const parsed = PreviewGitHubPushBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid GitHub push selection.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  res.json(PreviewGitHubPushResponse.parse(await makeGitHubPreview(parsed.data, "push", req.user!.id)))
;

}
)
;


router.post("/press/github/push/apply", authenticated, async (req, res): Promise<void> => 
{

  const parsed = ApplyGitHubPushBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid GitHub push confirmation.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  const confirmation = parsed.data
;

  if (!confirmation.confirmed) 
{
 res.status(400).json(
{
 error: "Review and explicitly confirm the GitHub push first." 
}
)
;
 return
;
 
}

  if (!confirmation.message.trim()) 
{
 res.status(400).json(
{
 error: "A commit message is required." 
}
)
;
 return
;
 
}

  const selection: GitHubSelection = confirmation
;

  validateGitHubSelection(selection)
;

  const result = await withIssueRevisionLock(confirmation.revision, async current => 
{

    const snapshot = await getGitHubIssueSnapshot(selection)
;

    checkGitHubPreviewVersion(snapshot, confirmation.expectedHeadSha, confirmation.expectedBlobSha)
;

    if (!snapshot.fileExists || !snapshot.remoteIssue || !snapshot.blobSha) 
{

      throw new PressError("Push requires an existing valid GitHub issue file so its authoritative Page 1 can be preserved.", 400)
;

    
}

    if (!snapshot.pushAccess) throw new PressError("The connected GitHub account does not have push access to this repository.", 403)
;

    const outgoing = preserveGitHubPageOneForPush(current, snapshot.remoteIssue)
;

    const commitSha = await createGitHubIssueCommit(selection, snapshot.headSha, outgoing, confirmation.message.trim())
;

    return {

      owner: confirmation.owner,
      repo: confirmation.repo,
      branch: confirmation.branch,
      path: confirmation.path,
      revision: current.revision,
      commitSha,
      htmlUrl: `https://github.com/${confirmation.owner}/${confirmation.repo}/commit/${commitSha}`,
    
}
;

  
}
)
;

  res.json(ApplyGitHubPushResponse.parse(result))
;

}
)
;


router.post("/press/github/source-load/preview", authenticated, async (req, res): Promise<void> => 
{

  const parsed = PreviewGitHubPageOneSourceBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid Page 1 source selection.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  res.json(PreviewGitHubPageOneSourceResponse.parse(await makeGitHubPreview(parsed.data, "source_load", req.user!.id)))
;

}
)
;


router.post("/press/github/source-load/apply", authenticated, async (req, res): Promise<void> => 
{

  const parsed = ApplyGitHubPageOneSourceBody.safeParse(req.body)
;

  if (!parsed.success) 
{
 res.status(400).json(
{
 error: "Invalid Page 1 source confirmation.", details: parsed.error.flatten() 
}
)
;
 return
;
 
}

  const confirmation = parsed.data
;

  ensureGitHubSourceLoadConfirmed(confirmation.sourceLoadConfirmed)
;

  const selection: GitHubSelection = confirmation
;

  validateGitHubSelection(selection)
;

  const snapshot = await getGitHubIssueSnapshot(selection)
;

  checkGitHubPreviewVersion(snapshot, confirmation.expectedHeadSha, confirmation.expectedBlobSha)
;

  const cover = snapshot.remoteIssue?.pages.find(page => page.number === 1)
;

  if (!cover || !cover.copy.trim() || /SAMPLE DRAFT|NOT REPOSITORY COPY|placeholder|source is missing/i.test(cover.copy)) 
{

    res.status(400).json(
{
 error: "The selected GitHub issue has no usable Page 1 source. Nothing was changed." 
}
)
;
 return
;

  
}

  const issue = await mutateIssue(
    confirmation.revision,
    `Separately authorized Page 1 source load from ${confirmation.owner}/${confirmation.repo}:${confirmation.path}@${confirmation.expectedHeadSha.slice(0, 12)}`,
    req.user!.id,
    current => applyGitHubPageOneSource(
      current,
      cover,
      `${confirmation.owner}/${confirmation.repo}:${confirmation.path}@${snapshot.headSha}`,
      req.user!.id,
    ),
  )
;

  res.json(ApplyGitHubPageOneSourceResponse.parse(issue))
;

}
)
;

router.post("/press/github/media/preview", authenticated, async (req, res): Promise<void> => {
  const parsed = PreviewGitHubMediaTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid GitHub media transfer selection.", details: parsed.error.flatten() });
    return;
  }
  const current = await getIssue();
  const work = await buildGitHubMediaTransferPreview(parsed.data, current, storage);
  res.json(PreviewGitHubMediaTransferResponse.parse(work.preview));
});

router.get("/press/github/media/replacements", authenticated, async (req, res): Promise<void> => {
  const accountId = req.user!.id;
  if (!hasNewsroomAdminRole(accountId) && !(await isMyrtleEditorAssigned(accountId))) {
    res.status(403).json({ error: "Only newsroom editors and administrators can review media replacement records." });
    return;
  }
  res.json(ListGitHubMediaReplacementAuditsResponse.parse({
    replacements: await listGitHubMediaReplacementAudits(),
  }));
});

router.get("/press/github/media/restores", authenticated, async (req, res): Promise<void> => {
  const accountId = req.user!.id;
  if (!hasNewsroomAdminRole(accountId) && !(await isMyrtleEditorAssigned(accountId))) {
    res.status(403).json({ error: "Only newsroom editors and administrators can review media restore records." });
    return;
  }
  res.json(ListGitHubMediaRestoresResponse.parse({
    restores: await listGitHubMediaRestores(),
  }));
});

router.post("/press/github/media/apply", authenticated, async (req, res): Promise<void> => {
  const parsed = ApplyGitHubMediaTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid GitHub media transfer confirmation.", details: parsed.error.flatten() });
    return;
  }
  const confirmation = parsed.data;
  if (!confirmation.confirmed) {
    res.status(400).json({ error: "Review and explicitly authorize the media transfer first." });
    return;
  }

  const selection = {
    owner: confirmation.owner,
    repo: confirmation.repo,
    branch: confirmation.branch,
    path: confirmation.path,
    revision: confirmation.revision,
    direction: confirmation.direction,
  };
  const current = await getIssue();
  let work = await buildGitHubMediaTransferPreview(selection, current, storage);
  if (work.preview.headSha !== confirmation.expectedHeadSha ||
      !mediaFingerprintsMatch(confirmation.expectedFiles, work.preview.files)) {
    throw new PressError("The GitHub branch, issue file, or media files changed after preview. Nothing was transferred; create a fresh preview.", 409);
  }
  if (work.preview.blockers.length > 0) {
    res.status(400).json({ error: "The media transfer is blocked. Nothing was transferred.", details: work.preview.blockers });
    return;
  }

  if (confirmation.direction === "from_repository" && confirmation.replaceRemoteConflicts) {
    res.status(400).json({ error: "Repository media restore does not overwrite existing private-storage files." });
    return;
  }

  const initialFileSelection = resolveMediaFileSelection(
    work.preview.files,
    confirmation.selectedAssetIds,
    confirmation.direction,
    confirmation.replaceRemoteConflicts,
  );
  if (!initialFileSelection.ok) {
    res.status(400).json({ error: initialFileSelection.error });
    return;
  }
  const recordRestoreOutcome = async (
    file: typeof initialFileSelection.selectedFiles[number],
    outcome: "completed" | "failed",
    failureReason: string | null = null,
  ) => recordGitHubMediaRestore({
    accountId: req.user!.id,
    owner: confirmation.owner,
    repo: confirmation.repo,
    branch: confirmation.branch,
    issuePath: confirmation.path,
    assetId: file.assetId,
    fileName: file.assetName,
    filePath: file.path,
    outcome,
    failureReason,
  });

  // Only load the bytes the editor selected, after the server has validated
  // the selection count, combined size, per-file status, and conflict consent.
  try {
    work = await buildGitHubMediaTransferPreview(
      selection,
      current,
      storage,
      new Set(confirmation.selectedAssetIds),
    );
  } catch (error) {
    if (!(error instanceof GitHubMediaDownloadError)) throw error;

    const latestIssue = await getIssue();
    if (latestIssue.revision !== confirmation.revision) {
      throw new PressError("The local issue changed during media review. Nothing was transferred; create a fresh preview.", 409);
    }
    const latestPreview = await buildGitHubMediaTransferPreview(selection, latestIssue, storage);
    if (latestPreview.preview.headSha !== confirmation.expectedHeadSha ||
        !mediaFingerprintsMatch(confirmation.expectedFiles, latestPreview.preview.files)) {
      throw new PressError("The GitHub branch, issue file, or media files changed after preview. Nothing was transferred; create a fresh preview.", 409);
    }

    for (const file of initialFileSelection.selectedFiles) {
      const failureReason = file.path === error.path
        ? error.reason
        : `This file was not saved because another selected GitHub file could not be downloaded (${error.assetName}). Nothing was written.`;
      await recordRestoreOutcome(file, "failed", failureReason);
    }
    res.status(error.rateLimited ? 429 : 502).json({
      code: error.rateLimited ? GITHUB_MEDIA_RATE_LIMITED_CODE : GITHUB_MEDIA_DOWNLOAD_FAILED_CODE,
      fileName: error.assetName,
      path: error.path,
      reason: error.reason,
      ...(error.rateLimited && error.retryAfterSeconds !== null
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
      error: `Cannot restore “${error.assetName}” (${error.path}): ${error.reason} Nothing was written.`,
    });
    return;
  }
  const latestIssue = await getIssue();
  if (latestIssue.revision !== confirmation.revision) {
    throw new PressError("The local issue changed during media review. Nothing was transferred; create a fresh preview.", 409);
  }
  const selectedAssetIds = new Set(confirmation.selectedAssetIds);
  const typeMismatchFiles = work.preview.files.filter(file =>
    selectedAssetIds.has(file.assetId) &&
    file.status === "invalid_record" &&
    file.message === GITHUB_MEDIA_TYPE_MISMATCH_MESSAGE,
  );
  if (typeMismatchFiles.length > 0 && work.preview.headSha === confirmation.expectedHeadSha) {
    const mismatchedIds = new Set(typeMismatchFiles.map(file => file.assetId));
    const originalPreviewStatuses = work.preview.files.map(file => {
      if (!mismatchedIds.has(file.assetId)) return file;
      const expected = confirmation.expectedFiles.find(item =>
        item.assetId === file.assetId && item.path === file.path,
      );
      return expected && (expected.status === "ready" || expected.status === "already_current")
        ? { ...file, status: expected.status }
        : file;
    });
    if (mediaFingerprintsMatch(confirmation.expectedFiles, originalPreviewStatuses)) {
      const mismatchedAssetIds = new Set(typeMismatchFiles.map(file => file.assetId));
      for (const selectedFile of initialFileSelection.selectedFiles) {
        const failureReason = mismatchedAssetIds.has(selectedFile.assetId)
          ? GITHUB_MEDIA_TYPE_MISMATCH_MESSAGE
          : "This file was not saved because another selected GitHub file did not match its declared type. Nothing was written.";
        await recordRestoreOutcome(selectedFile, "failed", failureReason);
      }
      const file = typeMismatchFiles[0];
      res.status(422).json({
        code: "GITHUB_MEDIA_TYPE_MISMATCH",
        error: `Cannot restore “${file.assetName}”: downloaded GitHub bytes do not match the asset’s declared type (${file.contentType}). Nothing was written.`,
      });
      return;
    }
  }
  if (work.preview.headSha !== confirmation.expectedHeadSha ||
      !mediaFingerprintsMatch(confirmation.expectedFiles, work.preview.files)) {
    throw new PressError("The GitHub branch, issue file, or media files changed after preview. Nothing was transferred; create a fresh preview.", 409);
  }
  if (work.preview.blockers.length > 0) {
    res.status(400).json({ error: "The media transfer is blocked. Nothing was transferred.", details: work.preview.blockers });
    return;
  }
  const fileSelection = resolveMediaFileSelection(
    work.preview.files,
    confirmation.selectedAssetIds,
    confirmation.direction,
    confirmation.replaceRemoteConflicts,
  );
  if (!fileSelection.ok) {
    res.status(400).json({ error: fileSelection.error });
    return;
  }

  let commitSha: string | null = null;
  let filesTransferred = 0;
  const filesAlreadyCurrent = fileSelection.selectedFiles.filter(file => file.status === "already_current").length;
  if (confirmation.direction === "to_repository") {
    const toCommit = fileSelection.selectedFiles.filter(file =>
      file.status === "ready" || file.status === "remote_conflict",
    );
    if (toCommit.length > 0) {
      const replacements = toCommit.filter(file => file.status === "remote_conflict");
      const commitFiles = toCommit.map(file => {
        const bytes = work.bytesByAssetId.get(file.assetId);
        if (!bytes) throw new PressError(`Private-storage bytes for “${file.assetName}” disappeared after preview.`, 409);
        return { path: file.path, bytes };
      });
      commitSha = await createGitHubMediaCommit(
        selection,
        work.preview.headSha,
        commitFiles,
        `Back up issue media for ${confirmation.path}`,
      );
      filesTransferred = commitFiles.length;
      if (replacements.length > 0) {
        await recordGitHubMediaReplacement({
          accountId: req.user!.id,
          owner: confirmation.owner,
          repo: confirmation.repo,
          branch: confirmation.branch,
          issuePath: confirmation.path,
          files: replacements.map(file => ({
            assetId: file.assetId,
            path: file.path,
            priorRemoteFingerprint: {
              remoteSha256: file.remoteSha256,
              remoteBlobSha: file.remoteBlobSha,
            },
          })),
          commitSha,
        });
      }
    }
  } else {
    const toRestore = fileSelection.selectedFiles.filter(file => file.status === "ready");
    for (const file of toRestore) {
      const bytes = work.bytesByAssetId.get(file.assetId);
      const objectPath = work.objectPathByAssetId.get(file.assetId);
      if (!bytes || !objectPath) {
        await recordRestoreOutcome(file, "failed", "GitHub bytes or the private-storage destination were unavailable after preview.");
        throw new PressError(`Repository bytes or the private-storage path for “${file.assetName}” disappeared after preview.`, 409);
      }
      try {
        await storage.saveObjectEntityAtPath(objectPath, bytes, file.contentType);
      } catch (error) {
        const privateStorageConflict = typeof error === "object" && error !== null && "code" in error &&
          (error.code === 409 || error.code === 412);
        const failureReason = privateStorageConflict
          ? "A private-storage file already exists; restore does not overwrite existing files."
          : "Private storage could not save this file.";
        await recordRestoreOutcome(file, "failed", failureReason);
        if (privateStorageConflict) {
          throw new PressError(`Private storage changed for “${file.assetName}”; the existing file was not overwritten. Preview the transfer again.`, 409);
        }
        throw error;
      }
      await recordRestoreOutcome(file, "completed");
      filesTransferred++;
    }
  }

  res.json(ApplyGitHubMediaTransferResponse.parse({
    direction: confirmation.direction,
    owner: confirmation.owner,
    repo: confirmation.repo,
    branch: confirmation.branch,
    issuePath: confirmation.path,
    filesTransferred,
    filesAlreadyCurrent,
    skippedFiles: fileSelection.skippedFiles,
    commitSha,
    htmlUrl: commitSha ? `https://github.com/${confirmation.owner}/${confirmation.repo}/commit/${commitSha}` : null,
  }));
});


router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => 
{

  if (err instanceof PressError) 
{
 res.status(err.status).json(
{
 error: err.message 
}
)
;
 return
;
 
}

  next(err)
;

}
)
;

export default router
;
