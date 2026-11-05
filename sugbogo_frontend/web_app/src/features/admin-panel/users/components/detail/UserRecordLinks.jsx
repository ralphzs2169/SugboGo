import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

/** Links existing records to their supported Admin inspection destinations. */
export default function UserRecordLinks({ data = {}, children }) {
  const links = [];
  const records = [];

  for (const [field, label] of [
    ["report_id", "Report"],
    ["review_id", "Review"],
    ["dispute_id", "Dispute"],
    ["application_id", "Application"],
    ["vouch_id", "Vouch"],
  ]) {
    if (data[field]) records.push(`${label} #${data[field]}`);
  }
  if (data.business_id) {
    records.push(data.business_name || `Business #${data.business_id}`);
  }

  if (data.dispute_id) {
    links.push({
      label: "View dispute",
      to: `/admin-panel/moderation-integrity?tab=disputes&dispute_id=${data.dispute_id}`,
    });
  }

  if (data.report_id && data.review_id) {
    links.push({
      label: "View reported review",
      to: `/admin-panel/moderation-integrity?tab=reported&reported_id=${data.review_id}`,
    });
  }

  if (data.review_id) {
    links.push({
      label: "View review",
      to: `/admin-panel/reviews?review_id=${data.review_id}`,
    });
  }

  if (data.application_id) {
    links.push({
      label: "View application",
      to: `/admin-panel/business/application/${data.application_id}`,
    });
  }

  if (data.business_id) {
    links.push({
      label: "View business",
      to: `/admin-panel/businesses/${data.business_id}`,
    });
  }

  return (
    <div className="min-w-0 space-y-1 text-xs leading-5 [overflow-wrap:anywhere]">
      {records.length > 0 && (
        <p className="text-text-secondary">{records.join(" · ")}</p>
      )}
      {children}
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-info"
            >
              {link.label}
              <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
