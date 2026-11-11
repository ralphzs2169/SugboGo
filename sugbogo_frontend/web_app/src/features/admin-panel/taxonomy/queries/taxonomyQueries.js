import { keepPreviousData } from "@tanstack/react-query";

import {
  fetchCategories,
  fetchCategoryStatistics,
  fetchClusters,
  fetchClusterStatistics,
} from "../../cluster-category/services/clusterCategoryService";
import {
  fetchSpecialtyTags,
  fetchSpecialtyTagStatistics,
} from "../../specialty-tags/services/specialtyTagService";

export const taxonomyQueryKeys = {
  resource: (resource) => ["admin", "taxonomy", resource],
  references: (resource) => [
    ...taxonomyQueryKeys.resource(resource),
    "references",
  ],
  list: (resource, params) => [
    ...taxonomyQueryKeys.resource(resource),
    "list",
    params,
  ],
  statistics: (resource) => [
    ...taxonomyQueryKeys.resource(resource),
    "statistics",
  ],
};

const listFetchers = {
  clusters: fetchClusters,
  categories: fetchCategories,
  "specialty-tags": fetchSpecialtyTags,
};

const statisticsFetchers = {
  clusters: fetchClusterStatistics,
  categories: fetchCategoryStatistics,
  "specialty-tags": fetchSpecialtyTagStatistics,
};

/** Cache each taxonomy page using its complete server-side criteria. */
export function taxonomyListOptions(resource, params) {
  return {
    queryKey: taxonomyQueryKeys.list(resource, params),
    queryFn: ({ signal }) => listFetchers[resource](params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  };
}

/** Follow the same complete-page loading pattern as Analytics scope filters. */
export function taxonomyReferenceOptions(resource) {
  return {
    queryKey: taxonomyQueryKeys.references(resource),
    queryFn: async ({ signal }) => {
      const items = [];
      let page = 1;
      let hasNext;

      do {
        const response = await listFetchers[resource](
          { page, page_size: 100 },
          { signal },
        );
        items.push(...response.items);
        hasNext = response.pagination.has_next;
        page += 1;
      } while (hasNext);

      return items;
    },
    staleTime: 30_000,
  };
}

/** Keep inventory statistics independent of table filters and pagination. */
export function taxonomyStatisticsOptions(resource) {
  return {
    queryKey: taxonomyQueryKeys.statistics(resource),
    queryFn: ({ signal }) => statisticsFetchers[resource]({ signal }),
    staleTime: 30_000,
  };
}

/** Refresh changed taxonomy inventories and their dependent parent/child displays. */
export function invalidateTaxonomyQueries(queryClient, resource) {
  const resources = resource === "specialty-tags"
    ? [resource]
    : ["clusters", "categories"];

  return Promise.all(resources.map((item) => (
    queryClient.invalidateQueries({
      queryKey: taxonomyQueryKeys.resource(item),
    })
  )));
}
