# Underground Press GUI workspace

This directory is a self-contained pnpm workspace for the Underground Press
interface, API server, database schema, API specification, and generated
TypeScript API/auth clients. It does not include the repository's newspaper
content, production data, credentials, or uploaded files.

## Requirements

- Node.js 24 or newer (validated CI runtime: Node.js 24)
- pnpm 10.26.1
- PostgreSQL for running the API against a local database

From this directory, install the pinned dependency graph:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env` so `DATABASE_URL` points only to a disposable local PostgreSQL
database. Generate a new local `SESSION_SECRET`; do not reuse a deployment
secret. The `.env` file is ignored by Git.

## Build and sandbox tests

```sh
pnpm run build
pnpm run test:sandbox
```

The sandbox test target uses in-memory fixtures and mock storage/auth adapters.
It does not connect to a database, Replit Object Storage, GitHub, or an identity
provider. The API route tests that use PostgreSQL and the browser tests are
available separately through the package scripts; they are not run by
`test:sandbox`.

## Run with a local database

Schema setup is explicit. In a shell where `.env` has been loaded, apply the
schema only to the disposable local database named by `DATABASE_URL`:

```sh
set -a
. ./.env
set +a
pnpm --filter @workspace/db run push
```

Do not point this command at production. No schema migration, database
connection, or storage provisioning runs automatically. The API's first read
creates its documented sample issue in the selected database; use a fresh,
disposable local database for this workspace.

Start the API in one terminal after loading `.env`:

```sh
set -a
. ./.env
set +a
PORT=3000 pnpm --filter @workspace/api-server run dev
```

Start the GUI in another terminal:

```sh
PORT=5173 BASE_PATH=/ API_ORIGIN=http://127.0.0.1:3000 \
  pnpm --filter @workspace/underground-press run dev
```

The GUI's `/api` requests are proxied to `API_ORIGIN`.

## Authentication and storage boundaries

The production authentication flow uses OIDC and secure cookies. A local
interactive sign-in requires an identity-provider client configured for the
local callback URL and the corresponding non-secret client identifier; fixture
tests do not sign in. The API's object-storage implementation uses the Replit
Object Storage sidecar. Its bucket paths and any storage access are intentionally
not imported or provisioned by this workspace. Real upload/download workflows
therefore require a separately configured compatible runtime and must not be
pointed at production storage as part of setup.

Approval, Page 1 protection, immutable asset handling, and source-provenance
rules are included unchanged with the API and GUI source. Sandbox tests use
synthetic fixtures and mock adapters; they do not import editorial or uploaded
content.
