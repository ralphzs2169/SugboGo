import DataErrorState from "@/shared/components/errors/DataErrorState";

/** Keep count failures recoverable without hiding the notification list. */
export default function NotificationUnreadCount({ query, suppressed = false }) {
  if (suppressed) return null;
  if (query.error && !query.data) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <span>Unread count unavailable</span>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-busy={query.isFetching}
          className="cursor-pointer rounded-md px-2 py-1 font-medium text-primary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-info disabled:opacity-60"
        >
          {query.isFetching ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }
  return (
    <div>
      <p aria-live="polite" className="text-sm text-text-secondary">
        {query.data
          ? `${query.data.unread_count} unread`
          : query.isPending ? "Loading unread count…" : "Unread count unavailable"}
      </p>
      {query.error && (
        <DataErrorState
          compact
          title="Unread count unavailable"
          message="The unread count could not be refreshed. Please try again."
          retainedData={Boolean(query.data)}
          refreshLabel="Unread count"
          onRetry={() => query.refetch()}
          retryLabel="Retry"
          retrying={query.isFetching}
        />
      )}
    </div>
  );
}
