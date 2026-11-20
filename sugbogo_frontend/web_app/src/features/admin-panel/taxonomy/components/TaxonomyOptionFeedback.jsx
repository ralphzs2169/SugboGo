import { LoadGroupFeedback } from "../../components/PageLoadFeedback";

export default function TaxonomyOptionFeedback({ query, label, queries = [] }) {
  if (query?.isPending && !query.error) {
    return (
      <p role="status" className="text-xs text-text-secondary">
        Loading {label.toLowerCase()} options…
      </p>
    );
  }

  if (query) {
    const options = `${label.toLowerCase()} options`;

    return (
      <LoadGroupFeedback
        queries={[query]}
        label={`${label} options`}
        retryLabel={`Retry ${options}`}
        errorMessage={`Unable to load ${options}.`}
        refreshMessage={`Unable to refresh ${options}. Showing previously loaded choices.`}
      />
    );
  }

  if (!queries.some((option) => option.error) && queries.some((option) => option.isPending)) {
    return (
      <p role="status" className="text-xs text-text-secondary">
        Loading filter options…
      </p>
    );
  }

  return (
    <LoadGroupFeedback
      queries={queries}
      label="Filter options"
      errorMessage="Some filter options couldn’t load."
      refreshMessage="Some filter options couldn’t refresh. Showing previously loaded choices."
      retryLabel="Retry options"
    />
  );
}
