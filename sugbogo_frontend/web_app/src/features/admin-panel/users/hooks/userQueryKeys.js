export const userQueryKeys = {
  all: ["admin", "users"],
  lists: () => [...userQueryKeys.all, "list"],
  list: (params) => [...userQueryKeys.lists(), params],
  details: () => [...userQueryKeys.all, "detail"],
  detail: (userId) => [...userQueryKeys.details(), String(userId)],
  activity: (userId, params) => [
    ...userQueryKeys.detail(userId),
    "activity",
    params,
  ],
  histories: () => [...userQueryKeys.all, "administrative-history"],
  historyForUser: (userId) => [
    ...userQueryKeys.histories(),
    String(userId),
  ],
  history: (userId, params) => [
    ...userQueryKeys.historyForUser(userId),
    params,
  ],
};
