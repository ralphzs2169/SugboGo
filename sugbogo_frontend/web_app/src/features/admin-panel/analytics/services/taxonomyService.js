import { fetchCategories, fetchClusters } from "../../cluster-category/services/clusterCategoryService";

/** Read every existing taxonomy page so filter options are never silently truncated. */
export async function fetchAnalyticsTaxonomy(kind) {
  const fetchPage = kind === "clusters" ? fetchClusters : fetchCategories;
  const items = [];
  let page = 1;
  let hasNext;
  do {
    const report = await fetchPage({ page, page_size: 100 });
    items.push(...report.items);
    hasNext = report.pagination.has_next;
    page += 1;
  } while (hasNext);
  return items;
}
