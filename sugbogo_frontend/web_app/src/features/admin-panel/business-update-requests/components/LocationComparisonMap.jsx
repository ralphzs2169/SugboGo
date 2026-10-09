import { Component, useEffect } from "react";
import {
  AdvancedMarker,
  APILoadingStatus,
  Map,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";

const MARKER_STYLES = {
  current: "bg-sky-700",
  previous: "bg-amber-600",
  proposed: "bg-emerald-700",
};

/** Keeps a map-rendering failure local so the textual review remains usable. */
export class LocationMapBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <MapUnavailable states={this.props.states} />;
    }
    return this.props.children;
  }
}

function MapUnavailable({ states }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-stroke bg-surface p-4 text-sm text-text-secondary"
    >
      <p className="font-medium text-text-primary">Map unavailable</p>
      <p className="mt-1">Review the captured positions below.</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {states.map((state) => (
          <div key={state.id} className="min-w-0">
            <dt className="text-xs font-semibold text-text-primary">
              {state.label}
            </dt>
            <dd className="break-words">
              {state.location?.address || "Address unavailable"}
            </dd>
            <dd className="font-mono text-xs">
              {state.location?.latitude ?? "—"},{" "}
              {state.location?.longitude ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function validPosition(location) {
  if (
    location?.latitude == null ||
    location?.longitude == null ||
    String(location.latitude).trim() === "" ||
    String(location.longitude).trim() === ""
  ) {
    return null;
  }
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return { lat, lng };
}

/** Fits the comparison map to all available snapshot pins without excessive close-range zoom. */
function FitComparisonBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google?.maps || !markers.length) {
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    markers.forEach((marker) => bounds.extend(marker.position));
    if (
      markers.length === 1 ||
      bounds.getNorthEast().equals(bounds.getSouthWest())
    ) {
      map.setCenter(markers[0].position);
      map.setZoom(18);
      return;
    }
    map.fitBounds(bounds, 70);
    const listener = window.google.maps.event.addListenerOnce(
      map,
      "idle",
      () => {
        if (map.getZoom() > 18) {
          map.setZoom(18);
        }
      },
    );
    return () => window.google.maps.event.removeListener(listener);
  }, [map, markers]);
  return null;
}

/** Shows a single read-only comparison map with labeled, distinct snapshot pins. */
export default function LocationComparisonMap({ states }) {
  const apiStatus = useApiLoadingStatus();
  const markers = states
    .map((state) => ({ ...state, position: validPosition(state.location) }))
    .filter((state) => state.position);
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID;

  if (
    !markers.length ||
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE ||
    !mapId
  ) {
    return <MapUnavailable states={states} />;
  }

  if (apiStatus !== APILoadingStatus.LOADED) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-stroke bg-surface-muted text-sm text-text-secondary">
        Loading comparison map…
      </div>
    );
  }

  return (
    <div>
      {/* Comparison map */}
      <div className="h-64 overflow-hidden rounded-lg border border-stroke sm:h-80">
        <Map
          defaultCenter={markers[0].position}
          defaultZoom={16}
          mapId={mapId}
          disableDefaultUI
          zoomControl
          gestureHandling="cooperative"
        >
          <FitComparisonBounds markers={markers} />
          {markers.map((marker, index) => {
            const coincident = markers.some(
              (other, otherIndex) =>
                otherIndex < index &&
                Math.abs(other.position.lat - marker.position.lat) < 0.00003 &&
                Math.abs(other.position.lng - marker.position.lng) < 0.00003,
            );
            return (
              <AdvancedMarker
                key={marker.id}
                position={marker.position}
                title={marker.label}
                zIndex={index + 1}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-lg ${MARKER_STYLES[marker.id]} ${coincident ? "translate-x-5" : ""}`}
                >
                  {index + 1}
                </span>
              </AdvancedMarker>
            );
          })}
        </Map>
      </div>
      {/* Map legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {markers.map((marker, index) => (
          <span
            key={marker.id}
            className="inline-flex items-center gap-2 text-xs text-text-secondary"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${MARKER_STYLES[marker.id]}`}
            >
              {index + 1}
            </span>
            {marker.label}
          </span>
        ))}
      </div>
    </div>
  );
}
