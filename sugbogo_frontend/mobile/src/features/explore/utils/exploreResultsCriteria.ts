import {
  retainClusterCategoryIds,
  toggleCategoryId,
} from "@/shared/utils/taxonomyFilters";

import type {
  ExploreFilterCategory,
  ExploreResultsCriteria,
} from "../types/exploreBusiness.types";

export function applyClusterSelection(
  criteria: ExploreResultsCriteria,
  clusterId: number | null,
  categories: ExploreFilterCategory[],
) {
  const categoryIds =
    clusterId === null
      ? []
      : retainClusterCategoryIds(criteria.categoryIds, clusterId, categories);

  return {
    ...criteria,
    clusterId,
    categoryIds,
  };
}

export function toggleCategorySelection(
  criteria: ExploreResultsCriteria,
  categoryId: number,
) {
  return {
    ...criteria,
    categoryIds: toggleCategoryId(criteria.categoryIds, categoryId),
  };
}

export function toggleSpecialtySelection(
  criteria: ExploreResultsCriteria,
  specialtyTagId: number,
) {
  return {
    ...criteria,
    specialtyTagId:
      criteria.specialtyTagId === specialtyTagId ? null : specialtyTagId,
  };
}

export function getTaxonomyFilterCount(criteria: ExploreResultsCriteria) {
  return (
    criteria.categoryIds.length + (criteria.specialtyTagId === null ? 0 : 1)
  );
}
