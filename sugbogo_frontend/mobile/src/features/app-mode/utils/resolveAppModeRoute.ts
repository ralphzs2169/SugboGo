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

/** Resolves the post-login destination without visiting the startup route. */
export function resolvePostLoginRoute(
  user: Pick<User, "role" | "has_completed_interest_selection">,
  activeMode: AppMode,
) {
  return user.has_completed_interest_selection
    ? resolveAuthenticatedHomeRoute(user, activeMode)
    : ("/(setup)/interests" as const);
}
