import { useContext, useEffect, useRef, useState } from "react";
import { Map, useMap, useMapsLibrary, useApiLoadingStatus } from "@vis.gl/react-google-maps";
import { GoogleMapsAuthContext } from "@/shared/utils/googleMapsAuthContext";
import { googleMapsConfig } from "@/shared/utils/googleMapsConfig";

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
function CellLayer({ cells, metric, selected, onSelect, onHover }) {
  const map = useMap("analytics-geography");
  const maps = useMapsLibrary("maps");
  const layerRef = useRef(null);
  useEffect(() => {
    if (!map || !maps) return undefined;
    const layer = new maps.Data({ map });
    layerRef.current = layer;
    layer.addGeoJson({ type: "FeatureCollection", features: cells.map((cell) => ({
      type: "Feature", id: cell.id, geometry: cell.geometry, properties: { cellId: cell.id },
    })) });
    const bounds = new window.google.maps.LatLngBounds();
    layer.forEach((feature) => feature.getGeometry()?.forEachLatLng((point) => bounds.extend(point)));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 24);
    const listeners = [
      layer.addListener("click", (event) => onSelect(String(event.feature.getId()))),
      layer.addListener("mouseover", (event) => onHover(String(event.feature.getId()))),
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
    const maximum = Math.max(0, ...cells.map((cell) => cell[metric] ?? 0));
    function style() {
      const primary = themeColor("--color-primary");
      const neutral = themeColor("--color-text-secondary");
      layer.setStyle((feature) => {
        const cell = byId.get(String(feature.getId()));
        const value = cell[metric];
        const empty = cell.eligible_businesses === 0;
        return {
          fillColor: value == null || empty ? neutral : primary,
          fillOpacity: empty ? 0.03 : value == null ? 0.3 : value === 0 ? 0 : 0.15 + 0.7 * value / maximum,
          strokeColor: String(feature.getId()) === selected ? primary : neutral,
          strokeWeight: String(feature.getId()) === selected ? 3 : 0.6,
          strokeOpacity: empty ? 0.2 : 0.7,
          clickable: true,
          cursor: "pointer",
          zIndex: String(feature.getId()) === selected ? 2 : 1,
        };
      });
    }
    style();
    const observer = new MutationObserver(style);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, [map, maps, cells, metric, selected]);
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
    return <div role="status" className="flex h-80 items-center justify-center rounded-lg border border-stroke bg-surface-muted p-5 text-sm text-text-secondary">Map unavailable. Exact geographic values remain accessible through the area selector and View data.</div>;
  }
  if (status !== "LOADED") return <div role="status" className="flex h-80 items-center justify-center text-sm text-text-secondary">Loading geographic map… Exact values are available in View data.</div>;
  return (
    <div aria-label="Cebu City business-location grid" className="h-80 overflow-hidden rounded-lg border border-stroke sm:h-112">
      {/* Existing Maps provider supplies the API; viewport fits the actual returned grid. */}
      <Map id="analytics-geography" defaultCenter={{ lat: 10.3157, lng: 123.8854 }} defaultZoom={12}
        mapId={googleMapsConfig.mapId || undefined} colorScheme={dark ? "DARK" : "LIGHT"} streetViewControl={false} mapTypeControl={false} gestureHandling="cooperative">
        <CellLayer {...props} />
      </Map>
    </div>
  );
}
