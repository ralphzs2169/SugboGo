export const merchantBusinessNameChangeKeys = {
  all: ["merchant-business-name-changes"] as const,
  list: (userId: number | undefined) =>
    [...merchantBusinessNameChangeKeys.all, "list", userId] as const,
  detail: (userId: number | undefined, requestId: number) =>
    [
      ...merchantBusinessNameChangeKeys.all,
      "detail",
      userId,
      requestId,
    ] as const,
};
