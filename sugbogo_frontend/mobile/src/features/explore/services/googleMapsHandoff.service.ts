import * as Linking from "expo-linking";

import type { RoadRouteCoordinate } from "../types/roadRoute.types";

const GOOGLE_MAPS_DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1";

export type GoogleMapsHandoffResult = "opened" | "unavailable" | "failed";

/** Opens optional walking directions for the selected approximate locations. */
export async function openGoogleMapsWalkingDirections(
  origin: RoadRouteCoordinate,
  destination: RoadRouteCoordinate,
): Promise<GoogleMapsHandoffResult> {
  if (![origin, destination].every(({ latitude, longitude }) =>
    Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180,
  )) {
    return "unavailable";
  }
  const url = `${GOOGLE_MAPS_DIRECTIONS_URL}`
    + `&origin=${origin.latitude},${origin.longitude}`
    + `&destination=${destination.latitude},${destination.longitude}`
    + "&travelmode=walking";
  try {
    if (!await Linking.canOpenURL(url)) return "unavailable";
    await Linking.openURL(url);
    return "opened";
  } catch {
    return "failed";
  }
}

/** Builds an origin-free Google Maps driving URL for one destination. */
export function buildGoogleMapsDirectionsUrl(
  destination: RoadRouteCoordinate,
) {
  return (
    `${GOOGLE_MAPS_DIRECTIONS_URL}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    "&travelmode=driving" +
    "&dir_action=navigate"
  );
}

/** Opens Google Maps with the destination while leaving origin selection to it. */
export async function openGoogleMapsDirections(
  destination: RoadRouteCoordinate,
): Promise<GoogleMapsHandoffResult> {
  const url = buildGoogleMapsDirectionsUrl(destination);

  try {
    const canOpenGoogleMaps = await Linking.canOpenURL(url);

    if (!canOpenGoogleMaps) {
      return "unavailable";
    }

    await Linking.openURL(url);

    return "opened";
  } catch {
    return "failed";
  }
}
