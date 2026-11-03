import { Link } from "react-router-dom";
import { History } from "lucide-react";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatLabel } from "@/shared/utils/stringUtils";
import { formatBusinessDateTime } from "../../utils/businessDetailPresentation";

/** Present recorded lifecycle transitions as a timeline while preserving pagination and request navigation. */
export default function BusinessAdministrativeHistory({ businessId, history }) {
  const records = [
    ...new Map(
      (history.data?.pages ?? [])
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Administrative History & Requests
        </h2>
        <Link
          to={
            "/admin-panel/businesses/update-requests?business_id=" +
            businessId +
            "&type=all&status=all"
          }
          className="cursor-pointer text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-info"
        >
          View Update Requests
        </Link>
      </div>
      <div className="p-5">
        {/* Recorded status transitions */}
        {history.isPending && (
          <p role="status" className="text-sm text-text-secondary">
            Loading status history…
          </p>
        )}
        {!history.isPending && !history.error && !records.length && (
          <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
              <History
                aria-hidden="true"
                size={20}
                strokeWidth={1.75}
                className="text-text-secondary"
              />
            </div>
            <p className="mt-3 text-sm font-medium text-text-primary">
              No recorded status transitions.
            </p>
          </div>
        )}
        {!!records.length && (
          <ol className="max-w-3xl">
            {records.map((record) => (
              <li
                key={record.id}
                className="relative min-w-0 pb-6 pl-7 before:absolute before:-bottom-4 before:left-1 before:top-4 before:w-px before:bg-stroke last:pb-0 last:before:hidden"
              >
                <span
                  aria-hidden="true"
                  className={
                    "absolute left-0 top-3 h-2 w-2 rounded-full ring-4 ring-background " +
                    (record.status === "suspended" ? "bg-warning" : "bg-success")
                  }
                />
                <StatusBadge
                  variant={
                    record.status === "suspended"
                      ? "warningSoft"
                      : "successSoft"
                  }
                >
                  {record.status === "suspended"
                    ? "Suspended"
                    : record.status === "active"
                      ? "Reactivated"
                      : record.status}
                </StatusBadge>
                {record.previous_status && (
                  <p className="mt-2 break-words text-sm font-medium text-text-primary">
                    {formatLabel(record.previous_status)} →{" "}
                    {formatLabel(record.status)}
                  </p>
                )}
                <p className="mt-2 break-words text-xs text-text-secondary">
                  {formatBusinessDateTime(record.created_at)} · PHT · by{" "}
                  {record.actor_name || "Administrator unavailable"}
                </p>
                {record.status === "suspended" && record.reason && (
                  <div className="mt-3 min-w-0">
                    <p className="text-xs font-medium text-text-secondary">Reason</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
                      {record.reason}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {/* Local errors and standard server pagination */}
        {history.error && (
          <DataErrorState
            compact
            title="Status history unavailable"
            message={
              records.length
                ? "Previously loaded transitions remain visible."
                : "Status history could not be loaded. Please retry."
            }
            retryLabel="Retry history"
            onRetry={() =>
              history.isFetchNextPageError
                ? history.fetchNextPage()
                : history.refetch()
            }
            retrying={history.isFetching}
          />
        )}
        {history.hasNextPage && !history.error && (
          <div className="mt-4 border-t border-stroke pt-4">
            <Button
              variant="secondary"
              onClick={() => history.fetchNextPage()}
              loading={history.isFetchingNextPage}
            >
              Show more history
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
