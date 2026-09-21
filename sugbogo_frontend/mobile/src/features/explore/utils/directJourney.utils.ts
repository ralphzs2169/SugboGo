import type { DirectJourneyNoRouteReason } from "../types/directJourney.types";

export function formatJourneyDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)} m`;
  }

  const distanceInKilometers = distanceInMeters / 1000;

  if (distanceInKilometers < 10) {
    return `${distanceInKilometers.toFixed(1)} km`;
  }

  return `${Math.round(distanceInKilometers)} km`;
}

export function getNoDirectJourneyContent(
  reason: DirectJourneyNoRouteReason | null,
) {
  if (reason === "no_nearby_boarding_point") {
    return {
      title: "No boarding point nearby",
      description:
        "SugboGo couldn't find a managed boarding point close enough to your current location.",
    };
  }

  if (reason === "no_nearby_alighting_point") {
    return {
      title: "No direct route close to this destination",
      description:
        "SugboGo's current network doesn't have a convenient direct route that gets close enough to this place.",
    };
  }

  return {
    title: "No convenient direct route found",
    description:
      "There isn't a direct jeepney route in SugboGo's current network that is close enough to both you and this destination.",
  };
}
