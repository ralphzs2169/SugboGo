export const merchantLocationChangeKeys = {
  all: ["merchant-location-changes"] as const,
  list: (userId: number | undefined) =>
    [...merchantLocationChangeKeys.all, "list", userId] as const,
  detail: (userId: number | undefined, requestId: number) =>
    [...merchantLocationChangeKeys.all, "detail", userId, requestId] as const,
};
