import { useQueryClient } from "@tanstack/react-query";

import { reverseGeocode } from "@/shared/api/googlePlaces.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

type ReverseGeocodeData = Extract<
  Awaited<ReturnType<typeof reverseGeocode>>,
  { success: true }
>["data"];

const REVERSE_GEOCODE_STALE_TIME = 5 * 60 * 1000;

/** Resolves selected registration coordinates through the shared query cache. */
export default function useRegistrationReverseGeocode() {
  const queryClient = useQueryClient();

  async function resolveCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeData> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("Reverse-geocode coordinates are unavailable.");
    }

    return queryClient.fetchQuery({
      queryKey: merchantApplicationKeys.reverseGeocode(latitude, longitude),
      queryFn: async () => {
        const response = await reverseGeocode(latitude, longitude);

        return throwOnApiError(response);
      },
      staleTime: REVERSE_GEOCODE_STALE_TIME,
      retry: false,
    });
  }

  return { resolveCoordinates };
}
