import type { QueryKey } from "@tanstack/react-query";

export const QUERY_PERSISTENCE_STORAGE_KEY = "sugbogo_temporary_queries";
export const QUERY_PERSISTENCE_FORMAT_VERSION = 1;
export const QUERY_PERSISTENCE_POLICY_VERSION = 1;
export const QUERY_PERSISTENCE_BUSTER = `temporary-queries:${QUERY_PERSISTENCE_FORMAT_VERSION}:${QUERY_PERSISTENCE_POLICY_VERSION}`;

export const QUERY_PERSISTENCE_LIMITS = Object.freeze({
  maxBytes: 3 * 1024 * 1024,
  maxEntryBytes: 512 * 1024,
  maxEntries: 32,
});

export type QueryPersistenceScope = Readonly<{
  ownerId: number;
  apiScope: string;
}>;

/** Policies validate the stored DTO; projections must remain safe to hydrate. */
export type QueryPersistencePolicy = Readonly<{
  id: string;
  version: number;
  kind: "query" | "infinite";
  matches: (key: QueryKey, scope: QueryPersistenceScope) => boolean;
  maxAgeMs: number;
  maxBytes: number;
  maxPages?: number;
  project?: (data: unknown) => unknown;
  parse: (data: unknown) => unknown;
}>;

// Production queries remain denied until their feature explicitly opts in.
export const QUERY_PERSISTENCE_POLICIES: readonly QueryPersistencePolicy[] =
  Object.freeze([]);

/** Matches the API identity already used by the API client and offline resources. */
export function getQueryPersistenceApiScope() {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

/** Counts serialized UTF-8 bytes without depending on a native text encoder. */
export function serializedBytes(value: string) {
  let bytes = 0;

  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
}

/** Copies a bounded prefix while rejecting malformed or unbounded infinite data. */
export function trimPersistedPages(
  data: unknown,
  maxPages: number | undefined,
) {
  if (
    !Number.isSafeInteger(maxPages) ||
    maxPages === undefined ||
    maxPages <= 0 ||
    typeof data !== "object" ||
    data === null ||
    !("pages" in data) ||
    !("pageParams" in data) ||
    !Array.isArray(data.pages) ||
    !Array.isArray(data.pageParams) ||
    data.pages.length !== data.pageParams.length
  ) {
    throw new Error("Invalid infinite-query persistence policy or data.");
  }

  return {
    ...data,
    pages: data.pages.slice(0, maxPages),
    pageParams: data.pageParams.slice(0, maxPages),
  };
}
