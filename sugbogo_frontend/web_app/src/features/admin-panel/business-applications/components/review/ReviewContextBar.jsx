import { ArrowLeft } from "lucide-react";

import useNavigateBack from "@/shared/hooks/useNavigateBack";
import StatusBadge from "@/shared/components/StatusBadge";
import StickyContextBar from "@/shared/components/StickyContextBar";
import statusConfig from "../../config/applicationStatus.config";

/**
 * Provides persistent application context while the administrator
 * scrolls through a long application review.
 */
export default function ApplicationReviewContextBar({ application }) {
  const businessName =
    application.identity?.business_name || "Unnamed Business";

  const status = application.status;
  const statusInfo = statusConfig[status];

  const handleBack = useNavigateBack("/admin-panel/businesses/applications");

  return (
    <StickyContextBar>
      {/* Back navigation */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={17} strokeWidth={1.8} />
        <span>Back to Applications</span>
      </button>

      {/* Application context */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-sm font-semibold text-text-primary">
            {businessName}
          </p>

          <p className="text-xs text-text-secondary">
            Application #{application.id}
          </p>
        </div>

        <StatusBadge variant={statusInfo?.variant ?? "neutral"}>
          {statusInfo?.label ?? status ?? "—"}
        </StatusBadge>
      </div>
    </StickyContextBar>
  );
}
