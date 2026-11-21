import type { QueryClient } from "@tanstack/react-query";

import {
  DISCOVERY_FEED_QUERY_KEY,
  NEW_BUSINESSES_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
  DISCOVERY_SHORTCUTS_QUERY_KEY,
  EXPLORE_SPECIALTIES_QUERY_KEY,
  EXPLORE_FILTER_OPTIONS_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
  EXPLORE_BUSINESS_FEED_RETENTION_MS,
  EXPLORE_FILTER_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

const businessFeedKeys = [
  DISCOVERY_FEED_QUERY_KEY,
  NEW_BUSINESSES_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
];

/** Apply before hydration, including queries whose homepage observers mount later. */
export function configureExploreHomepageQueryRetention(client: QueryClient) {
  for (const key of businessFeedKeys) {
    client.setQueryDefaults(key, { gcTime: EXPLORE_BUSINESS_FEED_RETENTION_MS });
  }
  for (const key of [
    DISCOVERY_SHORTCUTS_QUERY_KEY,
    EXPLORE_SPECIALTIES_QUERY_KEY,
  ]) {
    client.setQueryDefaults(key, { gcTime: EXPLORE_HOMEPAGE_RETENTION_MS });
  }
  client.setQueryDefaults(EXPLORE_FILTER_OPTIONS_QUERY_KEY, {
    gcTime: EXPLORE_FILTER_RETENTION_MS,
  });
}

/** Refreshes the homepage feeds when their observers resume after reconnect. */
export function markExploreBusinessFeedsStale(client: QueryClient) {
  for (const queryKey of businessFeedKeys) {
    void client.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
  }
}
