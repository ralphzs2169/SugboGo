import {
  useAdvancedMarkerRef,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import BusinessMapMarker from "./BusinessMapMarker";
export default function BusinessLocationMarker({
  position,
  variant,
  title,
  markerData,
  selected,
  onSelect,
  onClose,
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={title}
        onClick={() => onSelect(markerData)}
      >
        <BusinessMapMarker variant={variant} />
      </AdvancedMarker>

      {selected && marker && (
        <InfoWindow anchor={marker} onClose={onClose}>
          <div className="max-w-xs">
            <p className="text-sm font-semibold text-gray-900">
              {markerData.name}
            </p>

            <p className="mt-1 text-xs text-gray-600">
              {markerData.type === "business"
                ? "Business location"
                : markerData.source === "google"
                  ? markerData.address || "No address provided"
                  : "Custom landmark"}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
