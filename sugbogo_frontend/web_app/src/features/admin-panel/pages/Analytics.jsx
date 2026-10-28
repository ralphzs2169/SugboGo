import { useState } from "react";
import AnalyticsPeriodControl from "../analytics/components/AnalyticsPeriodControl";
import { serializeReportingPeriod } from "../analytics/utils/reportingPeriod";
import PageHeader from "../components/PageHeader";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import OverviewSection from "../analytics/sections/OverviewSection";
import PlatformGrowthSection from "../analytics/sections/PlatformGrowthSection";
import DiscoveryActivitySection from "../analytics/sections/DiscoveryActivitySection";
import OnboardingSection from "../analytics/sections/OnboardingSection";
import CommunityHealthSection from "../analytics/sections/CommunityHealthSection";
import TrustOperationsSection from "../analytics/sections/TrustOperationsSection";
import CoverageSection from "../analytics/sections/CoverageSection";
import BusinessAttentionSection from "../analytics/sections/BusinessAttentionSection";
import SpecialtySupportSection from "../analytics/sections/SpecialtySupportSection";
import DiscoveryScoreHealthSection from "../analytics/sections/DiscoveryScoreHealthSection";

/** Assembles independent, source-aware reports into the Admin decision dashboard. */
function Analytics() {
  useDocumentTitle("Analytics | SugboGo Admin");

  const [period, setPeriod] = useState(() => serializeReportingPeriod());

  return (
    <div className="min-w-0 space-y-6">
      {/* Page identity and applied reporting selection */}
      <div>
        <PageHeader title="Analytics" />
        <p className="text-sm leading-relaxed text-text-secondary">Understand platform growth, discovery activity, merchant operations, and community health.</p>
      </div>
      <AnalyticsPeriodControl value={period} onChange={setPeriod} />

      {/* Platform performance and related time-series reports */}
      <OverviewSection period={period} />
      <PlatformGrowthSection period={period} />
      <DiscoveryActivitySection period={period} />
      <OnboardingSection period={period} />
      <CommunityHealthSection period={period} />

      {/* Operational workload, coverage and exposure decisions */}
      <TrustOperationsSection period={period} />
      <CoverageSection period={period} />
      <BusinessAttentionSection period={period} />

      {/* Current snapshots intentionally receive no global date selection */}
      <SpecialtySupportSection />
      <DiscoveryScoreHealthSection />
    </div>
  );
}

export default Analytics;
