import { useEffect, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import {
  getPlaceDetails,
  searchPlaces as searchPlacesApi,
} from "@/shared/api/googlePlaces.service";
import type {
  BusinessLocation,
  PlaceSuggestion,
} from "@/shared/types/BusinessLocation.types";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";

const MINIMUM_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Searches SugboGo's existing Google Places backend and resolves suggestions.
 *
 * Debounced searches invalidate older requests so stale responses cannot
 * replace the results for a newer query.
 */
export default function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchRateLimited, setIsSearchRateLimited] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestId = useRef(0);

  async function searchPlaces(input: string) {
    const requestId = ++searchRequestId.current;

    if (input.trim().length < MINIMUM_SEARCH_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      setIsSearchRateLimited(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await searchPlacesApi(input);

      if (requestId !== searchRequestId.current) {
        return;
      }

      if (!response.success) {
        setSuggestions([]);

        if (response.code === "RATE_LIMIT_EXCEEDED") {
          setIsSearchRateLimited(true);
          return;
        }

        setIsSearchRateLimited(false);
        setError("Unable to search places.");
        return;
      }

      setIsSearchRateLimited(false);
      setSuggestions(response.data.suggestions);
    } catch (searchError) {
      if (requestId !== searchRequestId.current) {
        return;
      }

      console.error("Failed to search places:", searchError);
      setIsSearchRateLimited(false);
      setError("Unable to search places.");
      setSuggestions([]);
    } finally {
      if (requestId === searchRequestId.current) {
        setIsLoading(false);
      }
    }
  }

  async function handleGetPlaceDetails(
    placeId: string,
  ): Promise<BusinessLocation | null> {
    try {
      const response = await getPlaceDetails(placeId);

      if (!response.success) {
        if (response.code === "RATE_LIMIT_EXCEEDED") {
          const retryAfter = response.errors?.retry_after as number | undefined;

          Toast.show({
            type: "error",
            text1: "You're selecting places too quickly",
            text2: getRetryAfterMessage(retryAfter),
          });

          return null;
        }

        setError("Failed to get place details.");
        return null;
      }

      return response.data.location;
    } catch (detailsError) {
      console.error("Failed to get place details:", detailsError);
      setError("Failed to get place details.");
      return null;
    }
  }

  function handleSearch(input: string) {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (input.trim().length < MINIMUM_SEARCH_LENGTH) {
      ++searchRequestId.current;
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      setIsSearchRateLimited(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      void searchPlaces(input);
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearSuggestions() {
    ++searchRequestId.current;
    setSuggestions([]);
    setIsLoading(false);
    setError(null);
    setIsSearchRateLimited(false);
  }

  useEffect(() => {
    const requestIdRef = searchRequestId;

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      ++requestIdRef.current;
    };
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    isSearchRateLimited,
    searchPlaces: handleSearch,
    getPlaceDetails: handleGetPlaceDetails,
    clearSuggestions,
  };
}
