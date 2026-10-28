import { usePlatformAnalytics } from "../analytics/hooks/useAnalyticsReports";
import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

function Analytics() {
  useDocumentTitle("Analytics | SugboGo Admin");

  const overview = usePlatformAnalytics();

  useApiErrorNotification(overview.error, {
    toastId: "analytics-overview-load-error",
    fallbackMessage: "Unable to load platform overview. Please try again.",
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        Analytics
      </h1>
      {/* Mount other reports only when dashboard sections have consumers. */}
      <section aria-label="Platform overview" aria-busy={overview.isFetching}>
        {overview.isPending && <p className="text-text-secondary">Loading platform overview...</p>}
        {overview.isError && (
          <div role="alert">
            <p className="text-text-secondary">Platform overview is unavailable. Please try again.</p>
            <Button
              variant="secondary"
              loading={overview.isFetching}
              onClick={() => overview.refetch()}
            >
              Retry platform overview
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default Analytics;
