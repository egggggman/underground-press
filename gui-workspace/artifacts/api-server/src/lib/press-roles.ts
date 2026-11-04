export const MYRTLE_EDITOR_ROLE = "myrtle_editor" as const;
export const NEWSROOM_ADMIN_ROLE = "newsroom_admin" as const;

function configuredIds(configuredAccountIds: string): Set<string> {
  return new Set(
    configuredAccountIds.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean),
  );
}

/**
 * The configured IDs are OIDC subject IDs from authenticated user accounts.
 * An empty or missing configuration deliberately grants no editorial roles.
 */
export function hasMyrtleEditorRole(
  accountId: string | null | undefined,
  configuredAccountIds = process.env.MYRTLE_EDITOR_USER_IDS ?? "",
): boolean {
  if (!accountId) return false;
  return configuredIds(configuredAccountIds).has(accountId);
}

export function hasNewsroomAdminRole(
  accountId: string | null | undefined,
  configuredAccountIds = process.env.NEWSROOM_ADMIN_USER_IDS ?? "",
): boolean {
  if (!accountId) return false;
  return configuredIds(configuredAccountIds).has(accountId);
}
