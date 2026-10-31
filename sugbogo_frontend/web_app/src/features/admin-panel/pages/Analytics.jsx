import { useSearchParams } from "react-router-dom";
import { Settings2, ShieldCheck, Store, TrendingUp } from "lucide-react";
import TableTabs from "../components/data-table/TableTabs";
import { WorkspaceSelections } from "../analytics/hooks/useWorkspaceSelection";
import { useState } from "react";
import AnalyticsPeriodControl from "../analytics/components/AnalyticsPeriodControl";
import { serializeReportingPeriod } from "../analytics/utils/reportingPeriod";
import PageHeader from "../components/PageHeader";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import BusinessAcquisitionSection from "../analytics/sections/BusinessAcquisitionSection";
import TransportationPlanningSection from "../analytics/sections/TransportationPlanningSection";
import DiscoverySourcesSection from "../analytics/sections/DiscoverySourcesSection";
import PlatformGrowthSection from "../analytics/sections/PlatformGrowthSection";
import DiscoveryActivitySection from "../analytics/sections/DiscoveryActivitySection";
import OnboardingSection from "../analytics/sections/OnboardingSection";
import CommunityHealthSection from "../analytics/sections/CommunityHealthSection";
import GeographicDistributionSection from "../analytics/sections/GeographicDistributionSection";
import { ModerationWorkload, ChangeRequestWorkload } from "../analytics/sections/TrustOperationsSection";
import CoverageSection from "../analytics/sections/CoverageSection";
import BusinessAttentionSection from "../analytics/sections/BusinessAttentionSection";
import SpecialtySupportSection from "../analytics/sections/SpecialtySupportSection";
import DiscoveryScoreHealthSection from "../analytics/sections/DiscoveryScoreHealthSection";

const TABS = [
  { id: "growth-discovery", label: "Growth & Discovery", icon: TrendingUp },
  { id: "operations", label: "Operations", icon: Settings2 },
  { id: "community-trust", label: "Community & Trust", icon: ShieldCheck },
  { id: "business-ecosystem", label: "Business Ecosystem", icon: Store },
];

/** Mounts one topic's independent reports while preserving report controls and shared period state. */
function Analytics() {
  useDocumentTitle("Analytics | SugboGo Admin");
  const [period, setPeriod] = useState(() => serializeReportingPeriod());
  const [selections] = useState(() => new Map());
  const [search, setSearch] = useSearchParams();
  const requested = search.get("tab");
  const active = TABS.some((tab) => tab.id === requested) ? requested : TABS[0].id;
  function changeTab(tab) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", tab);
      return next;
    });
  }
  return (
    <WorkspaceSelections.Provider value={selections}>
      <div className="min-w-0 space-y-6">
        {/* Page identity and one shared applied reporting period */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><PageHeader title="Analytics" /><p className="text-sm text-text-secondary">Explore platform growth, operations, community health, and business performance.</p></div>
          <AnalyticsPeriodControl compact value={period} onChange={setPeriod} />
        </div>
        {/* Reuse the exact DataTable segmented presentation and overflow convention */}
        <div className="overflow-x-auto pb-1">
          <TableTabs tabs={TABS} activeTab={active} onTabChange={changeTab} tabListId="analytics-topics" />
        </div>
        {/* Conditional mounting keeps inactive reports and taxonomy requests dormant */}
        <div role="tabpanel" id={`analytics-topics-panel-${active}`} aria-labelledby={`analytics-topics-${active}`} tabIndex={0} className="min-w-0 space-y-4 rounded focus-visible:outline-2 focus-visible:outline-info">
          {active === "growth-discovery" && <><PlatformGrowthSection period={period} /><div className="grid min-w-0 items-start gap-4 xl:grid-cols-2"><DiscoveryActivitySection period={period} /><DiscoverySourcesSection period={period} /></div><div className="grid min-w-0 items-start gap-4 xl:grid-cols-2"><BusinessAcquisitionSection period={period} /><TransportationPlanningSection period={period} /></div></>}
          {active === "operations" && <><OnboardingSection period={period} /><ChangeRequestWorkload period={period} /></>}
          {active === "community-trust" && <>
            <CommunityHealthSection period={period} />
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
              <SpecialtySupportSection />
              <ModerationWorkload period={period} />
            </div>
          </>}
          {active === "business-ecosystem" && <>
            <GeographicDistributionSection period={period} />
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
              <CoverageSection period={period} />
              <DiscoveryScoreHealthSection />
            </div>
            <BusinessAttentionSection period={period} />
          </>}
        </div>
      </div>
    </WorkspaceSelections.Provider>
  );
}

export default Analytics;
