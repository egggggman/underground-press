import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// This module is imported ONLY by tests, never by the application. All SQL uses
// a throwaway schema; storage and GitHub use the existing external-service fakes.
export async function pageTwoAcceptance({ loadHttpHarness, mediaBytes, pg, sourceDir }) {
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const schema = `press_page2_${randomUUID().replaceAll("-", "")}`;
  await mkdir(join(sourceDir, "../../.local"), { recursive: true });
  const dir = await mkdtemp(join(sourceDir, "../../.local/page2-"));
  let harness, server;
  const checks = [];
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`
      CREATE TABLE "${schema}".sessions (sid varchar PRIMARY KEY, sess jsonb NOT NULL, expire timestamp NOT NULL);
      CREATE TABLE "${schema}".users (id varchar PRIMARY KEY, email varchar UNIQUE, first_name varchar, last_name varchar, profile_image_url varchar, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE "${schema}".myrtle_editor_assignments (account_id varchar PRIMARY KEY REFERENCES "${schema}".users(id), enabled boolean NOT NULL, changed_by varchar NOT NULL, changed_at timestamptz DEFAULT now());
      CREATE TABLE "${schema}".myrtle_editor_role_changes (id serial PRIMARY KEY, target_account_id varchar NOT NULL, enabled boolean NOT NULL, changed_by varchar NOT NULL, changed_at timestamptz DEFAULT now());
      CREATE TABLE "${schema}".press_issues (id integer PRIMARY KEY, document jsonb NOT NULL);
      CREATE TABLE "${schema}".press_versions (id serial PRIMARY KEY, revision integer NOT NULL, at timestamptz DEFAULT now(), action text NOT NULL, actor text NOT NULL, document jsonb NOT NULL);
    `);
    const url = new URL(process.env.DATABASE_URL);
    // No public fallback: a missing table must fail rather than touch real data.
    url.searchParams.set("options", `-c search_path=${schema}`);
    harness = await loadHttpHarness(dir, { useDatabase: true, databaseUrl: url.toString() });
    const editorId = `TEST-ONLY-role-fixture-${randomUUID()}`;
    await harness.assignPersistentEditor(editorId);
    const member = await harness.createPersistentSession("TEST-ONLY-contributor");
    const editor = await harness.createPersistentSession(editorId);
    const sessions = { contributor: member, myrtle: editor };
    const notes = "TEST-ONLY acceptance simulation. No actual Myrtle approval, art clearance, puzzle validation or production proof is claimed.";
    const names = { contributor: "TEST-ONLY Contributor", myrtle: "TEST-ONLY Assigned Role Fixture" };
    let finishBrowser;
    const browserDone = new Promise(resolve => { finishBrowser = resolve; });
    harness.app.get("/api/auth/user", (req, res) => res.json({
      user: req.user ? { ...req.user, firstName: "TEST-ONLY", lastName: req.user.id === editorId ? "Assigned Role Fixture" : "Contributor" } : null,
      roles: req.user?.id === editorId ? ["myrtle_editor"] : [],
    }));
    harness.app.get("/__test/login/:role", (req, res) => {
      const sid = sessions[req.params.role];
      if (!sid) return res.sendStatus(400);
      res.cookie("sid", sid, { httpOnly: true, sameSite: "lax" });
      res.redirect("/pages?page=2");
    });
    harness.app.post("/__test/finish", (_req, res) => { res.json({ sandbox: true }); finishBrowser(); });
    harness.app.use("/api/storage", (req, res) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      res.type("png").send(mediaBytes);
    });
    // Never forward an unknown API request to the real app.
    harness.app.use("/api", (_req, res) => res.status(404).json({ error: "Test sandbox endpoint not available" }));
    harness.app.use(async (req, res) => {
      const response = await fetch(`http://127.0.0.1:20909${req.originalUrl}`);
      const type = response.headers.get("content-type") || "text/plain";
      res.status(response.status).type(type);
      if (type.includes("text/html")) {
        res.send((await response.text()).replace("<title>", "<title>TEST-ONLY ACCEPTANCE SANDBOX — "));
      } else res.send(Buffer.from(await response.arrayBuffer()));
    });
    server = await new Promise((resolve, reject) => {
      const s = harness.app.listen(process.env.PRESS_PAGE2_BROWSER_AUDIT ? 31991 : 0, "127.0.0.1", () => resolve(s));
      s.once("error", reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = role => role ? { Authorization: `Bearer ${sessions[role]}` } : {};
    const get = async (path = "issue", role = "contributor") => {
      const response = await fetch(`${base}/api/press/${path}`, { headers: headers(role) });
      assert.equal(response.status, 200);
      return response.json();
    };
    let issue = await get();
    const cover = structuredClone(issue.pages[0]);
    const coverSnapshot = structuredClone(issue.pageSnapshots[0]);
    const initialRevision = issue.revision;
    const initialVersions = (await get("versions")).length;
    let successful = 0;
    const command = async (body, role = "contributor", status = 200) => {
      const prior = await get();
      const savedPage = prior.pages.find(p => p.number === body.page);
      const response = await fetch(`${base}/api/press/commands`, {
        method: "POST", headers: { ...headers(role), "Content-Type": "application/json" },
        body: JSON.stringify({ revision: prior.revision,
          ...(body.action === "edit_page" ? { title: savedPage.title, copy: savedPage.copy } : {}), ...body }),
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify({ action: body.action, error: result.error, actualStatus: response.status }));
      issue = await get();
      if (status === 200) { successful++; assert.equal(issue.revision, prior.revision + 1); }
      else assert.deepEqual(issue, prior, "A rejected request must not change any issue data.");
      assert.deepEqual(issue.pages[0], cover);
      assert.deepEqual(issue.pageSnapshots[0], coverSnapshot);
      return result;
    };
    // Inventory/reference scaffolding is intentionally artificial and isolated.
    const seeded = structuredClone(issue);
    const asset = {
      id: "TEST-ONLY-image", name: "TEST-ONLY pixel fixture", objectPath: "/objects/test-only-pixel",
      contentType: "image/png", size: mediaBytes.length, dpi: 300, caption: "TEST FIXTURE, not approved original art",
      source: "TEST-ONLY fixture generator", credit: "TEST-ONLY fixture", pages: [2],
      provenance: "uploaded_unverified", review: "pending", reviewer: "", reviewNotes: "",
    };
    harness.resetTestStorage([{ path: asset.objectPath, contentType: asset.contentType, bytesBase64: mediaBytes.toString("base64") }]);
    seeded.assets = [asset];
    seeded.artDirection = { references: ["golden_image", "front_page"].map((kind, n) => ({
      id: `TEST-ONLY-reference-${n}`, kind, version: 1, title: "TEST-ONLY reference scaffolding, not original art",
      assetId: "", url: "https://example.invalid/test-only-reference", sourceIdentity: "TEST-ONLY reference scaffolding",
      suppliedBy: editorId, at: new Date().toISOString(), registrationNotes: notes,
      approval: { reviewer: names.myrtle, reviewerAccountId: editorId, reviewerRole: "myrtle_editor", at: new Date().toISOString(), notes },
    })), history: [] };
    await harness.savePersistentIssue(seeded);
    await command({ action: "edit_page", page: 2, copy: "MUST NOT SAVE anonymously" }, null, 401);
    await command({ action: "edit_page", page: 2, title: "TEST-ONLY Page 2 acceptance", copy: "TEST-ONLY draft text; fictional acceptance fixture.", sourceIdentity: "" });
    assert.equal((await get()).pages[1].copy, "TEST-ONLY draft text; fictional acceptance fixture.");
    await command({ action: "submit_page", page: 2 }, "contributor", 400);
    await command({ action: "edit_page", page: 2, sourceIdentity: "TEST-ONLY source/version-one", copy: "TEST-ONLY draft text; fictional acceptance fixture." });
    await command({ action: "submit_page", page: 2 });
    await command({ action: "approve_editorial", page: 2, reviewer: "Myrtle", notes }, "contributor", 403);
    await command({ action: "approve_editorial", page: 2, notes }, "myrtle", 400);
    checks.push("Explicit persisted draft save, required source identity, review submission, role boundary and missing-puzzle rejection");
    const puzzle = { id: "", title: "TEST-ONLY puzzle fixture", kind: "logic", source: "TEST-ONLY: what is one plus one?", solution: "TEST-ONLY: two", sourceIdentity: "TEST-ONLY puzzle/version-one", validation: "unvalidated", reviewer: "", validationNotes: "", artworkId: asset.id, pages: [2], provenance: "working_draft" };
    await command({ action: "add_puzzle", puzzle });
    let puzzleId = issue.puzzles[0].id;
    await command({ action: "approve_editorial", page: 2, notes }, "myrtle", 400);
    await command({ action: "validate_puzzle", id: puzzleId, decision: "passed", reviewer: names.contributor, notes });
    const reviewArt = async () => {
      await command({ action: "review_asset", id: asset.id, decision: "approved", reviewer: names.contributor, notes });
      await command({ action: "review_asset_style", id: asset.id, decision: "passed", checked: true, reviewer: names.contributor, notes,
        styleChecks: { referenceMatch: true, spotInks: true, typography: true, inkIllustration: true, halftoneRegistration: true, boxedComposition: true, legibilityPrint: true, provenancePreserved: true } });
    };
    const approve = async () => {
      if (issue.pages[1].status === "draft") await command({ action: "submit_page", page: 2 });
      await command({ action: "approve_editorial", page: 2, notes }, "myrtle");
      await command({ action: "approve_art", page: 2, reviewer: names.contributor, notes });
      await command({ action: "check_page_print", page: 2, checked: true, reviewer: names.contributor, notes });
    };
    await reviewArt();
    await command({ action: "set_artwork_slots", page: 2, artworkSlots: [{ id: "TEST-ONLY-slot", label: "TEST-ONLY fixture slot", assetId: "" }] });
    await command({ action: "submit_page", page: 2 });
    await command({ action: "approve_art", page: 2, reviewer: names.contributor, notes }, "contributor", 400);
    await command({ action: "set_artwork_slots", page: 2, artworkSlots: [{ id: "TEST-ONLY-slot", label: "TEST-ONLY fixture slot", assetId: asset.id }] });
    await approve();
    const gates = (await get("readiness")).pageChecks.find(p => p.page === 2);
    assert.equal(gates.canLock, true);
    assert.equal((await get("readiness")).blockers.some(b => /^Page 2:/.test(b)), false);
    checks.push("Simulated puzzle/art/editorial/print gates pass only with fixture evidence; missing artwork slot rejected");
    const staleRevision = issue.revision;
    await command({ action: "edit_page", page: 3, copy: "TEST-ONLY concurrent revision", sourceIdentity: "TEST-ONLY concurrent source" });
    await command({ action: "edit_page", page: 2, revision: staleRevision, copy: "MUST NOT SAVE" }, "contributor", 409);
    await command({ action: "edit_page", page: 2, sourceIdentity: "TEST-ONLY source/version-two" });
    assert.equal(issue.pages[1].editorialApproval, null);
    assert.equal(issue.pages[1].artApproval, null);
    assert.equal(issue.pages[1].printApproval, null);
    await approve();
    await command({ action: "edit_puzzle", id: puzzleId, puzzle: { ...issue.puzzles[0], sourceIdentity: "TEST-ONLY puzzle/version-two" } });
    assert.equal(issue.puzzles[0].validation, "unvalidated");
    assert.equal(issue.pages[1].editorialApproval, null);
    assert.equal(issue.pages[1].artApproval, null);
    await command({ action: "validate_puzzle", id: puzzleId, decision: "passed", reviewer: names.contributor, notes });
    await approve();
    await command({ action: "edit_asset", id: asset.id, asset: { ...issue.assets[0], credit: "TEST-ONLY revised fixture credit" } });
    assert.equal(issue.assets[0].review, "pending");
    assert.equal(issue.pages[1].editorialApproval, null);
    assert.equal(issue.pages[1].artApproval, null);
    await reviewArt();
    await approve();
    checks.push("Source, puzzle and artwork edits invalidate affected approvals; stale writes return 409 without data loss");
    await command({ action: "lock_page", page: 2, notes }, "contributor", 403);
    await admin.query(`UPDATE "${schema}".myrtle_editor_assignments SET enabled = false WHERE account_id = $1`, [editorId]);
    await command({ action: "lock_page", page: 2, notes }, "myrtle", 403);
    await admin.query(`UPDATE "${schema}".myrtle_editor_assignments SET enabled = true WHERE account_id = $1`, [editorId]);
    await command({ action: "lock_page", page: 2, notes }, "myrtle");
    const locked = structuredClone(issue.pageSnapshots.find(s => s.page.number === 2));
    await command({ action: "edit_page", page: 2, copy: "MUST NOT SAVE" }, "contributor", 400);
    await command({ action: "edit_puzzle", id: puzzleId, puzzle: issue.puzzles[0] }, "contributor", 400);
    await command({ action: "branch_page", page: 2, notes });
    await command({ action: "edit_page", page: 2, copy: "TEST-ONLY branched draft", sourceIdentity: "TEST-ONLY branched source" });
    assert.deepEqual(issue.pageSnapshots.find(s => s.id === locked.id), locked);
    assert.equal(issue.pages[1].locked, false);
    assert.equal(issue.pages[1].editorialApproval, null);
    checks.push("Anonymous writes and revoked editor sessions are rejected; role-protected locking freezes page/puzzle/art evidence; explicit branching preserves the locked snapshot");
    await command({ action: "check_continuity", id: issue.checklist[0].id, checked: true, reviewer: names.contributor, notes });
    await command({ action: "import_page_sources", checked: true, notes, pageSources: [{ page: 2, copy: "TEST-ONLY imported copy", sourceIdentity: "TEST-ONLY imported source" }] });
    assert.equal(issue.checklist.every(c => !c.checked), true, "Source import must invalidate continuity checks.");
    await command({ action: "check_continuity", id: issue.checklist[0].id, checked: true, reviewer: names.contributor, notes });
    await command({ action: "import_puzzle_inventory", checked: true, notes, sourceIdentity: "TEST-ONLY inventory", puzzleInventory: [{ ...puzzle, pages: [] }] });
    assert.equal(issue.checklist.every(c => !c.checked), true, "Puzzle import must invalidate continuity checks.");
    await command({ action: "run_preflight" });
    assert.equal(issue.proofs.at(-1).status, "blocked");
    await command({ action: "approve_proof", id: issue.proofs.at(-1).id, notes }, "myrtle", 400);
    const exported = await get("export");
    assert.deepEqual(exported.pages, issue.pages);
    assert.deepEqual(exported.pageSnapshots, issue.pageSnapshots);
    const publicExport = await get("export", null);
    assert.equal(publicExport.puzzles.every(p => !p.solution && !p.validationNotes), true);
    assert.equal(issue.revision, initialRevision + successful);
    assert.equal((await get("versions")).length, initialVersions + successful);
    checks.push("Imports invalidate continuity; preflight preserves real fixture blockers; proof approval rejected; JSON export and history contain every successful revision");
    await writeFile(".local/page2-acceptance-results.json", JSON.stringify({ checks, successfulCommands: successful, sandbox: true, productionSignoffs: false }, null, 2));
    if (process.env.PRESS_PAGE2_BROWSER_AUDIT) {
      console.log(`PAGE2_BROWSER_SANDBOX_READY ${base} — test fixtures only; no production API writes`);
      let timeout;
      try { await Promise.race([browserDone, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Browser sandbox timed out")), 12 * 60 * 1000); })]); }
      finally { clearTimeout(timeout); }
      const afterBrowser = await get();
      assert.deepEqual(afterBrowser.pages[0], cover);
      assert.deepEqual(afterBrowser.pageSnapshots[0], coverSnapshot);
      assert.deepEqual(afterBrowser.pageSnapshots.find(s => s.id === locked.id), locked);
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await harness?.closeTestDatabase();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    await rm(dir, { recursive: true, force: true });
  }
}
