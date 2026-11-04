import { ReplitConnectors } from "@replit/connectors-sdk";
import { GetIssueResponse } from "@workspace/api-zod";
import { PressError, type Issue } from "./press-workflow";

const API_VERSION = "2022-11-28";
const SHA_PATTERN = /^[a-f0-9]{40,64}$/i;

export type GitHubSelection = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  revision: number;
};

export type GitHubIssueSnapshot = {
  headSha: string;
  fileExists: boolean;
  blobSha: string | null;
  remoteIssue: Issue | null;
  remoteIssueError: string | null;
  pushAccess: boolean;
};

export class GitHubRateLimitError extends PressError {
  constructor(readonly retryAfterSeconds: number | null) {
    super("GitHub rate-limited the media download.", 429);
    this.name = "GitHubRateLimitError";
  }
}

function parseRetryAfterSeconds(value: string | null, now: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function parseRateLimitResetSeconds(value: string | null, now: number): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const resetAt = Number(value.trim());
  if (!Number.isSafeInteger(resetAt)) return null;
  const seconds = Math.max(0, Math.ceil(resetAt - now / 1000));
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function getGitHubRateLimitDetails(
  response: Pick<Response, "status" | "headers">,
  message: string | null,
  now = Date.now(),
): { retryAfterSeconds: number | null } | null {
  const isRateLimited = response.status === 429 ||
    (response.status === 403 && (
      response.headers.get("X-RateLimit-Remaining")?.trim() === "0" ||
      response.headers.has("Retry-After") ||
      /rate limit/i.test(message ?? "")
    ));
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("Retry-After"), now) ??
    (isRateLimited
      ? parseRateLimitResetSeconds(response.headers.get("X-RateLimit-Reset"), now)
      : null);
  return isRateLimited ? { retryAfterSeconds } : null;
}

type GitHubCommitClient = {
  json<T>(path: string, method?: "GET" | "POST" | "PATCH", body?: unknown): Promise<T>;
  response(path: string, method?: "GET" | "POST" | "PATCH", body?: unknown): Promise<Response>;
};
type GitHubRepositoryRecord = {
  id: number;
  name: string;
  full_name: string;
  owner?: { login?: string };
  default_branch?: string;
  private?: boolean;
  permissions?: { push?: boolean };
  html_url?: string;
};

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function encodeBranch(branch: string): string {
  return branch.split("/").map(encodeURIComponent).join("/");
}

export function validateGitHubSelection(selection: GitHubSelection): void {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(selection.owner)) {
    throw new PressError("Choose a valid GitHub account or organization.", 400);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(selection.repo) || selection.repo === "." || selection.repo === "..") {
    throw new PressError("Choose a valid GitHub repository.", 400);
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(selection.branch) ||
      selection.branch.startsWith("/") ||
      selection.branch.endsWith("/") ||
      selection.branch.includes("//") ||
      selection.branch.split("/").some(segment => segment === "." || segment === "..")) {
    throw new PressError("Choose a valid GitHub branch name.", 400);
  }
  if (!selection.path.toLowerCase().endsWith(".json") ||
      selection.path.startsWith("/") ||
      selection.path.includes("\\") ||
      /[\u0000-\u001f]/.test(selection.path) ||
      selection.path.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new PressError("Choose a repository .json file path without empty or traversal segments.", 400);
  }
}

async function githubResponse(
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
  accept = "application/vnd.github+json",
): Promise<Response> {
  try {
    const connectors = new ReplitConnectors();
    return await connectors.proxy("github", path, {
      method,
      headers: {
        Accept: accept,
        "X-GitHub-Api-Version": API_VERSION,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new PressError("The Replit GitHub connection could not be reached. Check its connection and permissions.", 503);
  }
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = await response.json() as { message?: unknown };
    return typeof payload.message === "string" ? payload.message : null;
  } catch {
    return null;
  }
}

async function githubJson<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
): Promise<T> {
  const response = await githubResponse(path, method, body);
  if (!response.ok) {
    const message = await readErrorMessage(response);
    const status = response.status === 422 ? 409 : response.status;
    const explanation = response.status === 403 || response.status === 404
      ? "Confirm that the connected account can access this repository and branch."
      : message;
    throw new PressError(
      `GitHub request failed (HTTP ${response.status}).${explanation ? ` ${explanation}` : ""}`,
      status,
    );
  }
  try {
    return await response.json() as T;
  } catch {
    throw new PressError("GitHub returned an unreadable response.", 502);
  }
}

export async function getGitHubIdentity(): Promise<{ login: string; name: string | null }> {
  const user = await githubJson<{ login?: unknown; name?: unknown }>("/user");
  if (typeof user.login !== "string" || !user.login) {
    throw new PressError("GitHub did not return an authenticated account.", 502);
  }
  return { login: user.login, name: typeof user.name === "string" ? user.name : null };
}

export async function listGitHubRepositories(page: number) {
  const response = await githubResponse(
    `/user/repos?sort=pushed&per_page=50&page=${page}&affiliation=owner%2Ccollaborator%2Corganization_member`,
  );
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new PressError(`Could not list GitHub repositories (HTTP ${response.status}).${message ? ` ${message}` : ""}`, response.status);
  }
  const records = await response.json() as unknown;
  if (!Array.isArray(records)) throw new PressError("GitHub returned an invalid repository list.", 502);
  const repositories = records.map((value: GitHubRepositoryRecord) => {
    if (!value || typeof value.id !== "number" || typeof value.name !== "string" ||
        typeof value.full_name !== "string" || typeof value.owner?.login !== "string" ||
        typeof value.default_branch !== "string" || typeof value.html_url !== "string") {
      throw new PressError("GitHub returned an incomplete repository record.", 502);
    }
    return {
      id: value.id,
      name: value.name,
      fullName: value.full_name,
      owner: value.owner.login,
      defaultBranch: value.default_branch,
      private: Boolean(value.private),
      pushAccess: Boolean(value.permissions?.push),
      htmlUrl: value.html_url,
    };
  });
  return {
    repositories,
    page,
    hasNextPage: /rel="next"/.test(response.headers.get("Link") ?? ""),
  };
}

export async function getGitHubIssueSnapshot(selection: GitHubSelection): Promise<GitHubIssueSnapshot> {
  validateGitHubSelection(selection);
  const repositoryPath = `/repos/${encodeURIComponent(selection.owner)}/${encodeURIComponent(selection.repo)}`;
  const repository = await githubJson<GitHubRepositoryRecord>(repositoryPath);
  const pushAccess = Boolean(repository.permissions?.push);
  const reference = await githubJson<{ object?: { sha?: unknown } }>(
    `${repositoryPath}/git/ref/heads/${encodeBranch(selection.branch)}`,
  );
  const headSha = reference.object?.sha;
  if (typeof headSha !== "string" || !SHA_PATTERN.test(headSha)) {
    throw new PressError("GitHub did not return a valid branch commit.", 502);
  }

  const response = await githubResponse(
    `${repositoryPath}/contents/${encodePath(selection.path)}?ref=${encodeURIComponent(headSha)}`,
  );
  if (response.status === 404) {
    return {
      headSha,
      fileExists: false,
      blobSha: null,
      remoteIssue: null,
      remoteIssueError: "No file exists at this path in the selected GitHub commit.",
      pushAccess,
    };
  }
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new PressError(
      `Could not read the selected GitHub file (HTTP ${response.status}).${message ? ` ${message}` : ""}`,
      response.status,
    );
  }

  const file = await response.json() as {
    type?: unknown;
    sha?: unknown;
    size?: unknown;
    encoding?: unknown;
    content?: unknown;
  };
  if (file.type !== "file" || typeof file.sha !== "string" || !SHA_PATTERN.test(file.sha)) {
    return {
      headSha,
      fileExists: true,
      blobSha: null,
      remoteIssue: null,
      remoteIssueError: "The selected path is not a regular GitHub file.",
      pushAccess,
    };
  }
  if (typeof file.size !== "number" || file.size > 1_000_000 ||
      typeof file.content !== "string" || file.encoding !== "base64") {
    return {
      headSha,
      fileExists: true,
      blobSha: file.sha,
      remoteIssue: null,
      remoteIssueError: "The selected file is too large or cannot be decoded for a safe preview.",
      pushAccess,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    return {
      headSha,
      fileExists: true,
      blobSha: file.sha,
      remoteIssue: null,
      remoteIssueError: "The selected file is not valid JSON.",
      pushAccess,
    };
  }
  const issueResult = GetIssueResponse.safeParse(parsed);
  return {
    headSha,
    fileExists: true,
    blobSha: file.sha,
    remoteIssue: issueResult.success ? issueResult.data : null,
    remoteIssueError: issueResult.success ? null : "The selected JSON does not match the issue format.",
    pushAccess,
  };
}

export function checkGitHubPreviewVersion(
  snapshot: Pick<GitHubIssueSnapshot, "headSha" | "blobSha">,
  expectedHeadSha: string,
  expectedBlobSha: string | null,
): void {
  if (snapshot.headSha !== expectedHeadSha || snapshot.blobSha !== expectedBlobSha) {
    throw new PressError("The GitHub branch or file changed after preview. Nothing was applied; create a fresh preview.", 409);
  }
}

export type GitHubBranchState = {
  headSha: string;
  pushAccess: boolean;
  private: boolean;
};

export type GitHubRepositoryFile = {
  exists: boolean;
  regularFile: boolean;
  directory: boolean;
  sha: string | null;
  size: number | null;
};

export async function getGitHubBranchState(selection: GitHubSelection): Promise<GitHubBranchState> {
  validateGitHubSelection(selection);
  const repositoryPath = `/repos/${encodeURIComponent(selection.owner)}/${encodeURIComponent(selection.repo)}`;
  const repository = await githubJson<GitHubRepositoryRecord>(repositoryPath);
  const reference = await githubJson<{ object?: { sha?: unknown } }>(
    `${repositoryPath}/git/ref/heads/${encodeBranch(selection.branch)}`,
  );
  const headSha = reference.object?.sha;
  if (typeof headSha !== "string" || !SHA_PATTERN.test(headSha)) {
    throw new PressError("GitHub did not return a valid branch commit.", 502);
  }
  return {
    headSha,
    pushAccess: Boolean(repository.permissions?.push),
    private: Boolean(repository.private),
  };
}

export async function getGitHubRepositoryFile(
  selection: GitHubSelection,
  path: string,
  headSha: string,
): Promise<GitHubRepositoryFile> {
  const repositoryPath = `/repos/${encodeURIComponent(selection.owner)}/${encodeURIComponent(selection.repo)}`;
  const response = await githubResponse(
    `${repositoryPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(headSha)}`,
  );
  if (response.status === 404) return { exists: false, regularFile: false, directory: false, sha: null, size: null };
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new PressError(
      `Could not inspect repository media file (HTTP ${response.status}).${message ? ` ${message}` : ""}`,
      response.status,
    );
  }
  const payload = await response.json() as unknown;
  if (Array.isArray(payload)) {
    return { exists: true, regularFile: false, directory: true, sha: null, size: null };
  }
  const file = payload as { type?: unknown; sha?: unknown; size?: unknown };
  if (file.type === "dir") {
    return { exists: true, regularFile: false, directory: true, sha: null, size: null };
  }
  if (file.type !== "file") return { exists: true, regularFile: false, directory: false, sha: null, size: null };
  if (typeof file.sha !== "string" || !SHA_PATTERN.test(file.sha) ||
      typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0) {
    throw new PressError("GitHub returned incomplete media file metadata.", 502);
  }
  return { exists: true, regularFile: true, directory: false, sha: file.sha, size: file.size };
}

export async function downloadGitHubBlob(
  selection: GitHubSelection,
  blobSha: string,
): Promise<Buffer> {
  if (!SHA_PATTERN.test(blobSha)) throw new PressError("GitHub returned an invalid media file fingerprint.", 502);
  const repositoryPath = `/repos/${encodeURIComponent(selection.owner)}/${encodeURIComponent(selection.repo)}`;
  const response = await githubResponse(
    `${repositoryPath}/git/blobs/${encodeURIComponent(blobSha)}`,
    "GET",
    undefined,
    "application/vnd.github.raw+json",
  );
  if (!response.ok) {
    const message = await readErrorMessage(response);
    const rateLimit = getGitHubRateLimitDetails(response, message);
    if (rateLimit) throw new GitHubRateLimitError(rateLimit.retryAfterSeconds);
    throw new PressError(
      `Could not download repository media file (HTTP ${response.status}).${message ? ` ${message}` : ""}`,
      response.status,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    try {
      const blob = JSON.parse(bytes.toString("utf8")) as { content?: unknown; encoding?: unknown };
      if (blob.encoding === "base64" && typeof blob.content === "string") {
        return Buffer.from(blob.content.replace(/\s/g, ""), "base64");
      }
    } catch {
      // The raw response is still returned below; its declared size is verified by the caller.
    }
  }
  return bytes;
}

export async function createGitHubMediaCommit(
  selection: GitHubSelection,
  expectedHeadSha: string,
  files: Array<{ path: string; bytes: Buffer }>,
  message: string,
): Promise<string> {
  if (files.length === 0) throw new PressError("There are no media files to commit.", 400);
  const repositoryPath = `/repos/${encodeURIComponent(selection.owner)}/${encodeURIComponent(selection.repo)}`;
  const treeEntries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
  for (const file of files) {
    const blob = await githubJson<{ sha?: unknown }>(`${repositoryPath}/git/blobs`, "POST", {
      content: file.bytes.toString("base64"),
      encoding: "base64",
    });
    if (typeof blob.sha !== "string" || !SHA_PATTERN.test(blob.sha)) {
      throw new PressError("GitHub did not create a valid media file blob.", 502);
    }
    treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const parent = await githubJson<{ tree?: { sha?: unknown } }>(
    `${repositoryPath}/git/commits/${encodeURIComponent(expectedHeadSha)}`,
  );
  const baseTree = parent.tree?.sha;
  if (typeof baseTree !== "string" || !SHA_PATTERN.test(baseTree)) {
    throw new PressError("GitHub did not return the selected commit tree.", 502);
  }
  const tree = await githubJson<{ sha?: unknown }>(`${repositoryPath}/git/trees`, "POST", {
    base_tree: baseTree,
    tree: treeEntries,
  });
  if (typeof tree.sha !== "string" || !SHA_PATTERN.test(tree.sha)) {
    throw new PressError("GitHub did not create a valid media tree.", 502);
  }
  const commit = await githubJson<{ sha?: unknown }>(`${repositoryPath}/git/commits`, "POST", {
    message,
    tree: tree.sha,
    parents: [expectedHeadSha],
  });
  if (typeof commit.sha !== "string" || !SHA_PATTERN.test(commit.sha)) {
    throw new PressError("GitHub did not create a valid media commit.", 502);
  }
  const response = await githubResponse(
    `${repositoryPath}/git/refs/heads/${encodeBranch(selection.branch)}`,
    "PATCH",
    { sha: commit.sha, force: false },
  );
  if (!response.ok) {
    const messageFromGitHub = await readErrorMessage(response);
    if (response.status === 409 || response.status === 422) {
      throw new PressError("The GitHub branch moved after preview. No branch update was applied; create a fresh preview.", 409);
    }
    throw new PressError(
      `GitHub could not update the selected branch (HTTP ${response.status}).${messageFromGitHub ? ` ${messageFromGitHub}` : ""}`,
      response.status,
    );
  }
  return commit.sha;
}

export async function createGitHubIssueCommit(
  selection: GitHubSelection,
  expectedHeadSha: string,
  issue: Issue,
  message: string,
): Promise<string> {
  return createGitHubIssueCommitWithClient(selection, expectedHeadSha, issue, message, {
    json: githubJson,
    response: githubResponse,
  });
}

export async function createGitHubIssueCommitWithClient(
  selection: GitHubSelection,
  expectedHeadSha: string,
  issue: Issue,
  message: string,
  client: GitHubCommitClient,
): Promise<string> {
  const repositoryPath = `/repos/${encodeURIComponent(selection.owner)}/${encodeURIComponent(selection.repo)}`;
  const content = Buffer.from(JSON.stringify(issue, null, 2), "utf8").toString("base64");
  const blob = await client.json<{ sha?: unknown }>(`${repositoryPath}/git/blobs`, "POST", {
    content,
    encoding: "base64",
  });
  if (typeof blob.sha !== "string" || !SHA_PATTERN.test(blob.sha)) {
    throw new PressError("GitHub did not create a valid file blob.", 502);
  }

  const parent = await client.json<{ tree?: { sha?: unknown } }>(
    `${repositoryPath}/git/commits/${encodeURIComponent(expectedHeadSha)}`,
  );
  const baseTree = parent.tree?.sha;
  if (typeof baseTree !== "string" || !SHA_PATTERN.test(baseTree)) {
    throw new PressError("GitHub did not return the selected commit tree.", 502);
  }

  const tree = await client.json<{ sha?: unknown }>(`${repositoryPath}/git/trees`, "POST", {
    base_tree: baseTree,
    tree: [{ path: selection.path, mode: "100644", type: "blob", sha: blob.sha }],
  });
  if (typeof tree.sha !== "string" || !SHA_PATTERN.test(tree.sha)) {
    throw new PressError("GitHub did not create a valid issue tree.", 502);
  }

  const commit = await client.json<{ sha?: unknown }>(`${repositoryPath}/git/commits`, "POST", {
    message,
    tree: tree.sha,
    parents: [expectedHeadSha],
  });
  if (typeof commit.sha !== "string" || !SHA_PATTERN.test(commit.sha)) {
    throw new PressError("GitHub did not create a valid issue commit.", 502);
  }

  const refPath = `${repositoryPath}/git/refs/heads/${encodeBranch(selection.branch)}`;
  const response = await client.response(refPath, "PATCH", { sha: commit.sha, force: false });
  if (!response.ok) {
    const messageFromGitHub = await readErrorMessage(response);
    if (response.status === 409 || response.status === 422) {
      throw new PressError("The GitHub branch moved after preview. No branch update was applied; create a fresh preview.", 409);
    }
    throw new PressError(
      `GitHub could not update the selected branch (HTTP ${response.status}).${messageFromGitHub ? ` ${messageFromGitHub}` : ""}`,
      response.status,
    );
  }
  return commit.sha;
}
