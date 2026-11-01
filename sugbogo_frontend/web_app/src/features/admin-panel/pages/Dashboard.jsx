import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import MetricRow from "@/features/admin-panel/dashboard/components/MetricRow";
import DiscoveryActivity from "@/features/admin-panel/dashboard/components/DiscoveryActivity";
import LowerDashboardSection from "@/features/admin-panel/dashboard/components/LowerDashboardSection";
import DashboardQuerySection from "../dashboard/components/DashboardQuerySection";
import {
  useDashboardPlatformOverview,
  useDashboardPriorityWorklist,
  useDashboardRecentDecisions,
  useDashboardSummary,
} from "../dashboard/hooks/useDashboardQueries";
import PageHeader from "../components/PageHeader";

/** Load independent Dashboard resources while preserving the temporary widget presentation. */
export default function Dashboard() {
  useDocumentTitle("Dashboard | SugboGo Admin");

  const summary = useDashboardSummary();
  const recentDecisions = useDashboardRecentDecisions();
  const platformOverview = useDashboardPlatformOverview();
  const priorityWorklist = useDashboardPriorityWorklist();

  useApiErrorNotification(summary.error, {
    toastId: "admin-dashboard-summary-load-error",
    fallbackMessage: "Unable to load the Dashboard operational summary. Please try again.",
  });
  useApiErrorNotification(recentDecisions.error, {
    toastId: "admin-dashboard-decisions-load-error",
    fallbackMessage: "Unable to load recent administrative decisions. Please try again.",
  });
  useApiErrorNotification(platformOverview.error, {
    toastId: "admin-dashboard-platform-overview-load-error",
    fallbackMessage: "Unable to load the Dashboard platform overview. Please try again.",
  });
  useApiErrorNotification(priorityWorklist.error, {
    toastId: "admin-dashboard-priority-worklist-load-error",
    fallbackMessage: "Unable to load the Dashboard priority worklist. Please try again.",
  });

  return (
    <>
      {/* Page identity remains visible regardless of individual request state */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
          },
          {
            label: "Dashboard",
          },
        ]}
        title="Dashboard"
      />
      <div className="flex flex-col gap-6">
        {/* Independent resource boundaries; final widget replacement follows separately */}
        <DashboardQuerySection query={summary} label="Operational summary">
          {(data) => <MetricRow summary={data} />}
        </DashboardQuerySection>
        <DashboardQuerySection query={platformOverview} label="Platform overview">
          {(data) => <DiscoveryActivity overview={data} />}
        </DashboardQuerySection>
        <DashboardQuerySection query={recentDecisions} label="Recent administrative decisions">
          {(data) => <LowerDashboardSection recentDecisions={data} />}
        </DashboardQuerySection>
        {/* Temporary worklist load confirmation; item presentation follows separately */}
        <DashboardQuerySection query={priorityWorklist} label="Priority worklist">
          {() => (
            <p className="text-sm text-text-secondary">
              Priority worklist data is ready.
            </p>
          )}
        </DashboardQuerySection>
      </div>
    </>
  );
}
