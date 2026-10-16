import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  myrtleEditorAssignmentsTable,
  myrtleEditorRoleChangesTable,
  usersTable,
} from "@workspace/db";
import {
  hasMyrtleEditorRole,
  hasNewsroomAdminRole,
  MYRTLE_EDITOR_ROLE,
  NEWSROOM_ADMIN_ROLE,
} from "./press-roles";

/**
 * A stored decision overrides the legacy environment list, including a revoke.
 * Accounts without a stored decision retain any configured legacy assignment.
 */
export async function isMyrtleEditorAssigned(
  accountId: string | null | undefined,
): Promise<boolean> {
  if (!accountId) return false;
  const [assignment] = await db
    .select({ enabled: myrtleEditorAssignmentsTable.enabled })
    .from(myrtleEditorAssignmentsTable)
    .where(eq(myrtleEditorAssignmentsTable.accountId, accountId))
    .limit(1);
  return assignment ? assignment.enabled : hasMyrtleEditorRole(accountId);
}

export async function rolesForAccount(
  accountId: string | null | undefined,
): Promise<(typeof MYRTLE_EDITOR_ROLE | typeof NEWSROOM_ADMIN_ROLE)[]> {
  if (!accountId) return [];
  const roles: (typeof MYRTLE_EDITOR_ROLE | typeof NEWSROOM_ADMIN_ROLE)[] = [];
  if (await isMyrtleEditorAssigned(accountId)) roles.push(MYRTLE_EDITOR_ROLE);
  if (hasNewsroomAdminRole(accountId)) roles.push(NEWSROOM_ADMIN_ROLE);
  return roles;
}

export async function listMyrtleEditorAssignments() {
  const accountRows = await db
    .select({
      accountId: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      storedEnabled: myrtleEditorAssignmentsTable.enabled,
      changedBy: myrtleEditorAssignmentsTable.changedBy,
      changedAt: myrtleEditorAssignmentsTable.changedAt,
    })
    .from(usersTable)
    .leftJoin(
      myrtleEditorAssignmentsTable,
      eq(usersTable.id, myrtleEditorAssignmentsTable.accountId),
    )
    .orderBy(asc(usersTable.email), asc(usersTable.id));

  const accounts = accountRows.map((row) => ({
    accountId: row.accountId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    enabled: row.storedEnabled ?? hasMyrtleEditorRole(row.accountId),
    changedBy: row.changedBy,
    changedAt: row.changedAt?.toISOString() ?? null,
  }));

  const changes = await db
    .select({
      id: myrtleEditorRoleChangesTable.id,
      targetAccountId: myrtleEditorRoleChangesTable.targetAccountId,
      enabled: myrtleEditorRoleChangesTable.enabled,
      changedBy: myrtleEditorRoleChangesTable.changedBy,
      changedAt: myrtleEditorRoleChangesTable.changedAt,
    })
    .from(myrtleEditorRoleChangesTable)
    .orderBy(desc(myrtleEditorRoleChangesTable.id))
    .limit(50);

  return {
    accounts,
    changes: changes.map((change) => ({
      ...change,
      changedAt: change.changedAt.toISOString(),
    })),
  };
}

export async function setMyrtleEditorAssignment(
  accountId: string,
  enabled: boolean,
  changedBy: string,
) {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, accountId))
    .limit(1);
  if (!user) return null;

  const changedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(myrtleEditorAssignmentsTable)
      .values({ accountId, enabled, changedBy, changedAt })
      .onConflictDoUpdate({
        target: myrtleEditorAssignmentsTable.accountId,
        set: { enabled, changedBy, changedAt },
      });
    await tx.insert(myrtleEditorRoleChangesTable).values({
      targetAccountId: accountId,
      enabled,
      changedBy,
      changedAt,
    });
  });

  const { accounts } = await listMyrtleEditorAssignments();
  return accounts.find((account) => account.accountId === accountId) ?? null;
}
