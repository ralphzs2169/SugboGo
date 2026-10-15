export const TAXONOMY_SEARCH_THRESHOLD = 12;

/** Retains only categories eligible for the requested cluster. */
export function retainClusterCategoryIds(
  selectedIds: number[],
  clusterId: number | null,
  categories: { id: number; cluster_id: number }[],
) {
  const eligibleIds = new Set(
    categories
      .filter(
        (category) => clusterId === null || category.cluster_id === clusterId,
      )
      .map((category) => category.id),
  );

  return selectedIds.filter((id) => eligibleIds.has(id));
}

/** Adds or removes one category without changing the other selections. */
export function toggleCategoryId(selectedIds: number[], categoryId: number) {
  return selectedIds.includes(categoryId)
    ? selectedIds.filter((id) => id !== categoryId)
    : [...selectedIds, categoryId];
}
