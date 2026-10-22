import { z } from "zod";

import type {
  ExploreBusinessDetail,
  ExploreBusinessSpecialtyTag,
} from "@/features/explore/types/exploreBusiness.types";
import {
  specialtyTagColors,
  type SpecialtyTagColor,
} from "@/shared/constants/specialtyTagColors";

import {
  MAX_OFFLINE_BUSINESS_SNAPSHOT_CHARACTERS,
  OFFLINE_BUSINESS_SNAPSHOT_VERSION,
} from "../constants/offlinePockets.constants";

/** Reuses the real detail contract while excluding live aggregates and mutation state. */
export type OfflineBusinessData = Pick<
  ExploreBusinessDetail,
  | "id"
  | "business_name"
  | "cluster"
  | "category"
  | "description"
  | "location"
  | "contact_number"
  | "email"
  | "website"
  | "operating_hours"
  | "cover_photo_url"
  | "display_cover_photo_url"
  | "photos"
> & {
  specialty_tags: Pick<
    ExploreBusinessSpecialtyTag,
    "id" | "name" | "color" | "icon"
  >[];
};

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(500);
const remoteUrl = z
  .string()
  .max(4096)
  .url()
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Only remote HTTP photo and website URLs are supported.",
  );
const optionalUrl = z.union([remoteUrl, z.literal("")]).nullable();
const time = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/);

const businessSchema: z.ZodType<OfflineBusinessData> = z.object({
  id,
  business_name: name,
  cluster: z.object({ id, name, icon: z.string().max(128) }),
  category: z.object({ id, name }),
  specialty_tags: z
    .array(
      z.object({
        id,
        name,
        color: z.enum(Object.keys(specialtyTagColors) as SpecialtyTagColor[]),
        icon: z.string().max(128).nullable(),
      }),
    )
    .max(100),
  description: z.string().max(500_000).nullable(),
  location: z.object({
    address: z.string().max(2000),
    city: z.string().max(500),
    province: z.string().max(500),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  contact_number: z.string().max(512),
  email: z.union([z.string().max(512).email(), z.literal("")]).nullable(),
  website: optionalUrl,
  cover_photo_url: optionalUrl,
  display_cover_photo_url: optionalUrl,
  photos: z
    .array(
      z.object({
        id,
        photo_url: remoteUrl,
        category: z.string().max(128),
      }),
    )
    .max(100),
  operating_hours: z
    .array(
      z.object({
        id,
        day: z.enum([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ]),
        is_open: z.boolean(),
        is_24_hours: z.boolean(),
        open_time: time.nullable(),
        close_time: time.nullable(),
      }),
    )
    .max(7)
    .refine(
      (hours) => new Set(hours.map((row) => row.day)).size === hours.length,
      "A weekly schedule cannot contain duplicate days.",
    ),
});

export const offlineBusinessSnapshotSchema = z.object({
  formatVersion: z.literal(OFFLINE_BUSINESS_SNAPSHOT_VERSION),
  fetchedAt: z
    .string()
    .datetime({ offset: true })
    .refine(
      (value) => Date.parse(value) >= 0,
      "Use a valid fetch timestamp after the Unix epoch.",
    ),
  business: businessSchema,
});

export type OfflineBusinessSnapshot = z.infer<
  typeof offlineBusinessSnapshotSchema
>;
export type OfflineBusinessSnapshotParseResult =
  | { status: "available"; snapshot: OfflineBusinessSnapshot }
  | { status: "corrupt" | "unsupported"; snapshot: null };
export type OfflineBusinessSnapshotEntry =
  OfflineBusinessSnapshotParseResult & {
    businessId: number;
  };
export type OfflineBusinessSnapshotRead =
  | OfflineBusinessSnapshotEntry
  | { businessId: number; status: "missing"; snapshot: null };

/** Builds a whitelisted snapshot from the existing API DTO, without performing a request. */
export function createOfflineBusinessSnapshot(
  business: ExploreBusinessDetail,
  fetchedAt: string,
): OfflineBusinessSnapshot {
  return offlineBusinessSnapshotSchema.parse({
    formatVersion: OFFLINE_BUSINESS_SNAPSHOT_VERSION,
    fetchedAt,
    business,
  });
}

/** Validates and strips incoming data before serialization, bounding the persisted payload. */
export function serializeOfflineBusinessSnapshot(input: unknown): {
  snapshot: OfflineBusinessSnapshot;
  json: string;
} {
  const snapshot = offlineBusinessSnapshotSchema.parse(input);
  const json = JSON.stringify(snapshot);
  if (json.length > MAX_OFFLINE_BUSINESS_SNAPSHOT_CHARACTERS) {
    throw new Error("This business snapshot is too large to save.");
  }
  return { snapshot, json };
}

/** Reports unusable stored data without hiding healthy rows or deleting damaged records. */
export function parseOfflineBusinessSnapshot(
  json: string,
): OfflineBusinessSnapshotParseResult {
  if (json.length > MAX_OFFLINE_BUSINESS_SNAPSHOT_CHARACTERS) {
    return { status: "corrupt", snapshot: null };
  }
  try {
    const input: unknown = JSON.parse(json);
    if (
      typeof input === "object" &&
      input !== null &&
      "formatVersion" in input &&
      typeof input.formatVersion === "number" &&
      Number.isSafeInteger(input.formatVersion) &&
      input.formatVersion > 0 &&
      input.formatVersion !== OFFLINE_BUSINESS_SNAPSHOT_VERSION
    ) {
      return { status: "unsupported", snapshot: null };
    }
    const parsed = offlineBusinessSnapshotSchema.safeParse(input);
    if (parsed.success) {
      return { status: "available", snapshot: parsed.data };
    }
  } catch {
    // Damaged local JSON remains explicitly removable by its scoped row identity.
  }
  return { status: "corrupt", snapshot: null };
}
