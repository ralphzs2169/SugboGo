import { formatTimestamp } from "../utils/presentation";
import { Shield } from "lucide-react";
import { reliabilityMessages } from "../utils/reliabilityPresentation";

/** Separates report updates, source availability and confirmed capture information. */
export default function AnalyticsReliability({ meta, title, snapshotAt }) {
  if (!meta && !snapshotAt) return null;
  return (
    <div className="space-y-2 text-sm text-text-secondary">
      {/* Reliability messages reflect metadata rather than inferring capture from updates. */}
      <h3 className="flex items-center gap-2 font-semibold text-text-primary"><Shield aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />Data reliability</h3>
      <p>Last updated: {formatTimestamp(meta?.generated_at ?? snapshotAt)} Philippine time.</p>
      <p>Latest confirmed data: {meta?.data_through ? `${formatTimestamp(meta.data_through)} Philippine time` : "Not available. The latest fully captured date has not been confirmed."}</p>
      {reliabilityMessages(meta, title).map((message) => <p key={message}>{message}</p>)}
    </div>
  );
}
