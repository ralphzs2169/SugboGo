import axios from "axios";
import { PlaceSuggestion } from "@/shared/types/googlePlaces.types";
/**
 * Provides access to the Google Places API for place search
 * and place detail retrieval.
 *
 * This service is shared across features that need Google
 * Places location data.
 */

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places";

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
  if (!apiKey) {
    throw new Error("Google Maps API key is missing.");
  }

  const response = await axios.post(
    `${GOOGLE_PLACES_URL}:autocomplete`,
    {
      input,
      includedRegionCodes: ["ph"],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
    },
  );

  // Transform Google's response into the simplified structure used by the app.
  return (
    response.data.suggestions
      ?.filter((suggestion: any) => suggestion.placePrediction)
      .map((suggestion: any) => {
        const prediction = suggestion.placePrediction;

        return {
          placeId: prediction.placeId,
          mainText:
            prediction.structuredFormat?.mainText?.text ??
            prediction.text?.text ??
            "",
          secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
        };
      }) ?? []
  );
}

export async function getPlaceDetails(placeId: string) {
  if (!apiKey) {
    throw new Error("Google Maps API key is missing.");
  }

  const response = await axios.get(`${GOOGLE_PLACES_URL}/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "location,formattedAddress",
    },
  });

  const { latitude, longitude } = response.data.location ?? {};

  // Ensure the selected place contains valid coordinates before returning it.
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Place location is unavailable.");
  }

  return {
    latitude,
    longitude,
    address: response.data.formattedAddress ?? "",
  };
}
