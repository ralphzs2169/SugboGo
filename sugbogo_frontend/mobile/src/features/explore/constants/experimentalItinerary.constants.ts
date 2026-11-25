import { Platform } from "react-native";

/** Default to geometric guidance in development while preserving release opt-in. */
export function experimentalItinerariesEnabled() {
  const enabled = __DEV__ || process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED === "true";
  const googleMapsAvailable =
    Platform.OS === "android" ||
    (Platform.OS === "ios" && Boolean(process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY));
  return enabled && googleMapsAvailable;
}
