import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { DashboardPreviewContext } from "./DashboardPreviewContext";
import { createPreviewData, previewData } from "./dashboardPreviewData";

const RESOURCES = {
  summary: "Overview inventory / queues / aging",
  platformOverview: "Accounts / activity / user distribution",
  priorityWorklist: "Priority Worklist",
  recentDecisions: "Recent Decisions",
  scores: "Discovery Score Health",
};
const COMMON = [
  ["live", "Live data (preview off)"],
  ["populated", "Populated sample"],
  ["loading", "Initial loading"],
  ["unavailable", "Unavailable / missing fields"],
  ["offline", "No internet"],
  ["timeout", "Request timeout"],
  ["error", "Server error (500)"],
  ["unauthorized", "Expired session response (401)"],
  ["forbidden", "Permission error (403)"],
  ["not-found", "Not found (404)"],
  ["rate-limit", "Rate limited (429)"],
  ["refreshing", "Background refresh"],
  ["background-error", "Refresh failed / cached data"],
  ["retrying", "Retry in progress"],
  ["empty", "Empty / all zero"],
  ["single", "One list item"],
  ["stale", "Old source timestamp"],
];
const EXTRA = {
  summary: [["zero-active", "No active businesses"], ["single-status", "100% active businesses"], ["on-time", "All applications on time"], ["approaching", "All approaching deadline"], ["overdue", "All overdue"], ["unknown-age", "All ages unknown"], ["invalid-aging", "Aging totals do not reconcile"]],
  platformOverview: [["zero-active", "No active accounts"], ["single-status", "100% one role / active"], ["sparse", "Sparse chart"], ["missing-chart", "Missing chart buckets"], ["missing-comparison", "Missing comparisons"], ["increase", "Increasing activity"], ["decrease", "Declining activity"], ["unchanged", "No activity change"], ["large-counts", "Large activity counts"]],
  priorityWorklist: [["long-labels", "Long / unusual names"], ["deleted", "Missing entities / queue times"]],
  recentDecisions: [["long-labels", "Long names / administrator"], ["deleted", "Missing entities / actors / times"]],
  scores: [["all-fresh", "All scores fresh"], ["score-alerts", "Overlapping score alerts"]],
};
const FAILURE = {
  offline: [0, "NETWORK_ERROR", "Preview: no internet connection. Please try again."],
  timeout: [0, "REQUEST_TIMEOUT", "Preview: the request timed out."],
  error: [500, "SERVER_ERROR", "Preview: this Dashboard source is unavailable."],
  unauthorized: [401, "NOT_AUTHENTICATED", "Preview: the session has expired. No actual session changes are made."],
  forbidden: [403, "PERMISSION_DENIED", "Preview: permission denied for this source."],
  "not-found": [404, "NOT_FOUND", "Preview: the requested resource was not found."],
  "rate-limit": [429, "RATE_LIMIT_EXCEEDED", "Preview: too many requests. Try again later."],
};
const FAILURE_ERRORS = Object.fromEntries(Object.entries(FAILURE).map(([state, failure]) => [
  state,
  Object.assign(new Error(failure[2]), {
    response: { status: failure[0], data: { success: false, code: failure[1], message: failure[2] } },
  }),
]));
const initialStates = () => Object.fromEntries(Object.keys(RESOURCES).map((key) => [key, "live"]));
const controlClass = "min-h-9 rounded-md border border-stroke bg-background px-2 py-1 text-xs text-text-primary focus-visible:outline-2 focus-visible:outline-info";

/** Provide explicitly selected sample query states only in the development bundle. */
export default function DashboardPreview({ children }) {
  const [states, setStates] = useState(initialStates);
  const [base] = useState(createPreviewData);
  const active = Object.values(states).some((state) => state !== "live");
  const value = useMemo(() => {
    const queries = {};
    for (const [resource, state] of Object.entries(states)) {
      if (state === "live") continue;
      const error = FAILURE_ERRORS[state] ?? (["background-error", "retrying"].includes(state) ? FAILURE_ERRORS.error : null);
      const hasData = !FAILURE[state] && !["loading", "retrying"].includes(state);
      const data = hasData ? previewData(base, resource, state) : undefined;
      queries[resource] = {
        data,
        error,
        isLoading: state === "loading",
        isPending: data === undefined && !error,
        isFetching: ["loading", "refreshing", "retrying"].includes(state),
        refetch: async () => {
          // Recovery stays local: no API requests, cache writes, or administrative actions.
          setStates((current) => ({ ...current, [resource]: "populated" }));
          return { data: base[resource], error: null };
        },
      };
    }
    return { queries };
  }, [base, states]);

  function preset(state) {
    setStates(Object.fromEntries(Object.keys(RESOURCES).map((key) => [key, state])));
  }

  return (
    <DashboardPreviewContext.Provider value={value}>
      {/* These controls are dynamically imported only for Vite development sessions. */}
      <details className="mb-4 rounded-xl border border-stroke bg-background p-3 text-text-primary">
        <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-info">
          <FlaskConical aria-hidden="true" className="mr-2 inline h-4 w-4" />
          Development preview {active ? "— sample states active" : "— off"}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-text-secondary">
            Synthetic data only. Each source can be previewed separately. Retry restores that source’s populated sample.
            Previewed sources do not fetch or write cached data. Live sources and the surrounding admin shell still use the network.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              Apply to every section
              <select className={controlClass} value="" onChange={(event) => preset(event.target.value)}>
                <option value="" disabled>Choose a state…</option>
                {COMMON.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <button type="button" className={`${controlClass} cursor-pointer hover:bg-surface-hover`} onClick={() => preset("live")}>Return all to live</button>
            <button type="button" className={`${controlClass} cursor-pointer hover:bg-surface-hover`} onClick={() => setStates({ summary: "error", platformOverview: "populated", priorityWorklist: "single", recentDecisions: "empty", scores: "offline" })}>Mixed failures</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(RESOURCES).map(([resource, label]) => (
              <label key={resource} className="flex min-w-0 flex-col gap-1 text-xs">
                {label}
                <select className={controlClass} value={states[resource]} onChange={(event) => setStates((current) => ({ ...current, [resource]: event.target.value }))}>
                  {[...COMMON, ...(EXTRA[resource] ?? [])].map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </select>
              </label>
            ))}
          </div>
          {active && <p role="status" className="text-xs font-medium">Preview active. Dashboard links are disabled to avoid opening real records from sample data. Information drawers and chart controls remain usable.</p>}
        </div>
      </details>
      {/* Leave the actual Dashboard presentation and section recovery controls mounted. */}
      <div onClickCapture={(event) => {
        if (active && event.target instanceof Element && event.target.closest("a")) {
          event.preventDefault();
          event.stopPropagation();
        }
      }} onContextMenuCapture={(event) => {
        if (active && event.target instanceof Element && event.target.closest("a")) event.preventDefault();
      }} onDragStartCapture={(event) => {
        if (active && event.target instanceof Element && event.target.closest("a")) event.preventDefault();
      }} onAuxClickCapture={(event) => {
        if (active && event.target instanceof Element && event.target.closest("a")) event.preventDefault();
      }}>
        {children}
      </div>
    </DashboardPreviewContext.Provider>
  );
}
