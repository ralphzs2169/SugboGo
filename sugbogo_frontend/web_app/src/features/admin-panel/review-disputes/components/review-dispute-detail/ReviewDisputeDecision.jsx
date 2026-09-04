import { useState } from "react";

import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useReviewDisputeMutations from "../../hooks/useReviewDisputeMutations";
import ResolveDisputeDrawer from "./ResolveDisputeDrawer";

/**
 * Provides the fixed moderation actions for a pending review dispute.
 * Both resolution paths use the same focused drawer so administrators
 * provide an auditable reason before resolving the dispute.
 */
export default function ReviewDisputeDecision({ dispute }) {
  const [activeDecision, setActiveDecision] = useState(null);

  const {
    uphold,
    dismiss,
    isUpholding,
    isDismissing,
    upholdError,
    dismissError,
  } = useReviewDisputeMutations();

  const isPending = dispute.status === "pending";
  const isSubmitting = isUpholding || isDismissing;

  useApiErrorNotification(upholdError, {
    toastId: `review-dispute-uphold-error-${dispute.id}`,
    fallbackMessage: "Unable to uphold the review dispute. Please try again.",
  });

  useApiErrorNotification(dismissError, {
    toastId: `review-dispute-dismiss-error-${dispute.id}`,
    fallbackMessage: "Unable to dismiss the review dispute. Please try again.",
  });

  async function handleConfirm(notes) {
    const data = {
      admin_notes: notes,
    };

    if (activeDecision === "uphold") {
      await uphold({
        disputeId: dispute.id,
        data,
      });

      return;
    }

    await dismiss({
      disputeId: dispute.id,
      data,
    });
  }

  function handleCloseDrawer() {
    if (isSubmitting) {
      return;
    }

    setActiveDecision(null);
  }

  if (!isPending) {
    return null;
  }

  return (
    <>
      {/* Fixed decision footer */}
      <section
        className="
          fixed bottom-0 left-0 right-0 z-30
          border-t border-stroke
          bg-background/95
          px-6 py-4
          backdrop-blur
          lg:left-[var(--admin-sidebar-width)]
        "
      >
        <div className="flex items-center justify-between gap-4">
          {/* Decision context */}
          <div className="hidden min-w-0 sm:block">
            <h2 className="text-sm font-semibold text-text-primary">
              Review Decision
            </h2>

            <p className="mt-0.5 text-xs text-text-secondary">
              Review the submitted dispute and determine the appropriate
              outcome.
            </p>
          </div>

          {/* Decision actions */}
          <div className="flex w-full justify-end gap-3 sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setActiveDecision("dismiss")}
              disabled={isSubmitting}
            >
              Dismiss
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={() => setActiveDecision("uphold")}
              disabled={isSubmitting}
            >
              Uphold Dispute
            </Button>
          </div>
        </div>
      </section>

      {/* Resolution drawer */}
      <ResolveDisputeDrawer
        decision={activeDecision}
        isOpen={!!activeDecision}
        onClose={handleCloseDrawer}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
