import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { sectionQueryState } from "../utils/presentation";

/** Section-owned notifications supplement persistent report errors; no request coordination. */
export default function useAnalyticsSectionState(query, id, name) {
  const message = `Unable to load ${name}. Please try again.`;
  useApiErrorNotification(query.error, { toastId: `analytics-${id}-error`, fallbackMessage: message });
  return { ...sectionQueryState(query), errorMessage: message };
}
