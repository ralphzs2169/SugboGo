/** Approved opening surfaces; revisit and unclassified origins remain UNKNOWN. */
export const DISCOVERY_SOURCES = [
  "EXPLORE_DISCOVERY",
  "SEARCH_RESULTS",
  "MAP",
  "COLLECTION",
  "SIMILAR_BUSINESSES",
  "COMMUNITY",
  "UNKNOWN",
] as const;

export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

/** Rejects arrays, unsupported strings and absent route context without guessing. */
export function normalizeDiscoverySource(value: unknown): DiscoverySource {
  return typeof value === "string" &&
    DISCOVERY_SOURCES.includes(value as DiscoverySource)
    ? (value as DiscoverySource)
    : "UNKNOWN";
}
