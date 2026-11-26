import { Platform } from "react-native";

/** Enable geometry-first guidance on supported clients with a release opt-in. */
export function experimentalItinerariesEnabled() {
  const flag = process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  const enabled = flag === "true" || (flag === undefined && __DEV__);
  const googleMapsAvailable =
    Platform.OS === "android" ||
    (Platform.OS === "ios" && Boolean(process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY));
  return enabled && googleMapsAvailable;
}
