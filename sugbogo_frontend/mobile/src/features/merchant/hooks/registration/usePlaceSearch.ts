import { useEffect, useRef, useState } from "react";
import { PlaceSuggestion } from "@/shared/types/googlePlaces.types";
import {
  getPlaceDetails,
  searchPlaces as searchPlacesApi,
} from "@/shared/api/googlePlaces.service";

/**
 * Manages Google Places search state and user interaction behavior.
 *
 * Handles debounced place searches, loading and error states,
 * and retrieval of details for a selected place.
 */
export default function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function searchPlaces(input: string) {
    if (input.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await searchPlacesApi(input);

      setSuggestions(results);
    } catch (error) {
      console.error("Failed to search places:", error);

      setError("Failed to search places.");
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGetPlaceDetails(placeId: string) {
    try {
      return await getPlaceDetails(placeId);
    } catch (error) {
      console.error("Failed to get place details:", error);

      setError("Failed to get place details.");
      return null;
    }
  }

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
    searchPlaces: handleSearch,
    getPlaceDetails: handleGetPlaceDetails,
    clearSuggestions,
  };
}
