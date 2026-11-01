import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount, formatTimestamp } from "../../analytics/utils/presentation";
import { dashboardLinkClass, workItemDestination, workItemLabels, workItemStatus } from "../utils/dashboardPresentation";

/** Render the server's bounded pending-work order, preserving overlapping workflows and unknown ages. */
export default function PriorityWorklist({ items }) {
  if (!items) {
    return <p className="py-4 text-sm text-text-secondary">Worklist data is unavailable.</p>;
  }
  if (items.length === 0) {
    return <p className="py-6 text-sm text-text-secondary">No pending work. Your queues are clear.</p>;
  }

  return (
    <table className="w-full table-fixed text-left text-xs">
      {/* Compact columns wrap within the page instead of creating a nested scroll area */}
      <caption className="sr-only">Priority pending work, in server-defined order</caption>
      <thead className="border-b border-stroke text-text-secondary">
        <tr>
          <th scope="col" className="w-[38%] pb-2 pr-2 font-medium">Entity</th>
          <th scope="col" className="w-[23%] pb-2 pr-2 font-medium">Type</th>
          <th scope="col" className="w-[25%] pb-2 pr-2 font-medium">Status / Priority</th>
          <th scope="col" className="w-[14%] pb-2 text-right font-medium">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stroke">
        {items.map((item) => {
          const label = workItemLabels[item.type] ?? "Pending work";
          const destination = workItemDestination(item.type, item.entity?.id);
          const marker = item.priority === "overdue" ? "bg-danger" : item.priority === "approaching" ? "bg-warning" : null;
          return (
            <tr key={item.id}>
              <td className="py-3 pr-2 align-top [overflow-wrap:anywhere]">
                <span className="font-medium text-text-primary">{item.entity?.label ?? item.title}</span>
                {item.timestamp && <time dateTime={item.timestamp} className="mt-1 block text-text-secondary">{formatTimestamp(item.timestamp)}</time>}
                {!item.timestamp && <span className="mt-1 block text-text-secondary">Queue time unavailable</span>}
              </td>
              <td className="py-3 pr-2 align-top text-text-secondary [overflow-wrap:anywhere]">{label}</td>
              <td className="py-3 pr-2 align-top [overflow-wrap:anywhere]">
                <span className="font-medium text-text-primary">
                  {marker && <span aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${marker}`} />}
                  {workItemStatus(item)}
                </span>
                {item.pending_report_count != null && <span className="mt-1 block text-text-secondary">{formatCount(item.pending_report_count)} pending {item.pending_report_count === 1 ? "report" : "reports"}</span>}
              </td>
              <td className="py-1 text-right align-top">
                {destination ? (
                  <Link to={destination} aria-label={`Review ${label.toLowerCase()}: ${item.entity?.label ?? item.title}`} className={`${dashboardLinkClass} inline-flex min-h-11 min-w-10 items-center justify-end gap-1`}>
                    <span className="hidden lg:inline">Review</span>
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </Link>
                ) : <span className="text-text-secondary">Unavailable</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
