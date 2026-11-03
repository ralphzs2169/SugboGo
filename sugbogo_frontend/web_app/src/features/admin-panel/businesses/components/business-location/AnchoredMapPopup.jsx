import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useMap } from "@vis.gl/react-google-maps";
import { X } from "lucide-react";
import { mapPopupPosition } from "./mapPopupPosition";

/** A map-coordinate portal with measured collision handling and local dismissal. */
export default function AnchoredMapPopup({
  position,
  title,
  width = 320,
  onClose,
  children,
}) {
  const map = useMap();
  const panel = useRef(null);
  const host = useMemo(() => document.createElement("div"), []);
  const { lat, lng } = position;
  useEffect(() => {
    if (!map) return;
    const overlay = new globalThis.google.maps.OverlayView();
    const mapElement = map.getDiv();
    const draw = () => {
      const projection = overlay.getProjection();
      if (!projection || !panel.current) return;
      const coordinate = new globalThis.google.maps.LatLng(lat, lng);
      const containerPoint = projection.fromLatLngToContainerPixel(coordinate);
      const panePoint = projection.fromLatLngToDivPixel(coordinate);
      const mapWidth = mapElement.clientWidth;
      const mapHeight = mapElement.clientHeight;
      host.style.width = `${Math.min(width, Math.max(0, mapWidth - 88))}px`;
      panel.current.style.maxHeight = `${Math.max(0, mapHeight - 96)}px`;
      const offset = mapPopupPosition({
        x: containerPoint.x,
        y: containerPoint.y,
        width: host.offsetWidth,
        height: panel.current.offsetHeight,
        mapWidth,
        mapHeight,
      });
      host.style.left = `${panePoint.x + offset.left - containerPoint.x}px`;
      host.style.top = `${panePoint.y + offset.top - containerPoint.y}px`;
    };
    overlay.onAdd = () => {
      host.style.position = "absolute";
      host.style.pointerEvents = "auto";
      host.style.zIndex = "20000";
      overlay.getPanes().floatPane.appendChild(host);
      globalThis.google.maps.OverlayView.preventMapHitsAndGesturesFrom(host);
      draw();
      panel.current?.querySelector("button")?.focus({ preventScroll: true });
    };
    overlay.draw = draw;
    overlay.onRemove = () => host.remove();
    overlay.setMap(map);
    const observer = new ResizeObserver(draw);
    observer.observe(mapElement);
    observer.observe(panel.current);
    return () => {
      observer.disconnect();
      overlay.setMap(null);
    };
  }, [map, host, lat, lng, width]);
  useEffect(() => {
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector("button")?.focus({ preventScroll: true }),
    );
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    const outside = (event) => {
      if (!panel.current?.contains(event.target)) onClose();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", outside);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onClose]);
  const content = (
    <aside
      ref={panel}
      role="dialog"
      aria-label={title || "Business information"}
      className="overflow-y-auto rounded-2xl border border-stroke bg-background text-text-primary shadow-[0_6px_20px_rgba(15,23,42,0.18)]"
      style={{ width: "100%" }}
    >
      {/* Compact heading and explicit close control */}
      <div
        className={`flex items-center justify-between px-3 ${title ? "pb-2 pt-3" : "h-9"}`}
      >
        {title ? (
          <h2 className="text-lg font-bold leading-6">{title}</h2>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-label={title ? "Close business chooser" : "Close business popup"}
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      {children}
    </aside>
  );
  return map ? createPortal(content, host) : content;
}
