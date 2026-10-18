import type { User } from "@/features/users/types/user.types";

import type { AppMode } from "../store/appMode.store";

/** Resolves a safe root destination for the authenticated user's active mode. */
export function resolveAuthenticatedHomeRoute(
  user: Pick<User, "role">,
  activeMode: AppMode,
) {
  return activeMode === "merchant" && user.role === "merchant"
    ? ("/(merchant)/(tabs)/dashboard" as const)
    : ("/(explorer)/(tabs)/explore" as const);
}
