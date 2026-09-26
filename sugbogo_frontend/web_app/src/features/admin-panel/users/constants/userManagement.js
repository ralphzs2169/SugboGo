export const USER_ROLE_OPTIONS = [
  { value: "explorer", label: "Explorer" },
  { value: "merchant", label: "Merchant" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export const USER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
];

export const USER_STATUS_BADGE_VARIANT = {
  pending: "warning",
  active: "success",
  suspended: "danger",
  disabled: "muted",
};

export function canManageUserStatus(actor, targetUser) {
  if (!actor || !targetUser || Number(actor.id) === Number(targetUser.id)) {
    return false;
  }

  if (actor.role === "super_admin") {
    return ["explorer", "merchant", "admin"].includes(targetUser.role);
  }

  if (actor.role === "admin") {
    return ["explorer", "merchant"].includes(targetUser.role);
  }

  return false;
}
