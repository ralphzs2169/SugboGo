export type NavigationMethod = "ROAD_ROUTE" | "JEEPNEY";

/** Acknowledges one authenticated, UTC-day-deduplicated guidance request. */
export type RoutePlanningIntentResult = {
  business_id: number;
  navigation_method: NavigationMethod;
  recorded: boolean;
  duplicate: boolean;
  excluded_reason: "business_owner" | null;
};
