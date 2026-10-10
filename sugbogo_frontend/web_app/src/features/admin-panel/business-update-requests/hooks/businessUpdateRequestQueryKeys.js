export const adminBusinessUpdateRequestKeys = {
  all: ["admin", "business-update-requests"],
  lists: ["admin", "business-update-requests", "list"],
  list: (filters) => ["admin", "business-update-requests", "list", filters],
  combinedLists: ["admin", "business-update-requests", "combined"],
  combinedList: (filters) => [
    "admin",
    "business-update-requests",
    "combined",
    filters,
  ],
  detail: (requestId) => [
    "admin",
    "business-update-requests",
    "detail",
    String(requestId),
  ],
};
