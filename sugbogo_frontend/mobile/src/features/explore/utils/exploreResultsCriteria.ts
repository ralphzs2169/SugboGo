import type {
  ExploreFilterCategory,
  ExploreResultsCriteria,
} from "../types/exploreBusiness.types";

export function applyClusterSelection(
  criteria: ExploreResultsCriteria,
  clusterId: number | null,
  categories: ExploreFilterCategory[],
) {
  const categoryIds = clusterId === null
    ? []
    : criteria.categoryIds.filter((categoryId) =>
        categories.some(
          (category) =>
            category.id === categoryId &&
            category.cluster_id === clusterId,
        ),
      );

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
  const isSelected = criteria.categoryIds.includes(categoryId);

  return {
    ...criteria,
    categoryIds: isSelected
      ? criteria.categoryIds.filter((id) => id !== categoryId)
      : [...criteria.categoryIds, categoryId],
  };
}

export function toggleSpecialtySelection(
  criteria: ExploreResultsCriteria,
  specialtyTagId: number,
) {
  return {
    ...criteria,
    specialtyTagId:
      criteria.specialtyTagId === specialtyTagId
        ? null
        : specialtyTagId,
  };
}

export function getTaxonomyFilterCount(criteria: ExploreResultsCriteria) {
  return (
    criteria.categoryIds.length +
    (criteria.specialtyTagId === null ? 0 : 1)
  );
}
