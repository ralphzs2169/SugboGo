import { Platform } from "react-native";

/** Keep the tester entry disabled in ordinary builds and on unsupported web maps. */
export function experimentalItinerariesEnabled() {
  const enabled = process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED === "true";
  const googleMapsAvailable =
    Platform.OS === "android" ||
    (Platform.OS === "ios" && Boolean(process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY));
  return enabled && googleMapsAvailable;
}
