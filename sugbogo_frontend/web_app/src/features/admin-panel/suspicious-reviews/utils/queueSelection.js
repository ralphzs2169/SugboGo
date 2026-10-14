export function firstReviewOnLoadedPage({
  targetPage,
  loadedPage,
  isLoading,
  isPlaceholderData,
  error,
  reviews,
}) {
  if (
    targetPage === null ||
    isLoading ||
    isPlaceholderData ||
    error ||
    loadedPage !== targetPage
  ) {
    return undefined;
  }

  return reviews[0]?.id ?? null;
}
