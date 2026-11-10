import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

const TOAST_ID = "admin-notification-load-error";

/** Summarize load failures once for the active notification surface, as Dashboard does. */
export default function useNotificationLoadError(sources, enabled = true) {
  const previous = useRef([]);
  useEffect(() => {
    if (!enabled) return;
    const failures = Object.entries(sources).filter(([, query]) => query.error);
    const unchanged = failures.length === previous.current.length && failures.every(
      ([name, query], index) => previous.current[index]?.[0] === name &&
        previous.current[index]?.[1] === query.error,
    );
    if (unchanged) return;
    previous.current = failures.map(([name, query]) => [name, query.error]);
    if (!failures.length) {
      toast.dismiss(TOAST_ID);
      return;
    }
    const authorization = failures.find(([, query]) =>
      [401, 403].includes(query.error.response?.status),
    );
    const allCached = failures.every(([, query]) => query.data != null);
    const message = authorization?.[1].error.response?.data?.message ?? (
      failures.length === 1 ? failures[0][1].error.response?.data?.message : null
    );
    toast.error(message || (allCached
      ? "Notifications couldn't be refreshed. Previously loaded data is still available."
      : "Notifications couldn't be loaded. Please try again."), { id: TOAST_ID });
  });
  useEffect(() => {
    if (!enabled) return;
    return () => toast.dismiss(TOAST_ID);
  }, [enabled]);
}
