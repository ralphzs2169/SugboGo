import { Component, useEffect, useMemo, useState } from "react";
import {
  AdvancedMarker,
  APILoadingStatus,
  Map,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";

import StreetViewMarkerOverlay from "@/shared/components/maps/StreetViewMarkerOverlay";

import LocationMapStateMarker from "./LocationMapStateMarker";
import {
  groupLocationMapStates,
  validLocationPosition,
} from "../utils/locationMapMarkers";

/** Keeps a Google Maps rendering failure local to the map section. */
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

/** Fits exact marker positions and caps zoom for nearby locations. */
function FitComparisonBounds({ groups }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps || !groups.length) {
      return;
    }

    if (map.getStreetView()?.getVisible()) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    groups.forEach((group) => bounds.extend(group.position));

    if (
      groups.length === 1 ||
      bounds.getNorthEast().equals(bounds.getSouthWest())
    ) {
      map.setCenter(groups[0].position);
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
  }, [map, groups]);

  return null;
}

/** Keeps regular map markers separate from their panorama overlays. */
function ComparisonMapMarkers({ groups }) {
  const map = useMap();
  const [streetViewVisible, setStreetViewVisible] = useState(false);

  useEffect(() => {
    const panorama = map?.getStreetView();
    if (!panorama) {
      return;
    }

    const updateVisibility = () => {
      setStreetViewVisible(Boolean(panorama.getVisible()));
    };
    updateVisibility();

    const listener = panorama.addListener("visible_changed", updateVisibility);
    return () => listener.remove();
  }, [map]);

  if (streetViewVisible) {
    return null;
  }

  return groups.map((group) => (
    <AdvancedMarker
      key={group.key}
      position={group.position}
      title={group.states.map((state) => state.label).join(" and ")}
    >
      <LocationMapStateMarker states={group.states} />
    </AdvancedMarker>
  ));
}

/** Shows captured and live pins on a read-only map and in Street View. */
export default function LocationComparisonMap({ states }) {
  const apiStatus = useApiLoadingStatus();
  const groups = useMemo(() => groupLocationMapStates(states), [states]);
  const unplottedStates = states.filter(
    (state) => !validLocationPosition(state.location),
  );
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID;

  if (
    !groups.length ||
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
      {/* Read-only map with Google Pegman and standard navigation controls */}
      <div className="h-72 overflow-hidden rounded-lg border border-stroke sm:h-80">
        <Map
          defaultCenter={groups[0].position}
          defaultZoom={16}
          mapId={mapId}
          streetViewControl
          zoomControl
          mapTypeControl={false}
          fullscreenControl={false}
          gestureHandling="cooperative"
        >
          <FitComparisonBounds groups={groups} />
          <ComparisonMapMarkers groups={groups} />

          {/* Registration review overlays anchor these markers in Street View. */}
          {groups.map((group) => (
            <StreetViewMarkerOverlay
              key={group.key}
              position={group.position}
              name={group.states.map((state) => state.label).join(" and ")}
              showLabel
            >
              <LocationMapStateMarker states={group.states} />
            </StreetViewMarkerOverlay>
          ))}
        </Map>
      </div>

      {/* Each legend item identifies its true location state. */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {groups.map((group) => (
          <div key={group.key} className="flex min-w-0 items-center gap-2">
            <LocationMapStateMarker states={group.states} compact />
            <div className="min-w-0 text-xs text-text-secondary">
              <p>
                {group.states.map((state) => state.label).join(" · ")}
                {group.states.length > 1 && " (same pin)"}
              </p>
              <p className="break-words font-mono text-[10px] tabular-nums">
                {group.position.lat}, {group.position.lng}
              </p>
            </div>
          </div>
        ))}
      </div>
      {unplottedStates.length > 0 && (
        <p className="mt-3 text-xs text-text-secondary">
          {unplottedStates.map((state) => state.label).join(" and ")}{" "}
          {unplottedStates.length === 1 ? "pin has" : "pins have"} no valid
          coordinates to plot. Review the captured values above.
        </p>
      )}
    </div>
  );
}
