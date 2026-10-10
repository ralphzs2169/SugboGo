import { useQuery } from "@tanstack/react-query";

import { fetchBusinessUpdateRequests } from "../services/businessUpdateRequestService";
import { fetchClassificationUpdateRequests } from "../services/classificationUpdateRequestService";
import { fetchLocationUpdateRequests } from "../services/locationUpdateRequestService";
import { adminBusinessUpdateRequestKeys } from "./businessUpdateRequestQueryKeys";
import {
  combineUpdateRequests,
  fetchSourceRequests,
} from "../utils/combineUpdateRequests";

const SOURCES = {
  business_name: fetchBusinessUpdateRequests,
  classification: fetchClassificationUpdateRequests,
  location: fetchLocationUpdateRequests,
};

/** Combines the existing request queues for accurate cross-type search and pagination. */
export default function useCombinedUpdateRequests(
  { status, requestType, page, pageSize, search },
  { enabled = true } = {},
) {
  const query = useQuery({
    queryKey: adminBusinessUpdateRequestKeys.combinedList({
      status,
      requestType,
      page,
      pageSize,
      search,
    }),
    enabled,
    queryFn: async () => {
      const types =
        requestType === "all" ? Object.keys(SOURCES) : [requestType];
      const fetchAll = Boolean(search.trim());
      const sources = await Promise.all(
        types.map((type) =>
          fetchSourceRequests(SOURCES[type], status, page, pageSize, fetchAll),
        ),
      );
      return combineUpdateRequests(sources, { search, page, pageSize });
    },
  });

  return {
    requests: query.data?.items ?? [],
    totalItems: query.data?.totalItems ?? 0,
    pageCount: query.data?.pageCount ?? 0,
    hasData: Boolean(query.data),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
