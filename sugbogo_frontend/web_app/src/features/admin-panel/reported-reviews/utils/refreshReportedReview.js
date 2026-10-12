import {
  fetchReportedReview,
  fetchReportedReviews,
} from "../services/reportedReviewService";
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

  let stillPending = false;
  try {
    const currentDetail = await fetchReportedReview(selectedId);
    queryClient.setQueryData(
      ["admin", "reported-reviews", "detail", selectedId],
      currentDetail,
    );
    stillPending = true;
  } catch (detailError) {
    if (detailError.response?.status !== 404) {
      queryClient.invalidateQueries({
        queryKey: ["admin", "reported-reviews", "detail", selectedId],
      });
      stillPending = true;
    }
  }

  return {
    nextId: stillPending
      ? selectedId
      : nextReportedSelection(previousItems, refreshed.items, selectedId),
    previousPage: !refreshed.items.length
      && page > 1
      && refreshed.pagination.total_pages < page,
  };
}
