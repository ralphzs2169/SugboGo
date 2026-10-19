import { DISCOVERY_SOURCES } from "@/features/explore/constants/discoverySources";
import type { DiscoverySourcesReport } from "../types/discoverySources.types";
import { standardAnalyticsMeta } from "./merchantAnalytics.fixtures";

export function discoverySourcesReport(
  overrides: Partial<DiscoverySourcesReport> = {},
): DiscoverySourcesReport {
  const labels = [
    "Explore",
    "Search & filtered results",
    "Map",
    "Discovery lists",
    "Similar places",
    "Community",
    "Source not recorded",
  ];
  return {
    business: { id: 8, name: "Fixture business", status: "active" },
    profile_visits: 7,
    sources: DISCOVERY_SOURCES.map((source, index) => ({
      source,
      label: labels[index],
      count: [4, 0, 2, 0, 0, 0, 1][index],
    })),
    attribution_complete: false,
    meta: standardAnalyticsMeta(),
    ...overrides,
  };
}
