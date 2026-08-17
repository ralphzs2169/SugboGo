import { useState } from "react";

import Modal from "@/shared/components/modals/Modal";
import BusinessLocationMap from "@/shared/components/maps/BusinessLocationMap";

import LandmarksPanel from "./LandmarksPanel";

/**
 * Displays the full interactive location experience for an approved business.
 *
 * Provides a larger interactive map with registered landmarks while
 * preserving the application's standard modal behavior and visual treatment.
 */
export default function BusinessLocationModal({
  isOpen,
  onClose,
  location,
  landmarks = [],
}) {
  const [focusPosition, setFocusPosition] = useState(null);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState(null);

  if (!location) {
    return null;
  }

  function handleLandmarkSelect(landmark) {
    setSelectedLandmarkId(landmark.id);

    setFocusPosition({
      lat: Number(landmark.latitude),
      lng: Number(landmark.longitude),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Business Location"
      description={`${location.address || "No address"}, ${location.city}, ${location.province}`}
      maxWidth="max-w-5xl"
    >
      <div className="relative h-[65vh] min-h-[420px]">
        {/* Interactive map */}
        <BusinessLocationMap
          latitude={location.latitude}
          longitude={location.longitude}
          landmarks={landmarks}
          focusPosition={focusPosition}
          selectedLandmarkId={selectedLandmarkId}
          className="h-full w-full"
        />

        {/* Business landmarks */}
        <LandmarksPanel
          landmarks={landmarks}
          selectedLandmarkId={selectedLandmarkId}
          onLandmarkSelect={handleLandmarkSelect}
        />
      </div>
    </Modal>
  );
}
