import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const bundled = await build({
  stdin: {
    contents: `
      import {
        canAccessObject,
        createWorkingAssetAclPolicy,
        ObjectPermission,
      } from "./objectAcl.ts";
      import {
        createUploadOwnerToken,
        isUploadObjectOwnedBy,
        isUploadObjectPath,
      } from "./uploadOwnership.ts";
      export {
        canAccessObject,
        createWorkingAssetAclPolicy,
        ObjectPermission,
        createUploadOwnerToken,
        isUploadObjectOwnedBy,
        isUploadObjectPath,
      };
    `,
    resolveDir: sourceDir,
    sourcefile: "object-acl-test-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  external: ["node:*"],
});
const aclModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const {
  canAccessObject,
  createWorkingAssetAclPolicy,
  ObjectPermission,
  createUploadOwnerToken,
  isUploadObjectOwnedBy,
  isUploadObjectPath,
} = aclModule;

function makeObjectFile(policy) {
  return {
    getMetadata: async () => [
      {
        metadata: policy
          ? { "custom:aclPolicy": JSON.stringify(policy) }
          : {},
      },
    ],
  };
}

test("working assets are private to signed-in collaborators, including the uploader", async () => {
  const policy = createWorkingAssetAclPolicy("uploader-1");
  const objectFile = makeObjectFile(policy);

  assert.equal(
    await canAccessObject({
      userId: "uploader-1",
      objectFile,
      requestedPermission: ObjectPermission.READ,
    }),
    true,
  );
  assert.equal(
    await canAccessObject({
      userId: "reviewer-2",
      objectFile,
      requestedPermission: ObjectPermission.READ,
    }),
    true,
  );
  assert.equal(
    await canAccessObject({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    }),
    false,
  );
});

test("collaborator read access does not grant write permission", async () => {
  assert.equal(
    await canAccessObject({
      userId: "reviewer-2",
      objectFile: makeObjectFile(createWorkingAssetAclPolicy("uploader-1")),
      requestedPermission: ObjectPermission.WRITE,
    }),
    false,
  );
});

test("missing or malformed ACL metadata fails closed", async () => {
  assert.equal(
    await canAccessObject({
      userId: "reviewer-2",
      objectFile: makeObjectFile(null),
      requestedPermission: ObjectPermission.READ,
    }),
    false,
  );
  const malformed = {
    getMetadata: async () => [
      { metadata: { "custom:aclPolicy": "{not valid JSON}" } },
    ],
  };
  assert.equal(
    await canAccessObject({
      userId: "reviewer-2",
      objectFile: malformed,
      requestedPermission: ObjectPermission.READ,
    }),
    false,
  );
});

test("upload paths bind the file to its owner without exposing the account ID", () => {
  const ownerId = "account-subject-123";
  const testSecret = "local-test-signing-secret";
  const ownerToken = createUploadOwnerToken(ownerId, testSecret);
  const path = `/objects/uploads/users/${ownerToken}/123e4567-e89b-12d3-a456-426614174000`;

  assert.equal(path.includes(ownerId), false);
  assert.equal(isUploadObjectPath(path), true);
  assert.equal(isUploadObjectOwnedBy(path, ownerId, testSecret), true);
  assert.equal(isUploadObjectOwnedBy(path, "another-account", testSecret), false);
  assert.equal(
    isUploadObjectOwnedBy(path, ownerId, "different-secret"),
    false,
  );
  assert.equal(isUploadObjectPath("/objects/uploads/users/not-signed/asset"), false);
});
