import { useId } from "react";
import { Clock3, Info } from "lucide-react";
import { OperationsHelp } from "./OperationsStats";
import { formatCount } from "../utils/presentation";

/** Keeps exact decision counts primary; percentages describe only approved + rejected. */
function DecisionOutcome({ value, total, approved = false }) {
  const percentage = total > 0 && value != null ? value / total * 100 : null;
  return (
    <div>
      <p className="font-semibold tabular-nums text-text-primary">{formatCount(value)}</p>
      {value != null && total != null && (
        <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${approved ? "bg-success/75" : "bg-danger/75"}`} style={{ width: `${percentage ?? 0}%` }} />
        </div>
      )}
      {percentage !== null && <p className="mt-1 text-xs tabular-nums text-text-secondary">{Math.round(percentage)}% of decisions</p>}
    </div>
  );
}

/** Presents selected-period outcomes without combining merchant actions with review decisions. */
export default function ChangeRequestOutcomes({ types }) {
  const headingId = useId();
  return (
    <div className="mt-5 border-t border-stroke pt-4">
      {/* Subsection context and named, keyboard-scrollable comparison table. */}
      <h3 id={headingId} className="text-sm font-semibold text-text-primary">Outcomes by request type</h3>
      <p className="mb-4 mt-1 text-xs text-text-secondary">Compare administrator decisions and merchant withdrawals by request type.</p>
      <div role="region" aria-labelledby={headingId} tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border border-stroke focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Selected-period outcomes by request type. Administrator-decision percentages exclude merchant withdrawals.</caption>
          <colgroup><col className="w-[37%]" /></colgroup>
          <colgroup><col className="w-[21%]" /><col className="w-[21%]" /></colgroup>
          <colgroup><col className="w-[21%]" /></colgroup>
          {/* Group headers preserve the distinction between review and merchant actions. */}
          <thead className="border-b border-stroke bg-surface-muted/60">
            <tr className="text-xs text-text-secondary">
              <th scope="col" rowSpan={2} className="px-4 py-3 font-semibold">Request type</th>
              <th scope="colgroup" colSpan={2} className="border-l border-stroke px-4 pt-2 font-semibold">
                <span className="inline-flex items-center gap-1">
                  Administrator decisions
                  <OperationsHelp label="About administrator decisions">Percentages use approved + rejected for each request type. Merchant withdrawals are excluded. These describe recorded counts, including small samples.</OperationsHelp>
                </span>
              </th>
              <th scope="colgroup" className="border-l border-stroke px-4 pt-2 font-semibold">
                <span className="inline-flex items-center gap-1">
                  Merchant action
                  <OperationsHelp label="About merchant withdrawals">Withdrawn reflects merchant action, not administrator review.</OperationsHelp>
                </span>
              </th>
            </tr>
            <tr className="text-text-primary">
              <th scope="col" className="border-l border-stroke px-4 pb-3 pt-1 font-medium">Approved</th>
              <th scope="col" className="px-4 pb-3 pt-1 font-medium">Rejected</th>
              <th scope="col" className="border-l border-stroke px-4 pb-3 pt-1 font-medium">Withdrawn</th>
            </tr>
          </thead>
          {/* Exact counts remain readable independently of decorative bars and semantic color. */}
          <tbody className="divide-y divide-stroke text-text-primary">
            {types.map((row) => {
              const approved = row.period_outcomes?.approved;
              const rejected = row.period_outcomes?.rejected;
              const total = Number.isFinite(approved) && approved >= 0 && Number.isFinite(rejected) && rejected >= 0
                ? approved + rejected
                : null;
              return (
                <tr key={row.type}>
                  <th scope="row" className="break-words px-4 py-4 font-medium">{row.label}</th>
                  <td className="border-l border-stroke px-4 py-4 align-middle"><DecisionOutcome value={approved} total={total} approved /></td>
                  <td className="px-4 py-4 align-middle"><DecisionOutcome value={rejected} total={total} /></td>
                  <td className="border-l border-stroke px-4 py-4 align-middle">
                    <div className="inline-flex min-w-20 items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 font-semibold tabular-nums text-warning">
                      <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{formatCount(row.period_outcomes?.withdrawn)}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">withdrawn</p>
                  </td>
                </tr>
              );
            })}
            {!types.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">No request-type observations available.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* A single concise note reinforces the merchant-action scope. */}
      <p className="mt-2 flex items-start gap-2 border-t border-stroke pt-2 text-xs text-text-secondary">
        <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
        Withdrawn reflects merchant action, not administrator review.
      </p>
    </div>
  );
}
