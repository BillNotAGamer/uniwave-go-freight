import type { AdminUserListItem } from "./types";

export type AdminUserRowActionPolicy = {
  canChangeRole: boolean;
  canDeactivate: boolean;
  canReactivate: boolean;
  canSoftDelete: boolean;
  canRevokeSessions: boolean;
  canSetTemporaryPassword: boolean;
  isReadOnlyDeleted: boolean;
};

export function getAdminUserRowActionPolicy(input: {
  viewerCanManageUsers: boolean;
  viewerUserId: string;
  item: Pick<
    AdminUserListItem,
    "id" | "accountStatus" | "activeSessionCount"
  >;
}): AdminUserRowActionPolicy {
  if (!input.viewerCanManageUsers) {
    return {
      canChangeRole: false,
      canDeactivate: false,
      canReactivate: false,
      canSoftDelete: false,
      canRevokeSessions: false,
      canSetTemporaryPassword: false,
      isReadOnlyDeleted: false,
    };
  }

  const isSelf = input.viewerUserId === input.item.id;
  const isDeleted = input.item.accountStatus === "deleted";
  const isActive = input.item.accountStatus === "active";
  const isInactive = input.item.accountStatus === "inactive";
  const canOperateOnNonDeletedOther = !isDeleted && !isSelf;

  return {
    canChangeRole: !isDeleted && !isSelf,
    canDeactivate: isActive && !isSelf,
    canReactivate: isInactive,
    canSoftDelete: canOperateOnNonDeletedOther,
    canRevokeSessions: canOperateOnNonDeletedOther,
    canSetTemporaryPassword: canOperateOnNonDeletedOther,
    isReadOnlyDeleted: isDeleted,
  };
}
