import { useEffect, useMemo } from "react";
import {
  AdvancedMarker,
  ControlPosition,
  Map,
  MapControl,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

import {
  isPointEditingMode,
  isRouteDrawingMode,
  isVariantEditingMode,
  TRANSIT_CONTEXTS,
  TRANSIT_MODES,
} from "./transitWorkspaceModes";

const CEBU_CITY_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

function toPosition(point) {
  if (!point || point.latitude == null || point.longitude == null) {
    return null;
  }

  return {
    lat: Number(point.latitude),
    lng: Number(point.longitude),
  };
}

function toPath(geometry = []) {
  return geometry.map((coordinate) => ({
    lat: Number(coordinate.latitude),
    lng: Number(coordinate.longitude),
  }));
}

/** Focuses the persistent map only after an explicit feature selection. */
function MapSelectionViewport({ focusRequest }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps || !focusRequest?.positions?.length) {
      return;
    }

    if (focusRequest.positions.length === 1) {
      map.panTo(focusRequest.positions[0]);

      if ((map.getZoom() ?? 0) < 16) {
        map.setZoom(16);
      }
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    focusRequest.positions.forEach((position) => bounds.extend(position));
    map.fitBounds(bounds, 56);
  }, [map, focusRequest]);

  return null;
}

/** Resizes the Google Map with its workspace column while retaining its camera. */
function MapWorkspaceResizeObserver() {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const container = map.getDiv();
    let animationFrame = null;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {};

      if (!width || !height) {
        return;
      }

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(() => {
        const center = map.getCenter();

        window.google?.maps?.event.trigger(map, "resize");

        if (center) {
          map.setCenter(center);
        }
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [map]);

  return null;
}

/**
 * Hosts the single persistent Google Map and composes context-specific route,
 * Transit Point, transfer, draft, and selection layers.
 */
export default function TransitNetworkMapCanvas({
  context,
  mode,
  routeVariants,
  referenceRouteVariants,
  selectedVariantId,
  variantEditor,
  transitPoints,
  selectedPoint,
  pointDraftPosition,
  transfer,
  transferSourceVariant,
  transferDestinationVariant,
  focusRequest,
  referenceLayerError,
  isFullscreen,
  onVariantSelect,
  onTransitPointSelect,
  onPointPositionChange,
  onReferenceLayerRetry,
}) {
  const isVariantEditing = isVariantEditingMode(mode);
  const isPointEditing = isPointEditingMode(mode);
  const draftPath = useMemo(
    () => toPath(variantEditor?.editorState.geometry ?? []),
    [variantEditor?.editorState.geometry],
  );
  const sourceTransferPath = useMemo(
    () => toPath(transferSourceVariant?.geometry),
    [transferSourceVariant?.geometry],
  );
  const destinationTransferPath = useMemo(
    () => toPath(transferDestinationVariant?.geometry),
    [transferDestinationVariant?.geometry],
  );
  const alightingPosition = toPosition(transfer?.alighting_transit_point);
  const boardingPosition = toPosition(transfer?.boarding_transit_point);
  const displayTransitPoints = useMemo(() => {
    if (
      context !== TRANSIT_CONTEXTS.POINTS ||
      !selectedPoint ||
      transitPoints.some(
        (point) => String(point.id) === String(selectedPoint.id),
      )
    ) {
      return transitPoints;
    }

    return [...transitPoints, selectedPoint];
  }, [context, selectedPoint, transitPoints]);

  function handleMapClick(event) {
    if (!event.detail.latLng) {
      return;
    }

    if (isPointEditing) {
      onPointPositionChange(event.detail.latLng);
      return;
    }

    if (isRouteDrawingMode(mode)) {
      variantEditor.addGeometryVertex({
        latitude: event.detail.latLng.lat,
        longitude: event.detail.latLng.lng,
      });
    }
  }

  function handleDraftPointDragEnd(event) {
    const position = event.latLng?.toJSON();

    if (position) {
      onPointPositionChange(position);
    }
  }

  function handleVertexDragEnd(index, event) {
    const position = event.latLng?.toJSON();

    if (position) {
      variantEditor.updateGeometryVertex(index, {
        latitude: position.lat,
        longitude: position.lng,
      });
    }
  }

  const helpText = getMapHelpText(context, mode, Boolean(transfer));
  const showMapHelp = isVariantEditing || isPointEditing;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-stroke-strong bg-surface ${
        isFullscreen
          ? "h-[65vh] min-h-[420px] xl:h-full xl:min-h-0"
          : "h-[72vh] min-h-[560px]"
      } xl:col-start-2`}
    >
      {/* Persistent transit network map */}
      <Map
        defaultCenter={CEBU_CITY_CENTER}
        defaultZoom={13}
        mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        gestureHandling="greedy"
        draggableCursor={
          isPointEditing || isRouteDrawingMode(mode) ? "crosshair" : undefined
        }
        onClick={handleMapClick}
      >
        <MapSelectionViewport focusRequest={focusRequest} />
        <MapWorkspaceResizeObserver />

        {/* Route context layers */}
        {context === TRANSIT_CONTEXTS.ROUTES && !isVariantEditing &&
          routeVariants.map((variant) => {
            const isSelected = String(variant.id) === String(selectedVariantId);
            const path = toPath(variant.geometry);

            return path.length >= 2 ? (
              <Polyline
                key={variant.id}
                path={path}
                strokeColor={isSelected ? "#F27F0D" : "#64748B"}
                strokeOpacity={isSelected ? 0.95 : 0.55}
                strokeWeight={isSelected ? 7 : 4}
                clickable
                onClick={() => onVariantSelect(variant)}
              />
            ) : null;
          })}

        {context === TRANSIT_CONTEXTS.POINTS &&
          referenceRouteVariants.map((variant) => {
            const path = toPath(variant.geometry);

            return path.length >= 2 ? (
              <Polyline
                key={`reference-route-${variant.id}`}
                path={path}
                strokeColor="#64748B"
                strokeOpacity={0.28}
                strokeWeight={3}
                clickable={false}
              />
            ) : null;
          })}

        {context === TRANSIT_CONTEXTS.ROUTES && isVariantEditing && (
          <>
            {draftPath.length >= 2 && (
              <Polyline
                path={draftPath}
                strokeColor="#F27F0D"
                strokeOpacity={0.95}
                strokeWeight={6}
                clickable={false}
              />
            )}
            {draftPath.map((position, index) => (
              <AdvancedMarker
                key={`vertex-${index}`}
                position={position}
                title={`Route geometry vertex ${index + 1}`}
                draggable
                zIndex={800 + index}
                onDragEnd={(event) => handleVertexDragEnd(index, event)}
              >
                <div className="flex h-6 w-6 cursor-move items-center justify-center rounded-full border-2 border-background bg-primary text-[9px] font-bold text-white shadow-md">
                  {index + 1}
                </div>
              </AdvancedMarker>
            ))}
          </>
        )}

        {/* Transit Point reference and primary layers */}
        {(context === TRANSIT_CONTEXTS.POINTS ||
          context === TRANSIT_CONTEXTS.ROUTES) &&
          displayTransitPoints.map((point) => {
            const position = toPosition(point);
            const isSelected = String(point.id) === String(selectedPoint?.id);
            const isLocallyEditing =
              mode === TRANSIT_MODES.EDIT_POINT && isSelected;
            const canSelect =
              context === TRANSIT_CONTEXTS.POINTS
                ? mode === TRANSIT_MODES.BROWSE
                : isVariantEditing;
            const pointId = String(point.id);
            const routePointRole = isVariantEditing
              ? pointId === variantEditor?.editorState.originId
                ? "origin"
                : pointId === variantEditor?.editorState.destinationId
                  ? "destination"
                  : variantEditor?.editorState.intermediatePointIds.includes(
                        pointId,
                      )
                    ? "intermediate"
                    : "available"
              : "available";
            const routePointClass = {
              origin: "border-success bg-success text-white",
              destination: "border-danger bg-danger text-white",
              intermediate: "border-info bg-info text-white",
              available: "border-info bg-background text-text-primary",
            }[routePointRole];

            if (!position || isLocallyEditing) {
              return null;
            }

            return (
              <AdvancedMarker
                key={`point-${point.id}`}
                position={position}
                title={
                  context === TRANSIT_CONTEXTS.ROUTES
                    ? `${point.name} · ${routePointRole}`
                    : point.name
                }
                clickable={canSelect}
                zIndex={isSelected ? 500 : 100}
                onClick={canSelect ? () => onTransitPointSelect(point) : undefined}
              >
                <div
                  className={`flex items-center gap-1 rounded-full border-2 px-2 py-1 text-[11px] font-semibold shadow-md ${
                    canSelect ? "cursor-pointer" : "cursor-default"
                  } ${
                    context === TRANSIT_CONTEXTS.ROUTES
                      ? routePointClass
                      : isSelected
                        ? "border-background bg-primary text-white"
                        : "border-info bg-background text-text-primary"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="max-w-28 truncate">{point.name}</span>
                </div>
              </AdvancedMarker>
            );
          })}

        {context === TRANSIT_CONTEXTS.POINTS &&
          isPointEditing &&
          pointDraftPosition && (
            <AdvancedMarker
              position={pointDraftPosition}
              title="Unsaved Transit Point location"
              draggable
              zIndex={1000}
              onDragEnd={handleDraftPointDragEnd}
            >
              <div className="flex h-11 w-11 cursor-move items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-lg ring-4 ring-primary/20">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
            </AdvancedMarker>
          )}

        {/* Transfer review layers */}
        {context === TRANSIT_CONTEXTS.TRANSFERS && transfer && (
          <>
            {sourceTransferPath.length >= 2 && (
              <Polyline
                path={sourceTransferPath}
                strokeColor="#F27F0D"
                strokeOpacity={0.95}
                strokeWeight={6}
                clickable={false}
              />
            )}
            {destinationTransferPath.length >= 2 && (
              <Polyline
                path={destinationTransferPath}
                strokeColor="#3B82F6"
                strokeOpacity={0.9}
                strokeWeight={6}
                clickable={false}
              />
            )}
            {alightingPosition && boardingPosition && (
              <Polyline
                path={[alightingPosition, boardingPosition]}
                strokeColor="#64748B"
                strokeOpacity={0.9}
                strokeWeight={3}
                clickable={false}
              />
            )}
            <TransferPointMarker
              position={alightingPosition}
              label={`Alight · ${transfer.alighting_transit_point?.name}`}
              className="bg-primary"
            />
            <TransferPointMarker
              position={boardingPosition}
              label={`Board · ${transfer.boarding_transit_point?.name}`}
              className="bg-info"
            />
          </>
        )}

        {/* Contextual map guidance */}
        {showMapHelp && (
          <MapControl position={ControlPosition.TOP_LEFT}>
            <div className="m-3 max-w-72 rounded-lg border border-stroke bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
              <p className="text-xs font-semibold text-text-primary">
                {helpText.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                {helpText.description}
              </p>
            </div>
          </MapControl>
        )}

        {referenceLayerError && (
          <MapControl position={ControlPosition.TOP_RIGHT}>
            <div
              className="m-3 max-w-60 rounded-lg border border-danger/30 bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm"
              role="alert"
            >
              <p className="text-xs font-semibold text-danger">
                Reference layer unavailable
              </p>
              <button
                type="button"
                className="mt-1 cursor-pointer text-xs font-semibold text-primary hover:text-primary-hover"
                onClick={onReferenceLayerRetry}
              >
                Retry layer
              </button>
            </div>
          </MapControl>
        )}
      </Map>
    </div>
  );
}

function getMapHelpText(context, mode, hasTransfer) {
  if (isRouteDrawingMode(mode)) {
    return {
      title: "Drawing route geometry",
      description: "Click the map to add LineString vertices in travel order.",
    };
  }
  if (isVariantEditingMode(mode)) {
    return {
      title: "Adjusting route path",
      description: "Drag numbered vertices or select managed Transit Points.",
    };
  }
  if (isPointEditingMode(mode)) {
    return {
      title: mode === TRANSIT_MODES.ADD_POINT ? "Placing a new point" : "Editing point location",
      description: "Click the map or drag the highlighted marker to reposition it.",
    };
  }
  if (context === TRANSIT_CONTEXTS.TRANSFERS) {
    return {
      title: hasTransfer ? "Transfer review" : "Transfer network",
      description: hasTransfer
        ? "The connector is a geographic review aid, not a walking route."
        : "Select a transfer to compare its route paths and connection points.",
    };
  }
  if (context === TRANSIT_CONTEXTS.POINTS) {
    return {
      title: "Transit Point network",
      description: "Select a named marker to inspect its managed location.",
    };
  }

  return {
    title: "Jeepney route network",
    description: "Select a route or directional path before choosing an edit tool.",
  };
}

/** Displays one named endpoint for a selected transfer. */
function TransferPointMarker({ position, label, className }) {
  if (!position) {
    return null;
  }

  return (
    <AdvancedMarker position={position} title={label} zIndex={600}>
      <div
        className={`flex items-center gap-1.5 rounded-full border-2 border-background px-3 py-2 text-xs font-semibold text-white shadow-lg ${className}`}
      >
        <MapPin className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </AdvancedMarker>
  );
}
