import type { File } from '@google-cloud/storage';

const ACL_POLICY_METADATA_KEY = 'custom:aclPolicy';

export enum ObjectAccessGroupType {
  SIGNED_IN_COLLABORATORS = 'SIGNED_IN_COLLABORATORS',
}

const COLLABORATORS_GROUP_ID = 'underground-press';

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  // The logic id that identifies qualified group members. Format depends on the
  // ObjectAccessGroupType — e.g. a user-list DB id, an email domain, a group id.
  id: string;
}

export enum ObjectPermission {
  READ = 'read',
  WRITE = 'write',
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

// Stored as object custom metadata under "custom:aclPolicy" (JSON string).
export interface ObjectAclPolicy {
  owner: string;
  visibility: 'public' | 'private';
  aclRules?: Array<ObjectAclRule>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

class SignedInCollaboratorsAccessGroup extends BaseObjectAccessGroup {
  public async hasMember(userId: string): Promise<boolean> {
    // The app currently grants its write access to every authenticated account.
    // Do not imply these accounts have separately verified editorial roles.
    return this.id === COLLABORATORS_GROUP_ID && userId.length > 0;
  }
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    case ObjectAccessGroupType.SIGNED_IN_COLLABORATORS:
      return new SignedInCollaboratorsAccessGroup(group.type, group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

export function createWorkingAssetAclPolicy(owner: string): ObjectAclPolicy {
  return {
    owner,
    visibility: 'private',
    aclRules: [
      {
        group: {
          type: ObjectAccessGroupType.SIGNED_IN_COLLABORATORS,
          id: COLLABORATORS_GROUP_ID,
        },
        permission: ObjectPermission.READ,
      },
    ],
  };
}

export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (typeof aclPolicy !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(aclPolicy);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('owner' in parsed) ||
      typeof parsed.owner !== 'string' ||
      !('visibility' in parsed) ||
      (parsed.visibility !== 'private' && parsed.visibility !== 'public')
    ) {
      return null;
    }
    if (
      'aclRules' in parsed &&
      parsed.aclRules !== undefined &&
      (!Array.isArray(parsed.aclRules) ||
        !parsed.aclRules.every(
          (rule) =>
            typeof rule === 'object' &&
            rule !== null &&
            'group' in rule &&
            typeof rule.group === 'object' &&
            rule.group !== null &&
            'type' in rule.group &&
            rule.group.type === ObjectAccessGroupType.SIGNED_IN_COLLABORATORS &&
            'id' in rule.group &&
            rule.group.id === COLLABORATORS_GROUP_ID &&
            'permission' in rule &&
            (rule.permission === ObjectPermission.READ ||
              rule.permission === ObjectPermission.WRITE),
        ))
    ) {
      return null;
    }
    return parsed as ObjectAclPolicy;
  } catch {
    return null;
  }
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === 'public' &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
