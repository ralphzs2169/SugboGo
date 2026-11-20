import usePageLoadFailures from "../../components/usePageLoadFailures";
import { sectionQueryState } from "../utils/presentation";

/** Keeps report recovery local unless connectivity affects multiple page sections. */
export default function useAnalyticsSectionState(query, id, name) {
  const localFailures = usePageLoadFailures(id, [query]);

  return {
    ...sectionQueryState(query),
    pageLoadHandled: Boolean(query.error && !localFailures.length),
    errorMessage: `Unable to load ${name}. Please try again.`,
  };
}
