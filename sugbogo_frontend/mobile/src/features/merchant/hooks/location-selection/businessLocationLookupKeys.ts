// Preserve the established lookup cache identity while moving its ownership
// out of the registration workflow.
export const businessLocationLookupKeys = {
  all: ["merchant-application"] as const,
  nearbyLandmarks: (
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ) =>
    [
      ...businessLocationLookupKeys.all,
      "nearby-landmarks",
      latitude,
      longitude,
    ] as const,
  placeSearch: (input: string) =>
    [...businessLocationLookupKeys.all, "place-search", input.trim()] as const,
  placeDetails: (placeId: string) =>
    [...businessLocationLookupKeys.all, "place-details", placeId] as const,
  reverseGeocode: (latitude: number | null, longitude: number | null) =>
    [
      ...businessLocationLookupKeys.all,
      "reverse-geocode",
      latitude,
      longitude,
    ] as const,
};
