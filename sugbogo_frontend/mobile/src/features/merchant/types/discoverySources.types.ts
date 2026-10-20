import type { DiscoverySource } from "@/features/explore/constants/discoverySources";
import type { StandardAnalyticsMeta } from "./merchantAnalytics.types";

/** Exact Standard report; attribution completeness does not verify tracking coverage. */
export type DiscoverySourcesReport = {
  business: { id: number; name: string; status: string };
  profile_visits: number | null;
  sources: { source: DiscoverySource; label: string; count: number }[] | null;
  attribution_complete: boolean | null;
  meta: StandardAnalyticsMeta;
};
