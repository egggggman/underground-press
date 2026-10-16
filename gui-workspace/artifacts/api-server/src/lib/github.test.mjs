import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const entry = `
  import { checkGitHubPreviewVersion, createGitHubIssueCommitWithClient, getGitHubRateLimitDetails } from "./github.ts";
  import { PressError } from "./press-workflow.ts";
  export { checkGitHubPreviewVersion, createGitHubIssueCommitWithClient, getGitHubRateLimitDetails, PressError };
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: sourceDir, sourcefile: "github-test-entry.ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  external: ["node:*"],
  plugins: [{
    name: "stub-replit-connectors",
    setup(build) {
      build.onResolve({ filter: /^@replit\/connectors-sdk$/ }, () => ({
        path: "connectors-sdk",
        namespace: "github-test",
      }));
      build.onLoad({ filter: /.*/, namespace: "github-test" }, () => ({
        contents: "export class ReplitConnectors { proxy() { throw new Error('Unexpected live GitHub request'); } }",
        loader: "js",
      }));
    },
  }],
});
const github = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const {
  checkGitHubPreviewVersion,
  createGitHubIssueCommitWithClient,
  getGitHubRateLimitDetails,
  PressError,
} = github;

const headSha = "1".repeat(40);
const otherHeadSha = "2".repeat(40);
const blobSha = "3".repeat(40);
const otherBlobSha = "4".repeat(40);

test("a changed GitHub branch head invalidates the preview", () => {
  assert.throws(
    () => checkGitHubPreviewVersion({ headSha: otherHeadSha, blobSha }, headSha, blobSha),
    (error) => error instanceof PressError && error.status === 409 && /branch or file changed/.test(error.message),
  );
});

test("a changed GitHub file blob invalidates the preview even when the branch head matches", () => {
  assert.throws(
    () => checkGitHubPreviewVersion({ headSha, blobSha: otherBlobSha }, headSha, blobSha),
    (error) => error instanceof PressError && error.status === 409 && /branch or file changed/.test(error.message),
  );
  assert.doesNotThrow(() => checkGitHubPreviewVersion({ headSha, blobSha }, headSha, blobSha));
});

test("GitHub media rate limits use safe retry intervals from supported headers", () => {
  const now = Date.parse("2026-10-09T12:00:00.000Z");
  const retryAfter = new Response(null, {
    status: 429,
    headers: { "Retry-After": "125" },
  });
  assert.deepEqual(getGitHubRateLimitDetails(retryAfter, "private provider detail", now), {
    retryAfterSeconds: 125,
  });

  const retryDate = new Response(null, {
    status: 403,
    headers: { "Retry-After": "Fri, 09 Oct 2026 12:02:05 GMT" },
  });
  assert.deepEqual(getGitHubRateLimitDetails(retryDate, null, now), {
    retryAfterSeconds: 125,
  });

  const secondaryLimit = new Response(null, {
    status: 403,
    headers: { "X-RateLimit-Reset": String(now / 1000 + 91) },
  });
  assert.deepEqual(
    getGitHubRateLimitDetails(secondaryLimit, "You have exceeded a secondary rate limit.", now),
    { retryAfterSeconds: 91 },
  );

  const primaryLimit = new Response(null, {
    status: 403,
    headers: {
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(now / 1000 + 181),
    },
  });
  assert.deepEqual(getGitHubRateLimitDetails(primaryLimit, null, now), {
    retryAfterSeconds: 181,
  });

  const secondaryLimitWithoutWait = new Response(null, { status: 429 });
  assert.deepEqual(getGitHubRateLimitDetails(secondaryLimitWithoutWait, null, now), {
    retryAfterSeconds: null,
  });
});

test("ordinary GitHub download failures are not classified as rate limits", () => {
  const forbidden = new Response(null, { status: 403 });
  assert.equal(getGitHubRateLimitDetails(forbidden, "Resource not found", Date.now()), null);

  const unrelatedResetHeader = new Response(null, {
    status: 403,
    headers: { "X-RateLimit-Reset": "1791547320" },
  });
  assert.equal(getGitHubRateLimitDetails(unrelatedResetHeader, "Resource not found", Date.now()), null);

  const unavailable = new Response(null, { status: 503 });
  assert.equal(getGitHubRateLimitDetails(unavailable, "Service unavailable", Date.now()), null);
});

test("a non-fast-forward branch update is rejected without force-pushing", async () => {
  const calls = [];
  const selection = {
    owner: "press-team",
    repo: "underground-press",
    branch: "main",
    path: "issues/issue-1.json",
    revision: 9,
  };
  const client = {
    async json(path, method = "GET", body) {
      calls.push({ kind: "json", path, method, body });
      if (path.endsWith("/git/blobs")) return { sha: "5".repeat(40) };
      if (path.endsWith(`/git/commits/${headSha}`)) return { tree: { sha: "6".repeat(40) } };
      if (path.endsWith("/git/trees")) return { sha: "7".repeat(40) };
      if (path.endsWith("/git/commits")) return { sha: "8".repeat(40) };
      throw new Error(`Unexpected GitHub JSON request: ${method} ${path}`);
    },
    async response(path, method, body) {
      calls.push({ kind: "response", path, method, body });
      return new Response(JSON.stringify({ message: "Update is not a fast forward" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    },
  };

  await assert.rejects(
    createGitHubIssueCommitWithClient(selection, headSha, { revision: 9 }, "Update issue", client),
    (error) => error instanceof PressError && error.status === 409 && /branch moved after preview/.test(error.message),
  );
  const refUpdate = calls.find((call) => call.kind === "response");
  assert.equal(refUpdate.method, "PATCH");
  assert.match(refUpdate.path, /\/git\/refs\/heads\/main$/);
  assert.equal(refUpdate.body.force, false);
  assert.equal(refUpdate.body.sha, "8".repeat(40));
});
