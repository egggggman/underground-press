# Underground Press GUI workspace

This nested pnpm workspace imports the Replit React/Vite GUI, its API/auth client libraries, and its unit/browser tests. Existing root-level newspaper content, artwork, and documentation are unchanged.

The browser tests run a local fixture with mocks. They do not sign in to the live app or verify live issue data, approval, puzzle correctness, or production proof. The Replit API server is not mirrored in this GUI-only import, so it is not a standalone production deployment.

## Setup and focused tests

Use Node.js 22 and pnpm 10.26.1 from this directory:

```sh
pnpm install --filter @workspace/underground-press... --frozen-lockfile
pnpm --filter @workspace/underground-press exec playwright install firefox webkit
pnpm --filter @workspace/underground-press exec playwright test --config browser-tests/playwright.config.ts --project=firefox --grep="saved historical Page 1"
pnpm --filter @workspace/underground-press exec playwright test --config browser-tests/playwright.config.ts --project=webkit --grep="saved historical Page 1"
```

Playwright WebKit is not native Safari testing. A separate draft PR adds the hosted Firefox/WebKit workflow.
