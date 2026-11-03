import { Bookmark, Eye, Info, MessageSquare, ShieldCheck } from "lucide-react";
import MetricCard from "@/features/admin-panel/components/MetricCard";
import Tooltip from "@/shared/components/actions/Tooltip";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

/** Present exactly four server-owned metrics with visits availability isolated to its card. */
export default function BusinessDetailMetrics({ business, visits }) {
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
      <MetricCard
        title="Current specialty vouches"
        value={business.current_specialty_vouch_count}
        wrapTitle
        icon={ShieldCheck}
        footerValue="Valid support for current specialties"
        context={
          business.current_specialty_support?.length > 0 && (
            <ul className="space-y-1 text-xs">
              {business.current_specialty_support.map((tag) => (
                <li
                  key={tag.specialty_id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <SpecialtyTagChip
                    tag={{
                      ...business.specialty_tags?.find(
                        (specialty) => specialty.id === tag.specialty_id,
                      ),
                      name: tag.specialty_name,
                    }}
                    size="small"
                    showIcon
                  />
                  <span className="font-semibold text-text-primary">
                    {tag.valid_vouches}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      />
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
