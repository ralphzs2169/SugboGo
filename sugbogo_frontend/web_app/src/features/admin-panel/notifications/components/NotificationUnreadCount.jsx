import DataErrorState from "@/shared/components/errors/DataErrorState";

/** Keep count failures recoverable without hiding the notification list. */
export default function NotificationUnreadCount({ query }) {
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
