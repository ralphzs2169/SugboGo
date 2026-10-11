import { MapPin } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

import { getLandmarkDiff } from "../utils/locationDiff";
import LocationLandmarkDiff from "./LocationLandmarkDiff";
import LocationRequestedChanges from "./LocationRequestedChanges";

/** Confirms the captured location and landmark changes before approval. */
export default function ApproveLocationRequestModal({
  isOpen,
  request,
  loading,
  onClose,
  onConfirm,
}) {
  const landmarkDiff = getLandmarkDiff(
    request?.previous?.landmarks,
    request?.proposed?.landmarks,
  );
  const hasLandmarkChanges =
    landmarkDiff.added.length > 0 || landmarkDiff.removed.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve location change?"
      description="This will immediately update the business's public location and active landmarks."
      showCloseButton={!loading}
      maxWidth="max-w-2xl"
    >
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2 text-text-secondary">
          <MapPin size={16} aria-hidden="true" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Changes to Be Applied
          </h3>
        </div>

        <div className="max-h-[55vh] space-y-5 overflow-y-auto rounded-xl border border-stroke bg-background p-4 sm:p-5">
          {request ? (
            <>
              <LocationRequestedChanges
                previous={request.previous?.location}
                proposed={request.proposed?.location}
                status={request.status}
              />
              {hasLandmarkChanges && (
                <div className="border-t border-stroke pt-5">
                  <LocationLandmarkDiff
                    previous={request.previous?.landmarks}
                    proposed={request.proposed?.landmarks}
                    status={request.status}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              Request details are unavailable.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-text-secondary">
          Once approved, these changes will appear in the business's public
          listing.
        </p>
      </div>

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
