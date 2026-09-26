import { FileText, Store } from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "@/shared/components/StatusBadge";
import { formatLabel } from "@/shared/utils/stringUtils";

const STATUS_VARIANTS = {
  active: "success",
  suspended: "danger",
  approved: "success",
  rejected: "danger",
  submitted: "warning",
  draft: "muted",
};

export default function UserMerchantInformation({ application, business }) {
  if (!application && !business) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Merchant Information
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {application && (
          <div className="rounded-xl border border-stroke bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-surface p-2.5 text-text-secondary">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Merchant Application
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    Application #{application.id}
                  </p>
                </div>
              </div>
              <StatusBadge variant={STATUS_VARIANTS[application.status]}>
                {formatLabel(application.status)}
              </StatusBadge>
            </div>
            <Link
              to={`/admin-panel/business/application/${application.id}`}
              className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
            >
              View application
            </Link>
          </div>
        )}

        {business && (
          <div className="rounded-xl border border-stroke bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-surface p-2.5 text-text-secondary">
                  <Store className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Linked Business
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-text-primary">
                    {business.name}
                  </p>
                </div>
              </div>
              <StatusBadge variant={STATUS_VARIANTS[business.status]}>
                {formatLabel(business.status)}
              </StatusBadge>
            </div>
            <Link
              to={`/admin-panel/businesses/${business.id}`}
              className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
            >
              View business
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
