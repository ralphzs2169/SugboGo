import { useQueries } from "@tanstack/react-query";

import { fetchModerationTabCount } from "../services/moderationCountService";

const TAB_IDS = ["under-review", "suspicious", "reported", "disputes"];

/** Load independent queue totals without blocking tab navigation. */
export default function useModerationTabCounts() {
  const results = useQueries({
    queries: TAB_IDS.map((tabId) => ({
      queryKey: ["admin", "moderation-counts", tabId],
      queryFn: () => fetchModerationTabCount(tabId),
      staleTime: 30_000,
    })),
  });

  return Object.fromEntries(TAB_IDS.map((tabId, index) => [
    tabId,
    {
      count: results[index].isError ? undefined : results[index].data,
      isLoading: results[index].isPending && !results[index].isError,
    },
  ]));
}
