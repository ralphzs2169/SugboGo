import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import StatusBadge from "@/shared/components/StatusBadge";

const statusVariants = {
  draft: "neutral",
  submitted: "info",
  rejected: "danger",
  approved: "success",
};

const statusLabels = {
  draft: "Draft",
  submitted: "Pending Review",
  rejected: "Rejected",
  approved: "Approved",
};

/**
 * Provides persistent application context while the administrator
 * scrolls through a long application review.
 *
 * Appears only after the main review header leaves the viewport and
 * provides quick navigation back to the application list.
 */
export default function ApplicationReviewContextBar({ application }) {
  const navigate = useNavigate();

  const businessName =
    application.identity?.business_name || "Unnamed Business";

  const status = application.status;
  const statusVariant = statusVariants[status] ?? "neutral";
  const statusLabel = statusLabels[status] ?? status ?? "Unknown";

  function handleBack() {
    navigate(-1);
  }

  return (
    <div className="sticky top-16 z-30 border-b border-stroke bg-background/90 backdrop-blur">
      <div className="flex h-12 items-center justify-between gap-4 px-6">
        <button
          type="button"
          onClick={handleBack}
          className="cursor-pointer inline-flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={17} strokeWidth={1.8} />
          <span>Back to Applications</span>
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-semibold text-text-primary">
              {businessName}
            </p>

            <p className="text-xs text-text-secondary">
              Application #{application.id}
            </p>
          </div>

          <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
        </div>
      </div>
    </div>
  );
}
