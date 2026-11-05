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
