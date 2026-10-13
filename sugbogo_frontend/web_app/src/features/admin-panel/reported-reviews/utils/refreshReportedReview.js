import { fetchReportedReviews } from "../services/reportedReviewService";
import { nextReportedSelection } from "./reportedReviewPresentation";

export async function refreshReportedReview({
  queryClient,
  listKey,
  params,
  previousItems,
  selectedId,
  page,
}) {
  const refreshed = await fetchReportedReviews(params);
  queryClient.setQueryData(listKey, refreshed);

  queryClient.removeQueries({
    queryKey: ["admin", "reported-reviews", "detail", selectedId],
  });

  return {
    nextId: nextReportedSelection(previousItems, refreshed.items, selectedId),
    previousPage: !refreshed.items.length
      && page > 1
      && refreshed.pagination.total_pages < page,
  };
}
