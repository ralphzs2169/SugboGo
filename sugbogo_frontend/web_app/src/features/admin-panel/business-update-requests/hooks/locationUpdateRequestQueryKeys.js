export const adminLocationUpdateRequestKeys = {
  all: ["admin", "location-update-requests"],
  lists: ["admin", "location-update-requests", "list"],
  list: (filters) => ["admin", "location-update-requests", "list", filters],
  detail: (requestId) => [
    "admin",
    "location-update-requests",
    "detail",
    String(requestId),
  ],
};
