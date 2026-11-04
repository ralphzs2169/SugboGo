export const adminApplicationKeys = {
  all: ["admin", "merchant-applications"],
  lists: ["admin", "merchant-applications", "list"],
  list: (params) => ["admin", "merchant-applications", "list", params],
  statistics: ["admin", "merchant-applications", "statistics"],
  detail: (applicationId) => [
    "admin", "merchant-applications", "detail", String(applicationId),
  ],
  duplicates: (applicationId) => ["admin", "application-duplicates", applicationId],
};
