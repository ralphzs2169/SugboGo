import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

/** Keep reference failures independent of the form or directory using them. */
export default function TaxonomyOptionFeedback({
  query,
  resource,
  label,
}) {
  useApiErrorNotification(query.error, {
    toastId: `taxonomy-${resource}-options-error`,
    fallbackMessage: `Unable to load ${label.toLowerCase()} options.`,
  });

  if (query.error) {
    return (
      <DataErrorState
        compact
        framed
        title={`Unable to load ${label.toLowerCase()} options`}
        message="Your current values are preserved. Retry to load these choices."
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
        retryLabel={`Retry ${label.toLowerCase()} options`}
      />
    );
  }

  if (query.isPending) {
    return (
      <p role="status" className="text-xs text-text-secondary">
        Loading {label.toLowerCase()} options…
      </p>
    );
  }

  return null;
}
