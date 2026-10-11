import { Shapes } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

import ClassificationRequestedChanges from "./ClassificationRequestedChanges";

/**
 * Confirms the immediate application of classification changes.
 *
 * Reuses the review comparison to show category, cluster, and specialty
 * differences consistently with the Admin request detail page.
 */
export default function ApproveClassificationRequestModal({
  isOpen,
  request,
  clusterDisplay,
  specialtyDisplay,
  loading,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve classification change?"
      description="This will immediately update the business's public classification and active specialty tags."
      showCloseButton={!loading}
      maxWidth="max-w-2xl"
    >
      {/* Classification changes to be approved */}
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2 text-text-secondary">
          <Shapes size={16} aria-hidden="true" />

          <h3 className="text-xs font-bold uppercase tracking-wider">
            Changes to Be Applied
          </h3>
        </div>

        {/* Shared classification comparison */}
        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-stroke bg-background p-4 sm:p-5">
          {request ? (
            <ClassificationRequestedChanges
              previous={request.previous}
              proposed={request.proposed}
              status={request.status}
              clusterDisplay={clusterDisplay.metadata}
              specialtyDisplay={specialtyDisplay.metadata}
            />
          ) : (
            <p className="text-sm text-text-secondary">
              Request details are unavailable.
            </p>
          )}
        </div>

        {(clusterDisplay.unavailableCount > 0 ||
          specialtyDisplay.unavailableCount > 0) && (
          <p role="alert" className="mt-3 text-xs text-text-secondary">
            Some classification icons or colors could not be loaded.{" "}
            <button
              type="button"
              className="cursor-pointer font-semibold text-primary underline"
              onClick={() => {
                if (clusterDisplay.unavailableCount > 0) {
                  void clusterDisplay.refetch();
                }
                if (specialtyDisplay.unavailableCount > 0) {
                  void specialtyDisplay.refetch();
                }
              }}
            >
              Retry
            </button>
          </p>
        )}

        {/* Approval impact notice */}
        <p className="mt-4 text-xs leading-5 text-text-secondary">
          Once approved, these changes will be reflected in the business's
          public listing.
        </p>
      </div>

      {/* Confirmation actions */}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-stroke pt-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <Button
          variant="success"
          onClick={onConfirm}
          loading={loading}
          disabled={!request}
        >
          Approve Request
        </Button>
      </div>
    </Modal>
  );
}
