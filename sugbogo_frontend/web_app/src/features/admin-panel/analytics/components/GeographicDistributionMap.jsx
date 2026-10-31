import { useContext, useEffect, useRef, useState } from "react";
import { InfoWindow, Map, useMap, useMapsLibrary, useApiLoadingStatus } from "@vis.gl/react-google-maps";
import { GoogleMapsAuthContext } from "@/shared/utils/googleMapsAuthContext";
import { googleMapsConfig } from "@/shared/utils/googleMapsConfig";
import { geographicOpacity, geographicRanges } from "../utils/geographicPresentation";
import { formatCount } from "../utils/presentation";

/** Converts existing theme colors into RGB supported by the Maps Data layer. */
function themeColor(token) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return "#808080";
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Draws only backend-supplied GeoJSON; business locations never become explorer locations. */
function CellLayer({ cells, metric, selected, hovered, onSelect, onHover }) {
  const map = useMap("analytics-geography");
  const maps = useMapsLibrary("maps");
  const layerRef = useRef(null);
  const fittedRef = useRef(null);
  useEffect(() => {
    if (!map || !maps) return undefined;
    const layer = new maps.Data({ map });
    layerRef.current = layer;
    layer.addGeoJson({ type: "FeatureCollection", features: cells.map((cell) => ({
      type: "Feature", id: cell.id, geometry: cell.geometry, properties: { cellId: cell.id },
    })) });
    const populated = new Set(cells.filter((cell) => cell.eligible_businesses > 0).map((cell) => cell.id));
    const signature = [...(populated.size ? populated : cells.map((cell) => cell.id))].join("|");
    if (fittedRef.current?.map !== map || fittedRef.current?.signature !== signature) {
      const bounds = new window.google.maps.LatLngBounds();
      layer.forEach((feature) => {
        if (!populated.size || populated.has(String(feature.getId()))) {
          feature.getGeometry()?.forEachLatLng((point) => bounds.extend(point));
        }
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
      fittedRef.current = { map, signature };
    }
    const listeners = [
      layer.addListener("click", (event) => {
        event.stop();
        onSelect(String(event.feature.getId()));
        onHover({ id: String(event.feature.getId()), position: event.latLng.toJSON() });
      }),
      layer.addListener("mouseover", (event) => onHover({ id: String(event.feature.getId()), position: event.latLng.toJSON() })),
      layer.addListener("mouseout", () => onHover(null)),
    ];
    return () => {
      listeners.forEach((listener) => listener.remove());
      layer.setMap(null);
      layerRef.current = null;
    };
  }, [map, maps, cells, onSelect, onHover]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    const byId = new globalThis.Map(cells.map((cell) => [cell.id, cell]));
    const ranges = geographicRanges(cells, metric);
    function style() {
      const primary = themeColor("--color-primary");
      const neutral = themeColor("--color-text-secondary");
      const selectionColor = themeColor("--color-info");
      layer.setStyle((feature) => {
        const cell = byId.get(String(feature.getId()));
        const value = cell[metric];
        const empty = cell.eligible_businesses === 0;
        const isSelected = String(feature.getId()) === selected;
        const isHovered = String(feature.getId()) === hovered?.id;
        let strokeWeight = 0.5;
        let strokeOpacity = 0.35;
        let zIndex = 1;
        if (isHovered) {
          strokeWeight = 1.5;
          strokeOpacity = 0.8;
          zIndex = 2;
        }
        if (isSelected) {
          strokeWeight = 3;
          strokeOpacity = 1;
          zIndex = 3;
        }
        return {
          fillColor: value == null || empty ? neutral : primary,
          fillOpacity: geographicOpacity(value, ranges),
          visible: !empty,
          strokeColor: isSelected ? selectionColor : neutral,
          strokeWeight,
          strokeOpacity,
          clickable: true,
          cursor: "pointer",
          zIndex,
        };
      });
    }
    style();
    const observer = new MutationObserver(style);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, [map, maps, cells, metric, selected, hovered?.id]);
  return null;
}

/** Reuses the Admin Google Maps loader; exact data remains available if the basemap fails. */
export default function GeographicDistributionMap(props) {
  const status = useApiLoadingStatus();
  const authFailed = useContext(GoogleMapsAuthContext);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (status === "LOADED") return undefined;
    const timer = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, [status]);
  if (!googleMapsConfig.apiKey || authFailed || status === "FAILED" || status === "AUTH_FAILURE" || (timedOut && status !== "LOADED")) {
    return <div role="status" className="flex h-80 items-center justify-center rounded-lg border border-stroke bg-surface-muted p-5 text-sm text-text-secondary">Map unavailable. Exact geographic values remain accessible through View data.</div>;
  }
  if (status !== "LOADED") return <div role="status" className="flex h-80 items-center justify-center text-sm text-text-secondary">Loading geographic map… Exact values are available in View data.</div>;
  return (
    <div aria-label="Cebu City business-location map" className="h-80 overflow-hidden rounded-lg border border-stroke focus-within:ring-2 focus-within:ring-info sm:h-112">
      {/* Existing Maps provider supplies the API; viewport fits the actual returned grid. */}
      <Map id="analytics-geography" defaultCenter={{ lat: 10.3157, lng: 123.8854 }} defaultZoom={12}
        mapId={googleMapsConfig.mapId || undefined} colorScheme={dark ? "DARK" : "LIGHT"} streetViewControl={false} fullscreenControl mapTypeControl={false} gestureHandling="cooperative">
        <CellLayer {...props} />
        {/* Hover/click information uses administrator-facing values, never internal cell IDs. */}
        {props.hovered && props.hoveredCell && <InfoWindow position={props.hovered.position} maxWidth={240} disableAutoPan onCloseClick={() => props.onHover(null)}>
          <div className="max-h-48 max-w-56 overflow-y-auto break-words rounded-lg bg-background p-2 text-sm text-text-primary">
            <p className="font-semibold">{props.metric === "eligible_businesses" ? "Current business inventory" : "Selected-period recorded profile visits"}</p>
            <p className="mt-1">{formatCount(props.hoveredCell.eligible_businesses)} businesses</p>
            <p>{formatCount(props.hoveredCell.profile_visits)} recorded profile visits</p>
            <p className="mt-1 text-xs text-text-secondary">{props.scopeText}</p>
          </div>
        </InfoWindow>}
      </Map>
    </div>
  );
}
