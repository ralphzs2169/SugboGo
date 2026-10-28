import { useState } from "react";
import { usePlatformAnalytics } from "../analytics/hooks/useAnalyticsReports";
import AnalyticsPeriodControl from "../analytics/components/AnalyticsPeriodControl";
import AnalyticsSection from "../analytics/components/AnalyticsSection";
import { serializeReportingPeriod } from "../analytics/utils/reportingPeriod";
import PageHeader from "../components/PageHeader";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

/** Keeps Analytics limited to reporting controls and independently recoverable overview loading. */
function Analytics() {
  useDocumentTitle("Analytics | SugboGo Admin");

  const [period, setPeriod] = useState(() => serializeReportingPeriod());
  const overview = usePlatformAnalytics(period);

  useApiErrorNotification(overview.error, {
    toastId: "analytics-overview-load-error",
    fallbackMessage: "Unable to load platform overview. Please try again.",
  });

  return (
    <div className="min-w-0 space-y-6">
      {/* Page identity and applied reporting selection */}
      <PageHeader title="Analytics" />
      <AnalyticsPeriodControl value={period} onChange={setPeriod} />

      {/* Only overview mounts until report-specific dashboard content is implemented. */}
      <AnalyticsSection
        title="Platform overview"
        description="Current inventory and recorded activity retain their own reporting scope."
        isLoading={overview.isLoading}
        isFetching={overview.isFetching}
        hasData={overview.data !== undefined}
        error={overview.error}
        onRetry={() => overview.refetch()}
        errorMessage="Platform overview is unavailable. Please try again."
        partialNotice={overview.data?.meta?.is_partial ? "Some sources have incomplete coverage or freshness. Reported values retain these limitations." : null}
      />
    </div>
  );
}

export default Analytics;
