export const merchantApplicationKeys = {
  all: ["merchant-application"] as const,
  current: (userId: number | undefined) =>
    [...merchantApplicationKeys.all, "current", userId] as const,
  status: (userId: number | undefined) =>
    ["merchant-application-status", userId] as const,
  options: () => [...merchantApplicationKeys.all, "options"] as const,
  clusters: () => [...merchantApplicationKeys.options(), "clusters"] as const,
  categories: () =>
    [...merchantApplicationKeys.options(), "categories"] as const,
  specialtyTags: () =>
    [...merchantApplicationKeys.options(), "specialty-tags"] as const,
};

export const MERCHANT_REGISTRATION_OPTIONS_STALE_TIME = 30 * 60 * 1000;
