import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

const TOAST_ID = "admin-dashboard-load-error";

/** Keep independent Dashboard failures in one page-scoped notification. */
export default function useDashboardErrorNotification(sources) {
  const previous = useRef([]);

  useEffect(() => {
    const failures = Object.entries(sources).filter(
      ([, query]) => query.error,
    );
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
      failures.length === 1
        ? failures[0][1].error.response?.data?.message
        : null
    );
    toast.error(message || (allCached
      ? "Some Dashboard data couldn't be refreshed. Previously loaded data is still available. Review the affected sections to retry."
      : "Some Dashboard data couldn't be loaded. Review the affected sections to retry."), { id: TOAST_ID });
  });

  useEffect(() => () => toast.dismiss(TOAST_ID), []);
}
