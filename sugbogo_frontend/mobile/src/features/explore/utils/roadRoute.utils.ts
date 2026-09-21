import type { RoadRouteCoordinate } from "../types/roadRoute.types";

export function formatRoadRouteDuration(durationSeconds: number): string {
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

export function decodeGooglePolyline(
  encodedPolyline: string,
): RoadRouteCoordinate[] {
  const coordinates: RoadRouteCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  function decodeValue() {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      if (index >= encodedPolyline.length) {
        throw new Error("The encoded route polyline is invalid.");
      }

      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    return result & 1 ? ~(result >> 1) : result >> 1;
  }

  while (index < encodedPolyline.length) {
    latitude += decodeValue();
    longitude += decodeValue();

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
}
