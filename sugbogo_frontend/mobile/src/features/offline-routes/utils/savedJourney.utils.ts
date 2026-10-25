import { z } from "zod";

import {
  MAX_SNAPSHOT_CHARACTERS,
  SNAPSHOT_REVIEW_AFTER_DAYS,
} from "../constants/offlineRoutes.constants";

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(500);
const coordinate = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
const endpoint = z.object({ id, name });
const stop = coordinate.extend({
  id,
  name,
  sequence: z.number().int().nonnegative(),
});
const geometry = z.array(coordinate).min(2).max(10000);

export const savedJourneySchema = z.object({
  formatVersion: z.literal(1),
  savedAt: z.string().datetime(),
  business: z.object({
    id,
    name,
    access_directions: z
      .string()
      .trim()
      .max(1000)
      .transform((value) => value || undefined)
      .optional(),
  }),
  origin: coordinate.extend({ label: name }),
  journey: z
    .object({
      jeepney_route_code: name,
      route_variant: z.object({ id, origin: endpoint, destination: endpoint }),
      boarding_transit_point: stop,
      alighting_transit_point: stop,
      ride: z.object({
        approximate_distance_meters: z.number().finite().nonnegative(),
        full_variant_geometry: geometry,
        selected_segment_geometry: geometry,
      }),
      business_location: coordinate,
      landmark_context: z
        .object({
          id,
          name,
          distance_from_alighting_meters: z.number().finite().nonnegative(),
        })
        .nullable(),
    })
    .refine(
      (journey) =>
        journey.boarding_transit_point.sequence <
        journey.alighting_transit_point.sequence,
      "Boarding must precede alighting.",
    ),
});

export type SavedJourneySnapshot = z.infer<typeof savedJourneySchema>;
export type SavedJourney = SavedJourneySnapshot & { key: string };
export type SavedJourneyListItem = {
  key: string;
  snapshot: SavedJourneySnapshot | null;
};

/** Identifies a selected journey so an explicit repeated save replaces its snapshot. */
export function savedJourneyKey(snapshot: SavedJourneySnapshot): string {
  const journey = snapshot.journey;
  return [
    snapshot.business.id,
    journey.route_variant.id,
    journey.boarding_transit_point.id,
    journey.alighting_transit_point.id,
  ].join(":");
}

/** Validates local JSON and rejects corrupt or unsupported snapshots without losing other rows. */
export function parseSavedJourney(value: string): SavedJourneySnapshot | null {
  if (value.length > MAX_SNAPSHOT_CHARACTERS) return null;
  try {
    const parsed = savedJourneySchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Labels older local snapshots for review without claiming they are still current. */
export function needsJourneyReview(savedAt: string, now = Date.now()): boolean {
  return now - Date.parse(savedAt) >= SNAPSHOT_REVIEW_AFTER_DAYS * 86400000;
}
