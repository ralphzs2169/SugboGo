import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import {
  getPlaceDetails as getPlaceDetailsService,
  searchPlaces as searchPlacesService,
} from "@/shared/api/googlePlaces.service";
import type {
  BusinessLocation,
  PlaceSuggestion,
} from "@/shared/types/BusinessLocation.types";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

const MINIMUM_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;
const PLACE_CACHE_STALE_TIME = 5 * 60 * 1000;

async function fetchPlaceDetails(placeId: string): Promise<BusinessLocation> {
  const response = await getPlaceDetailsService(placeId);
  const data = throwOnApiError(response);

  return data.location;
}

/** Loads registration place suggestions and on-demand details from shared services. */
export default function useRegistrationPlaceSearch() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedInput = input.trim();
  const hasSearchInput = normalizedInput.length >= MINIMUM_SEARCH_LENGTH;
  const isCurrentSearch =
    hasSearchInput && normalizedInput === debouncedInput;
  const isDebouncing = hasSearchInput && !isCurrentSearch;

  const searchQuery = useQuery<PlaceSuggestion[], ApiError>({
    queryKey: merchantApplicationKeys.placeSearch(debouncedInput),
    queryFn: async () => {
      const response = await searchPlacesService(debouncedInput);
      const data = throwOnApiError(response);

      return data.suggestions;
    },
    enabled: isCurrentSearch,
    staleTime: PLACE_CACHE_STALE_TIME,
    retry: false,
  });

  const detailsQuery = useQuery<BusinessLocation, ApiError>({
    queryKey: merchantApplicationKeys.placeDetails(selectedPlaceId),
    queryFn: () => fetchPlaceDetails(selectedPlaceId),
    enabled: false,
    staleTime: PLACE_CACHE_STALE_TIME,
    retry: false,
  });

  function clearTimer() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }

  function clearSuggestions() {
    clearTimer();
    setInput("");
    setDebouncedInput("");
    setSelectedPlaceId("");
  }

  function searchPlaces(inputValue: string) {
    clearTimer();
    const nextInput = inputValue.trim();

    setInput(inputValue);

    if (nextInput.length < MINIMUM_SEARCH_LENGTH) {
      setDebouncedInput("");
      return;
    }

    debounceTimer.current = setTimeout(() => {
      if (nextInput === debouncedInput && searchQuery.isError) {
        void queryClient.invalidateQueries({
          queryKey: merchantApplicationKeys.placeSearch(nextInput),
          exact: true,
        });
      }

      setDebouncedInput(nextInput);
    }, SEARCH_DEBOUNCE_MS);
  }

  async function getPlaceDetails(placeId: string): Promise<BusinessLocation | null> {
    setSelectedPlaceId(placeId);

    try {
      return await queryClient.fetchQuery({
        queryKey: merchantApplicationKeys.placeDetails(placeId),
        queryFn: () => fetchPlaceDetails(placeId),
        staleTime: PLACE_CACHE_STALE_TIME,
        retry: false,
      });
    } catch (error) {
      const response = error as ApiError;

      if (response?.code === "RATE_LIMIT_EXCEEDED") {
        const retryAfter = response.errors?.retry_after as number | undefined;

        Toast.show({
          type: "error",
          text1: "You're selecting places too quickly",
          text2: getRetryAfterMessage(retryAfter),
        });
      } else if (response?.code === "OUTSIDE_SERVICE_AREA") {
        Toast.show({
          type: "error",
          text1: "Location outside service area",
          text2: response.message,
        });
      } else {
        const systemErrorHandled =
          response?.success === false && handleSystemError(response);

        if (!systemErrorHandled) {
          Toast.show({
            type: "error",
            text1: "Unable to load place details",
            text2:
              response?.success === false
                ? response.message
                : "Please try selecting the place again.",
          });
        }
      }

      return null;
    }
  }

  useEffect(() => () => clearTimer(), []);

  const searchError = isCurrentSearch ? searchQuery.error : null;

  return {
    suggestions: isCurrentSearch ? (searchQuery.data ?? []) : [],
    isLoading: isCurrentSearch && searchQuery.isLoading,
    isRefetching: isCurrentSearch && searchQuery.isRefetching,
    isDebouncing,
    isSearchSuccess: isCurrentSearch && searchQuery.isSuccess,
    searchError:
      searchError?.code === "RATE_LIMIT_EXCEEDED" ? null : searchError,
    error: searchError
      ? "Unable to search places."
      : detailsQuery.error && selectedPlaceId
        ? "Failed to get place details."
        : null,
    isSearchRateLimited: searchError?.code === "RATE_LIMIT_EXCEEDED",
    searchPlaces,
    getPlaceDetails,
    clearSuggestions,
  };
}
