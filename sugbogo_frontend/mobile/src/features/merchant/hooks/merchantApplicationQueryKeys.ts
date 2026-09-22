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
  nearbyLandmarks: (
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ) =>
    [
      ...merchantApplicationKeys.all,
      "nearby-landmarks",
      latitude,
      longitude,
    ] as const,
  placeSearch: (input: string) =>
    [...merchantApplicationKeys.all, "place-search", input.trim()] as const,
  placeDetails: (placeId: string) =>
    [...merchantApplicationKeys.all, "place-details", placeId] as const,
  reverseGeocode: (latitude: number | null, longitude: number | null) =>
    [
      ...merchantApplicationKeys.all,
      "reverse-geocode",
      latitude,
      longitude,
    ] as const,
};

export const MERCHANT_REGISTRATION_OPTIONS_STALE_TIME = 30 * 60 * 1000;
