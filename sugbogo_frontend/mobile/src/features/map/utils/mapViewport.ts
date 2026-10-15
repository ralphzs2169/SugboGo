import type { Region } from "react-native-maps";

import type { ApiError } from "@/shared/types/apiResponse.types";

import type { MapBounds } from "../types/mapDiscovery.types";

export const MAX_VIEWPORT_SPAN = 0.5;

export function regionToBounds(region: Region): MapBounds {
  return {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };
}

/** Round outward to about a metre without excluding businesses at the edges. */
export function normalizeBounds(bounds: MapBounds): MapBounds {
  const precision = 100000;

  return {
    north: Math.ceil(bounds.north * precision) / precision,
    south: Math.floor(bounds.south * precision) / precision,
    east: Math.ceil(bounds.east * precision) / precision,
    west: Math.floor(bounds.west * precision) / precision,
  };
}

export function isSearchableBounds(bounds: MapBounds): boolean {
  return (
    Object.values(bounds).every(Number.isFinite) &&
    bounds.north <= 90 &&
    bounds.south >= -90 &&
    bounds.east <= 180 &&
    bounds.west >= -180 &&
    bounds.north > bounds.south &&
    bounds.east > bounds.west &&
    bounds.north - bounds.south <= MAX_VIEWPORT_SPAN &&
    bounds.east - bounds.west <= MAX_VIEWPORT_SPAN
  );
}

/** Ignore camera jitter; an edge must move by at least 5% of the searched span. */
export function hasViewportChanged(
  viewed: MapBounds,
  searched: MapBounds,
): boolean {
  const latitudeThreshold = Math.max(
    (searched.north - searched.south) * 0.05,
    0.0001,
  );
  const longitudeThreshold = Math.max(
    (searched.east - searched.west) * 0.05,
    0.0001,
  );

  return (
    Math.abs(viewed.north - searched.north) > latitudeThreshold ||
    Math.abs(viewed.south - searched.south) > latitudeThreshold ||
    Math.abs(viewed.east - searched.east) > longitudeThreshold ||
    Math.abs(viewed.west - searched.west) > longitudeThreshold
  );
}

export function isViewportLimitError(error: unknown): boolean {
  const apiError = error as Partial<ApiError> | null;

  return Boolean(
    apiError?.code === "VALIDATION_ERROR" && apiError.errors?.bounds,
  );
}
