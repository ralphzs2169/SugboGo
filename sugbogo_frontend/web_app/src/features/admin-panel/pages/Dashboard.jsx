import { useState } from "react";
import {
  ArrowRight,
  ChartNoAxesCombined,
  ClipboardList,
  History,
  Info,
  ListChecks,
  Timer,
  Users,
} from "lucide-react";
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
import AnalyticsDetailDrawer from "../analytics/components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../analytics/components/AnalyticsExactTable";
import AnalyticsPeriodLabel from "../analytics/components/AnalyticsPeriodLabel";
import { formatCount } from "../analytics/utils/presentation";
import {
  activitySeries,
  platformActivityDays,
} from "../dashboard/utils/platformActivity";
import { dashboardInformation } from "../dashboard/utils/dashboardInformation";

/** Present real operational queues and concise context with independent query recovery and existing Admin styling. */
export default function Dashboard() {
  useDocumentTitle("Dashboard | SugboGo Admin");

  const [details, setDetails] = useState({
    title: "Platform Activity Trend",
    mode: null,
  });
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

  const activity = platformOverview.data?.activity;
  const rows = platformActivityDays(activity);
  const period = { start_date: rows?.[0]?.date, end_date: rows?.at(-1)?.date };
  const report = {
    series: rows,
    definitions: activity?.definitions,
    meta: { generated_at: platformOverview.data?.as_of, period },
  };
  function informationTrigger(title) {
    return (
      <button
        type="button"
        aria-label={`About ${title}`}
        aria-haspopup="dialog"
        onClick={() => setDetails({ title, mode: "about" })}
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
      >
        <Info aria-hidden="true" className="h-4 w-4" />
      </button>
    );
  }

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
    <div className="dashboard-contrast min-w-0 space-y-4">
      {/* Page identity remains visible regardless of individual request state */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageHeader title="Dashboard" />
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
      <PlatformOverviewKpis
        overview={platformOverview}
        summary={summary}
        informationAction={informationTrigger("Platform Overview")}
      />
      <DashboardQuerySection
        query={summary}
        label="Administrative Queues"
        informationAction={informationTrigger("Administrative Queues")}
        icon={ClipboardList}
        description="Open review workflows and pending cases. Categories may overlap."
        framed={false}
      >
        {(data) => <NeedsAttention summary={data} />}
      </DashboardQuerySection>

      {/* Seven-day activity beside current account composition */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
          <PlatformActivity
            query={platformOverview}
            onAbout={() =>
              setDetails({ title: "Platform Activity Trend", mode: "about" })
            }
            onData={() =>
              setDetails({ title: "Platform Activity Trend", mode: "data" })
            }
          />
        </div>
        <DashboardQuerySection
          query={platformOverview}
          label="User Distribution"
          informationAction={informationTrigger("User Distribution")}
          icon={Users}
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
            informationAction={informationTrigger("Priority Worklist")}
            icon={ListChecks}
            description="Up to 5 priority items · Overdue applications first · Manila time"
          >
            {(data) => <PriorityWorklist items={data.items} />}
          </DashboardQuerySection>
        </div>
        <DashboardQuerySection
          query={summary}
          label="Application Review Aging"
          informationAction={informationTrigger("Application Review Aging")}
          icon={Timer}
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
            informationAction={informationTrigger(
              "Recent Administrative Decisions",
            )}
            icon={History}
            description="Latest 5 administrative decisions · Manila time"
          >
            {(data) => <RecentDecisions items={data.items} />}
          </DashboardQuerySection>
        </div>
        <BusinessHealth
          canViewScores={canViewScores}
          informationAction={informationTrigger("Discovery Score Health")}
        />
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
      {/* The existing Analytics drawer serves every Dashboard explanation and the activity's exact data. */}
      <AnalyticsDetailDrawer
        className="dashboard-contrast"
        mode={details?.mode}
        title={details?.title ?? "Platform Activity Trend"}
        onClose={() => setDetails((current) => ({ ...current, mode: null }))}
        report={report}
        interval="daily"
        series={activitySeries}
        showComparison={false}
        periodContent={
          details?.title === "Platform Activity Trend" ? (
            <div className="space-y-1 text-xs text-text-secondary">
              <AnalyticsPeriodLabel period={period} />
              <p>Asia/Manila · Start inclusive · End exclusive</p>
              <p>
                Through {formatTimestamp(activity?.window?.end_exclusive)} PHT
                {activity?.window?.includes_partial_day
                  ? " · Today is partial"
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              Dashboard section information
            </p>
          )
        }
        aboutContent={
          <div className="space-y-4 text-sm text-text-secondary">
            {/* Match Analytics' icon-led explanations without adding another help surface. */}
            {dashboardInformation[details?.title]?.map(
              ({ icon: Icon, heading, text, definition }) => (
                <div key={heading}>
                  <h3 className="mb-1 flex items-center gap-2 font-semibold text-text-primary">
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {heading}
                  </h3>
                  <p>
                    {definition
                      ? (activity?.definitions?.[definition] ??
                        "Definition unavailable.")
                      : text}
                  </p>
                </div>
              ),
            )}
          </div>
        }
        dataContent={
          rows ? (
            <AnalyticsExactTable
              caption="Exact platform activity counts by Manila date"
              rows={rows}
              columns={[
                { key: "date", label: "Date" },
                ...activitySeries.map(({ key, label }) => ({
                  key,
                  label,
                  render: (row) => formatCount(row[key]),
                })),
              ]}
            />
          ) : (
            <p>Daily activity is unavailable.</p>
          )
        }
      />
    </div>
  );
}
