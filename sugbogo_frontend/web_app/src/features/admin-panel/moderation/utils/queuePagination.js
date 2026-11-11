/** Match StandardPagination's invalid-page response without treating every 404 as a page error. */
export function isUnavailableQueuePage(
  error,
  page,
) {
  return (
    page > 1 &&
    error?.response?.status === 404 &&
    error.response.data?.code === "NOT_FOUND" &&
    error.response.data?.message === "Invalid page."
  );
}
