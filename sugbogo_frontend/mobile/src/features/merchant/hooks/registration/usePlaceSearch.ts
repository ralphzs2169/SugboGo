import { useEffect, useRef, useState } from "react";
import { PlaceSuggestion } from "@/shared/types/BusinessLocation.types";
import {
  getPlaceDetails,
  searchPlaces as searchPlacesApi,
} from "@/shared/api/googlePlaces.service";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import Toast from "react-native-toast-message";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";

export default function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchRateLimited, setIsSearchRateLimited] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Searches for places matching the user's input.
   *
   * Requests are debounced by handleSearch before reaching this function.
   * If the backend returns a rate-limit response, its retry_after value is
   * used to establish a local cooldown.
   */
  async function searchPlaces(input: string) {
    if (input.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setIsSearchRateLimited(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await searchPlacesApi(input);

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
    } catch (error) {
      console.error("Failed to search places:", error);

      setIsSearchRateLimited(false);
      setError("Unable to search places.");
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Retrieves complete location details for a selected place.
   *
   * Uses the same local Places cooldown as place search so the frontend
   * does not continue sending requests after the location service has
   * indicated that the Places operations are temporarily rate-limited.
   */
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
    } catch (error) {
      console.error("Failed to get place details:", error);

      setError("Failed to get place details.");
      return null;
    }
  }

  /**
   * Handles changes to the search input.
   *
   * Cancels the previous pending search and waits until the user stops
   * typing before making a new API request.
   */
  function handleSearch(input: string) {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (input.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);

      return;
    }

    // Wait until the user stops typing before making an API request.
    debounceTimer.current = setTimeout(() => {
      searchPlaces(input);
    }, 350);
  }

  function clearSuggestions() {
    setSuggestions([]);
  }

  // Cancels any pending debounced search when the hook unmounts.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
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
