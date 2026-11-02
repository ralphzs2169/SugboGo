import { Link } from "react-router-dom";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatBusinessDateTime } from "../../utils/businessDetailPresentation";

/** Inspect paginated private transitions and navigate to existing business-scoped requests. */
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
          <p className="text-sm text-text-secondary">
            No recorded status transitions.
          </p>
        )}
        {!!records.length && (
          <ol className="divide-y divide-stroke">
            {records.map((record) => (
              <li key={record.id} className="py-4 first:pt-0 last:pb-0">
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
                <p className="mt-2 break-words text-xs text-text-secondary">
                  {formatBusinessDateTime(record.created_at)} · PHT · by{" "}
                  {record.actor_name || "Administrator unavailable"}
                </p>
                {record.status === "suspended" && record.reason && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">
                    <span className="font-semibold">Reason: </span>
                    {record.reason}
                  </p>
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
