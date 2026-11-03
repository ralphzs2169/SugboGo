import { Bookmark, Eye, Info, MessageSquare, ShieldCheck } from "lucide-react";
import MetricCard from "@/features/admin-panel/components/MetricCard";
import Tooltip from "@/shared/components/actions/Tooltip";
import SpecialtyTagChip, { colorClasses } from "@/shared/components/SpecialtyTagChip";

/** Present exactly four server-owned metrics with visits availability isolated to its card. */
export default function BusinessDetailMetrics({ business, visits }) {
  const support = business.current_specialty_support ?? [];
  const largestCount = Math.max(1, ...support.map((tag) => tag.valid_vouches));
  const report = visits.data;
  const visitCount =
    !visits.error && report?.meta?.availability !== "unavailable"
      ? report?.totals?.profile_visits
      : null;
  const coverage =
    "Recorded business profile visits over the last 30 days. " +
    "Not physical foot traffic. Tracking coverage and freshness are not verified.";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Current relational metrics */}
      <div className="@container min-w-0 [&>div]:h-full">
        <MetricCard
          title="Current specialty vouches"
          wrapTitle
          icon={ShieldCheck}
          value={
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] items-center gap-3 @max-[260px]:grid-cols-1">
              <div className="min-w-0">
                <p className="text-4xl font-semibold tabular-nums">
                  {business.current_specialty_vouch_count}
                </p>
                <p className="mt-1 text-xs font-normal leading-snug tracking-normal text-text-secondary">
                  Valid support for current specialties
                </p>
              </div>
              <ul className="min-w-0 space-y-3 border-l border-stroke pl-3 text-xs font-normal tracking-normal @max-[260px]:border-l-0 @max-[260px]:border-t @max-[260px]:pl-0 @max-[260px]:pt-3">
                {support.map((tag) => {
                  const specialty = business.specialty_tags?.find(
                    (item) => item.id === tag.specialty_id,
                  );
                  const palette = colorClasses[specialty?.color] ?? colorClasses.blue;
                  const textColor = palette.split(" ").find(
                    (className) => className.startsWith("text-"),
                  );
                  return (
                    <li
                      key={tag.specialty_id}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(24px,1fr)_auto] items-center gap-2"
                    >
                      <div className="min-w-0 [&>span]:max-w-full [&>span>span]:truncate" title={tag.specialty_name}>
                        <SpecialtyTagChip
                          tag={{ ...specialty, name: tag.specialty_name }}
                          size="small"
                        />
                      </div>
                      <div className={`h-2 overflow-hidden rounded-full bg-surface-muted ${textColor}`} aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-current"
                          style={{ width: `${(tag.valid_vouches / largestCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-right text-xs font-semibold tabular-nums text-text-primary">
                        {tag.valid_vouches}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          }
        />
      </div>
      <MetricCard
        title="Published reviews"
        value={business.published_review_count}
        icon={MessageSquare}
        footerValue="Currently published reviews · All time"
      />
      <MetricCard
        title="Currently saved"
        value={business.current_saved_count}
        icon={Bookmark}
        footerValue="Accounts with this business in a Pocket"
      />
      {/* Optional recorded profile activity */}
      <MetricCard
        title="Profile visits"
        value={visitCount}
        icon={Eye}
        footerValue="Last 30 days"
        unavailableLabel={visits.isPending ? "Loading…" : "Unavailable"}
        headerAction={
          <Tooltip
            content={coverage}
            asChild
            place="bottom"
            className="!z-50 !w-max !max-w-[min(18rem,calc(100vw-2rem))] !whitespace-normal !break-words !px-3 !py-2 !text-left !leading-relaxed shadow-lg"
          >
            <button
              type="button"
              aria-label="About recorded profile visits"
              className="cursor-pointer rounded p-1 text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
            >
              <Info size={14} aria-hidden="true" />
            </button>
          </Tooltip>
        }
        context={
          <div className="text-xs">
            {report?.meta?.generated_at && (
              <p className="sr-only">
                Analytics queried at {report.meta.generated_at}
              </p>
            )}
            {!visits.isPending && (visitCount == null || visits.error) && (
              <button
                type="button"
                onClick={() => visits.refetch()}
                disabled={visits.isFetching}
                className="cursor-pointer font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {visits.isFetching ? "Retrying…" : "Retry profile visits"}
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}
