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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <PageHeader title="Analytics" />
        <p className="text-sm text-text-secondary">Platform performance, discovery health, and operational insights.</p>
        </div>
        <AnalyticsPeriodControl compact value={period} onChange={setPeriod} />
      </div>
      <nav aria-label="Analytics sections" className="flex gap-4 overflow-x-auto border-b border-stroke pb-3 text-xs font-medium text-text-secondary">
        {[["overview", "Overview"], ["growth", "Growth"], ["operations", "Operations"], ["community", "Community"], ["businesses", "Businesses"]].map(([id, label]) => <a key={id} href={`#analytics-${id}`} className="cursor-pointer whitespace-nowrap rounded hover:text-text-primary focus-visible:outline-2 focus-visible:outline-info">{label}</a>)}
      </nav>

      {/* Platform performance and related time-series reports */}
      <div id="analytics-overview" className="scroll-mt-24"><OverviewSection period={period} /></div>
      <section id="analytics-growth" aria-label="Growth & Discovery" className="scroll-mt-24 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Growth & Discovery</p>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2"><PlatformGrowthSection period={period} /><DiscoveryActivitySection period={period} /></div>
      </section>
      <section id="analytics-operations" aria-label="Operations" className="scroll-mt-24 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Operations</p>
      <OnboardingSection period={period} />
      <TrustOperationsSection period={period} />
      </section>

      {/* Operational workload, coverage and exposure decisions */}
      <section id="analytics-community" aria-label="Community & Discovery Quality" className="scroll-mt-24 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Community & Discovery Quality</p>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2"><CommunityHealthSection period={period} /><SpecialtySupportSection /></div>
      </section>

      {/* Current snapshots intentionally receive no global date selection */}
      <section id="analytics-businesses" aria-label="Business Health" className="scroll-mt-24 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Business Health</p>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2"><CoverageSection period={period} /><DiscoveryScoreHealthSection /></div>
        <BusinessAttentionSection period={period} />
      </section>
    </div>
  );
}

export default Analytics;
