import { router } from "expo-router";

import type { ExploreResultsCriteria } from "../types/exploreBusiness.types";

export const EMPTY_EXPLORE_RESULTS_CRITERIA: ExploreResultsCriteria = {
  search: "",
  clusterId: null,
  categoryIds: [],
  specialtyTagId: null,
};

/** Opens the single results route using only authoritative taxonomy IDs. */
export function navigateToExploreResults(
  criteria: Partial<ExploreResultsCriteria> = {},
  openFilters = false,
  focusSearch = false,
) {
  const resolved = {
    ...EMPTY_EXPLORE_RESULTS_CRITERIA,
    ...criteria,
  };

  router.push({
    pathname: "/(explorer)/explore-results",
    params: {
      search: resolved.search,
      clusterId: resolved.clusterId === null ? "" : String(resolved.clusterId),
      categoryIds: resolved.categoryIds.join(","),
      specialtyTagId:
        resolved.specialtyTagId === null
          ? ""
          : String(resolved.specialtyTagId),
      openFilters: openFilters ? "1" : "",
      focusSearch: focusSearch ? "1" : "",
    },
  });
}
