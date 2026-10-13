# The Underground Press — GUI source

This is the Replit React/Vite production GUI. Playwright tests live in `browser-tests/`; root-level newspaper copy, artwork, and documentation remain separate and unchanged.

## Browser tests

Use Node.js 22 and pnpm 10.26.1 from the repository root:

```sh
pnpm install --filter @workspace/underground-press... --frozen-lockfile
pnpm --filter @workspace/underground-press exec playwright install firefox webkit
pnpm --filter @workspace/underground-press exec playwright test --config browser-tests/playwright.config.ts --project=firefox --grep="saved historical Page 1"
pnpm --filter @workspace/underground-press exec playwright test --config browser-tests/playwright.config.ts --project=webkit --grep="saved historical Page 1"
```

The CI workflow installs official Playwright browser and OS dependencies and runs these tests in separate Firefox and WebKit jobs. WebKit is not native Safari. These tests use a local fixture and mocks; they do not verify live approvals, puzzle correctness, print proof, or production issue data. The Replit API server is not mirrored in this repository yet, so the frontend source alone is not a standalone production deployment.
