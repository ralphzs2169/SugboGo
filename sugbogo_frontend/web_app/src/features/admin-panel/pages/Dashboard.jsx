import { ArrowRight, ChartNoAxesCombined } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import navigation from "../config/sidebarNavigation";
import { formatTimestamp } from "../analytics/utils/presentation";
import NeedsAttention from "../dashboard/components/NeedsAttention";
import PriorityWorklist from "../dashboard/components/PriorityWorklist";
import ApplicationReviewAging from "../dashboard/components/ApplicationReviewAging";
import PlatformOverviewKpis from "../dashboard/components/PlatformOverviewKpis";
import PlatformActivity from "../dashboard/components/PlatformActivity";
import UserDistribution from "../dashboard/components/UserDistribution";
import BusinessHealth from "../dashboard/components/BusinessHealth";
import RecentDecisions from "../dashboard/components/RecentDecisions";
import DashboardQuerySection from "../dashboard/components/DashboardQuerySection";
import {
  dashboardLinkClass,
  latestDashboardTimestamp,
} from "../dashboard/utils/dashboardPresentation";
import {
  useDashboardPlatformOverview,
  useDashboardPriorityWorklist,
  useDashboardRecentDecisions,
  useDashboardSummary,
} from "../dashboard/hooks/useDashboardQueries";
import PageHeader from "../components/PageHeader";

/** Present real operational queues and concise context with independent query recovery and existing Admin styling. */
export default function Dashboard() {
  useDocumentTitle("Dashboard | SugboGo Admin");

  const summary = useDashboardSummary();
  const recentDecisions = useDashboardRecentDecisions();
  const platformOverview = useDashboardPlatformOverview();
  const priorityWorklist = useDashboardPriorityWorklist();
  const role = useAuthStore((state) => state.user?.role);
  const links = navigation.flatMap((section) => section.items);
  const canViewAnalytics = links
    .find((item) => item.to === "/admin-panel/analytics")
    ?.roles.includes(role);
  const canViewScores = links
    .find((item) => item.to === "/admin-panel/analytics/discovery-scores")
    ?.roles.includes(role);
  const updatedAt = latestDashboardTimestamp(
    summary.data?.as_of,
    platformOverview.data?.as_of,
    priorityWorklist.data?.as_of,
  );

  useApiErrorNotification(summary.error, {
    toastId: "admin-dashboard-summary-load-error",
    fallbackMessage:
      "Unable to load the Dashboard operational summary. Please try again.",
  });
  useApiErrorNotification(recentDecisions.error, {
    toastId: "admin-dashboard-decisions-load-error",
    fallbackMessage:
      "Unable to load recent administrative decisions. Please try again.",
  });
  useApiErrorNotification(platformOverview.error, {
    toastId: "admin-dashboard-platform-overview-load-error",
    fallbackMessage:
      "Unable to load the Dashboard platform overview. Please try again.",
  });
  useApiErrorNotification(priorityWorklist.error, {
    toastId: "admin-dashboard-priority-worklist-load-error",
    fallbackMessage:
      "Unable to load the Dashboard priority worklist. Please try again.",
  });

  return (
    <div className="min-w-0 space-y-4">
      {/* Page identity remains visible regardless of individual request state */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageHeader
            breadcrumbs={[{ label: "SugboGo Admin" }, { label: "Dashboard" }]}
            title="Dashboard"
          />
          <p className="text-sm text-text-secondary">
            Platform operations overview
          </p>
        </div>
        {updatedAt && (
          <p className="text-xs leading-relaxed text-text-secondary sm:text-right">
            Latest source update{" "}
            <time dateTime={updatedAt}>{formatTimestamp(updatedAt)}</time> ·
            Manila
            <span className="block">Sections refresh independently.</span>
          </p>
        )}
      </div>

      {/* Period KPIs and current inventory remain separate from pending queues */}
      <PlatformOverviewKpis overview={platformOverview} summary={summary} />
      <DashboardQuerySection
        query={summary}
        label="Administrative Queues"
        description="Open review workflows and pending cases. Categories may overlap."
        framed={false}
      >
        {(data) => <NeedsAttention summary={data} />}
      </DashboardQuerySection>

      {/* Seven-day activity beside current account composition */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
          <PlatformActivity query={platformOverview} />
        </div>
        <DashboardQuerySection
          query={platformOverview}
          label="User Distribution"
          description="Registered accounts by role"
        >
          {(data) => <UserDistribution distribution={data.user_distribution} />}
        </DashboardQuerySection>
      </div>

      {/* Mixed pending work keeps its backend ordering and dedicated workflow links */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
          <DashboardQuerySection
            query={priorityWorklist}
            label="Priority Worklist"
            description="Pending work, with overdue applications first. Times shown in Manila."
          >
            {(data) => <PriorityWorklist items={data.items} />}
          </DashboardQuerySection>
        </div>
        <DashboardQuerySection
          query={summary}
          label="Application Review Aging"
          description="Submitted applications · Elapsed weekdays"
        >
          {(data) => (
            <ApplicationReviewAging
              aging={data.applications?.aging}
              pendingReview={data.applications?.pending_review}
              onRetry={() => summary.refetch()}
              retrying={summary.isFetching}
            />
          )}
        </DashboardQuerySection>
      </div>

      {/* Persisted decisions and score markers describe separate operational concerns */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
          <DashboardQuerySection
            query={recentDecisions}
            label="Recent Administrative Decisions"
            description="Latest five supported recorded decisions · current entity labels"
          >
            {(data) => <RecentDecisions items={data.items} />}
          </DashboardQuerySection>
        </div>
        <BusinessHealth summary={summary} canViewScores={canViewScores} />
      </div>

      {/* The existing navigation policy controls the Analytics entry point */}
      {canViewAnalytics && (
        <Link
          to="/admin-panel/analytics"
          className={`${dashboardLinkClass} flex items-center justify-between gap-4 rounded-xl border border-stroke bg-background p-4 hover:bg-surface-hover sm:p-5`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <ChartNoAxesCombined
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-text-secondary"
            />
            <div>
              <span className="block text-base font-semibold">
                Explore detailed Analytics
              </span>
              <span className="mt-1 block text-xs font-normal text-text-secondary">
                Performance, discovery, onboarding trends, and reports.
              </span>
            </div>
          </div>
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}
