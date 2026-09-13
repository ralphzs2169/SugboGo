import DataErrorState from "@/shared/components/errors/DataErrorState";
import Modal from "@/shared/components/modals/Modal";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import { useRouteVariant } from "../../hooks/useTransitQueries";
import TransferMapReviewMap from "./TransferMapReviewMap";

/**
 * Loads complete route geometries and presents a non-routing transfer map review.
 */
export default function TransferMapReviewModal({ transfer, onClose }) {
  const isOpen = Boolean(transfer);
  const sourceQuery = useRouteVariant(transfer?.source_variant?.id, {
    enabled: isOpen,
  });
  const destinationQuery = useRouteVariant(transfer?.destination_variant?.id, {
    enabled: isOpen,
  });
  const error = sourceQuery.error || destinationQuery.error;
  const isLoading = sourceQuery.isLoading || destinationQuery.isLoading;

  useApiErrorNotification(sourceQuery.error, {
    toastId: `transfer-map-source-${transfer?.id}-error`,
    fallbackMessage: "Unable to load the source route geometry.",
  });
  useApiErrorNotification(destinationQuery.error, {
    toastId: `transfer-map-destination-${transfer?.id}-error`,
    fallbackMessage: "Unable to load the destination route geometry.",
  });

  if (!isOpen) {
    return null;
  }

  function retryMapData() {
    return Promise.all([
      sourceQuery.refetch(),
      destinationQuery.refetch(),
    ]);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Transfer on Map"
      description="Compare both route paths and the proposed managed transfer points."
      maxWidth="max-w-6xl"
    >
      {isLoading ? (
        <div
          className="h-[58vh] min-h-[420px] animate-pulse rounded-xl bg-skeleton"
          aria-label="Loading transfer map"
        />
      ) : error ? (
        <DataErrorState
          title="Unable to load transfer map"
          message="The route geometries could not be loaded for map review."
          onRetry={retryMapData}
        />
      ) : (
        <TransferMapReviewMap
          sourceVariant={sourceQuery.variant}
          destinationVariant={destinationQuery.variant}
          alightingPoint={transfer.alighting_transit_point}
          boardingPoint={transfer.boarding_transit_point}
        />
      )}
    </Modal>
  );
}
