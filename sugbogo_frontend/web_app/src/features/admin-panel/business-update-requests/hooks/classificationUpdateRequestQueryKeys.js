export const adminClassificationUpdateRequestKeys = {
  all: ["admin", "classification-update-requests"],
  lists: ["admin", "classification-update-requests", "list"],
  list: (filters) => [
    "admin",
    "classification-update-requests",
    "list",
    filters,
  ],
  detail: (requestId) => [
    "admin",
    "classification-update-requests",
    "detail",
    String(requestId),
  ],
};
