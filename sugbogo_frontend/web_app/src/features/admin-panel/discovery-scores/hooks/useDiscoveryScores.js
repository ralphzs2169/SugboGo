import { useEffect, useRef, useState } from "react";
import { fetchDiscoveryScores } from "../services/discoveryScoreService";

/** Loads persisted score rows with the Admin table's pagination and retry states. */
export default function useDiscoveryScores(params) {
  const [scores, setScores] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const hasLoadedOnce = useRef(false);
  const requestId = useRef(0);

  async function refetch() {
    const currentRequest = ++requestId.current;
    if (hasLoadedOnce.current) {
      setIsFetching(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await fetchDiscoveryScores(params);
      if (currentRequest !== requestId.current) return;
      setScores(result.items ?? []);
      setTotalItems(result.pagination?.total_items ?? 0);
      setPageCount(result.pagination?.total_pages ?? 0);
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setError(requestError);
    } finally {
      if (currentRequest === requestId.current) {
        hasLoadedOnce.current = true;
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      refetch();
    });
    // Params are represented by the stable primitive dependencies below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.search,
    params.status,
    params.cluster,
    params.category,
    params.specialty_tag,
    params.page,
    params.page_size,
    params.ordering,
  ]);

  return {
    scores,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
