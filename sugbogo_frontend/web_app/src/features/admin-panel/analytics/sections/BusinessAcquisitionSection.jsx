import { useState } from "react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import BusinessAcquisitionTable from "../components/BusinessAcquisitionTable";
import BusinessAcquisitionDistribution from "../components/BusinessAcquisitionDistribution";
import { useBusinessAcquisition } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import { formatCount } from "../utils/presentation";

/** Presents ranked acquisition shares while retaining complete classification counts in View Data. */
export default function BusinessAcquisitionSection({ period }) {
  const [mode, setMode] = useState(null);
  const query = useBusinessAcquisition(period);
  const state = useAnalyticsSectionState(query, "business-acquisition", "business acquisition");
  const data = query.data;
  const hierarchyAvailable = Array.isArray(data?.hierarchy);
  // Reset navigation for a changed reporting population, not refresh timestamps or drawer state.
  const populationKey = JSON.stringify([
    data?.meta?.period?.start_date,
    data?.meta?.period?.end_date,
    data?.hierarchy?.map((cluster) => [
      cluster.id,
      cluster.created,
      cluster.categories.map((category) => [category.id, category.created]),
    ]),
  ]);
  const missingHierarchy = (
    <DataErrorState
      compact
      title="Classification breakdown unavailable"
      message="Refresh this report to load the cluster and category hierarchy."
      onRetry={() => query.refetch()}
      retrying={query.isFetching}
    />
  );

  return (
    <>
      {/* Ranked distribution and one overall total preserve the report's original scope. */}
      <AnalyticsSection
        title="Business Acquisition"
        description="New businesses by current cluster and category."
        {...state}
        controls={data ? (
          <dl className="text-right">
            <dt className="text-xs text-text-secondary">Total new businesses</dt>
            <dd className="mt-0.5 text-xl font-semibold text-text-primary tabular-nums">
              {formatCount(data.totals?.created)}
            </dd>
          </dl>
        ) : undefined}
        footer={
          <AnalyticsReportFooter
            title="Business Acquisition"
            meta={data?.meta}
            hasData={Boolean(data)}
            hasDetails={Boolean(data)}
            onAbout={() => setMode("about")}
            onData={() => setMode("data")}
          />
        }
      >
        <AnalyticsPeriodLabel period={data?.meta?.period} />
        {hierarchyAvailable && data.hierarchy.length > 0 && data.totals?.created === 0 && (
          <p className="mb-3 text-xs text-text-secondary">
            No new businesses were recorded during this period.
          </p>
        )}
        {hierarchyAvailable ? (
          <BusinessAcquisitionDistribution
            key={populationKey}
            clusters={data.hierarchy}
            total={data.totals?.created}
          />
        ) : missingHierarchy}
      </AnalyticsSection>

      {/* Exact data always includes every category, independently of collapsed dashboard rows. */}
      <AnalyticsDetailDrawer
        mode={mode}
        onClose={() => setMode(null)}
        title="Business Acquisition"
        report={data}
        interval="Selected period"
        series={[]}
        showComparison={false}
        aboutContent={
          <div className="space-y-3">
            <p>
              Merchant approval creates the business in the same transaction. New businesses use
              their creation time; first approvals use the recorded decision time. These timestamps
              can fall on different reporting boundaries. First-approval reporting remains in
              Platform Growth and Merchant Onboarding.
            </p>
            {Object.entries(data?.definitions ?? {}).map(([key, value]) => (
              <p key={key}>{value}</p>
            ))}
          </div>
        }
        dataContent={hierarchyAvailable ? (
          <div className="space-y-3">
            <BusinessAcquisitionTable
              clusters={data.hierarchy}
              total={data.totals?.created}
              collapsible={false}
            />
            <p className="text-xs leading-relaxed text-text-secondary">
              Cluster values are subtotals of their categories. Each new business contributes once
              to the report total. Missing classifications stay under Unclassified. Classifications
              with first approvals but no creations in this period remain visible with zero new businesses.
            </p>
          </div>
        ) : missingHierarchy}
      />
    </>
  );
}
