import { useSearchParams } from "react-router-dom";
import { Settings2, ShieldCheck, Store, TrendingUp } from "lucide-react";
import TableTabs from "../components/data-table/TableTabs";
import { WorkspaceSelections } from "../analytics/hooks/useWorkspaceSelection";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AnalyticsPeriodControl from "../analytics/components/AnalyticsPeriodControl";
import { serializeReportingPeriod } from "../analytics/utils/reportingPeriod";
import PageHeader from "../components/PageHeader";
import AnalyticsPdfExport from "../analytics/components/AnalyticsPdfExport";
import StickyContextBar from "@/shared/components/StickyContextBar";
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
  const [stuck, setStuck] = useState(false);
  const [normalHost, setNormalHost] = useState(null);
  const [stickyHost, setStickyHost] = useState(null);
  const restorePeriodFocus = useRef(false);
  const handleStuckChange = useCallback((next) => {
    restorePeriodFocus.current = Boolean(normalHost?.contains(document.activeElement) || stickyHost?.contains(document.activeElement));
    setStuck(next);
  }, [normalHost, stickyHost]);
  const periodHost = stuck ? stickyHost : normalHost;
  useEffect(() => {
    if (restorePeriodFocus.current) {
      periodHost?.querySelector("button")?.focus({ preventScroll: true });
      restorePeriodFocus.current = false;
    }
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      periodHost?.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 160, easing: "ease-out" });
    }
  }, [periodHost]);
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
      <div className="min-w-0 space-y-3">
        {/* Page identity scrolls away while workspace controls remain available. */}
        <div className="flex flex-wrap items-end justify-between gap-3 [&>div:first-child]:mb-0 [&>div:first-child>div:first-child]:mb-3">
          <PageHeader
            title="Analytics"
            breadcrumbs={[
              { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
              { label: "Analytics" },
            ]}
          />
          <div className="flex flex-wrap items-start gap-2">
            <AnalyticsPdfExport active={active} title={TABS.find((tab) => tab.id === active).label} period={period} />
            <div ref={setNormalHost} className="min-h-9 min-w-40 pb-1" />
          </div>
        </div>
        {/* Match detail-page sticky context; only the tabs scroll horizontally. */}
        <StickyContextBar responsive backgroundOnStickOnly onStuckChange={handleStuckChange} ariaLabel="Analytics workspace controls">
          <div className="min-w-0 max-w-full flex-1 basis-0 overflow-x-auto py-1 [&>div]:mt-0">
            <TableTabs tabs={TABS} activeTab={active} onTabChange={changeTab} tabListId="analytics-topics" />
          </div>
          <div ref={setStickyHost} className="ml-auto min-h-9 min-w-40 shrink-0" />
        </StickyContextBar>
        {periodHost && createPortal(<AnalyticsPeriodControl compact value={period} onChange={setPeriod} />, periodHost)}
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
