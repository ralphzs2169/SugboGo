import { useState } from "react";
import {
  ChevronDown,
  Eraser,
  MousePointer2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";

import Button from "@/shared/components/Button";

/**
 * Controls route drawing and exposes keyboard-accessible vertex editing alternatives.
 */
export default function GeometryEditorControls({
  geometry,
  isDrawing,
  canUndo,
  error,
  onToggleDrawing,
  onUndo,
  onRequestClear,
  onUpdateVertex,
  onRemoveVertex,
}) {
  const [areVertexDetailsVisible, setAreVertexDetailsVisible] = useState(false);

  return (
    <section className="rounded-xl border border-stroke bg-background p-4">
      {/* Geometry heading */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary">
          Route Geometry
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Small numbered vertices define the detailed LineString. They do not
          create or change Transit Points.
        </p>
      </div>

      {/* Drawing controls */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant={isDrawing ? "primary" : "secondary"}
          size="sm"
          icon={isDrawing ? MousePointer2 : Pencil}
          onClick={onToggleDrawing}
          aria-pressed={isDrawing}
        >
          {isDrawing ? "Stop Drawing" : "Draw Route"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCcw}
          disabled={!canUndo}
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Eraser}
          className="col-span-2"
          disabled={!geometry.length}
          onClick={onRequestClear}
        >
          Clear Route
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Geometry vertex summary */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-text-secondary">
            Vertices:{" "}
            <span className="tabular-nums text-text-primary">
              {geometry.length}
            </span>
          </p>
          {geometry.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setAreVertexDetailsVisible((previous) => !previous)
              }
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
              aria-expanded={areVertexDetailsVisible}
              aria-controls="route-geometry-vertex-details"
            >
              {areVertexDetailsVisible ? "Hide details" : "Show details"}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  areVertexDetailsVisible ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {areVertexDetailsVisible && geometry.length > 0 && (
          <ol
            id="route-geometry-vertex-details"
            className="themed-scrollbar mt-3 max-h-64 space-y-2 overflow-y-auto pr-1"
          >
            {geometry.map((coordinate, index) => (
              <li
                key={index}
                className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2 rounded-lg border border-stroke bg-surface p-2"
              >
                <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                  Latitude
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={coordinate.latitude}
                    onChange={(event) =>
                      onUpdateVertex(index, {
                        ...coordinate,
                        latitude: Number(event.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-md border border-stroke-strong bg-background px-2 py-1.5 font-mono text-xs font-normal text-text-primary outline-none focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
                  />
                </label>
                <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                  Longitude
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={coordinate.longitude}
                    onChange={(event) =>
                      onUpdateVertex(index, {
                        ...coordinate,
                        longitude: Number(event.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-md border border-stroke-strong bg-background px-2 py-1.5 font-mono text-xs font-normal text-text-primary outline-none focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
                  />
                </label>
                <Button
                  variant="action"
                  size="sm"
                  icon={Trash2}
                  iconOnly
                  tooltipMessage="Remove geometry vertex"
                  aria-label={`Remove geometry vertex ${index + 1}`}
                  className="hover:text-danger"
                  onClick={() => onRemoveVertex(index)}
                />
              </li>
            ))}
          </ol>
        )}

        {!geometry.length && (
          <div className="rounded-lg border border-dashed border-stroke-strong px-3 py-6 text-center">
            <p className="text-xs font-medium text-text-primary">
              No route geometry yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Choose Draw Route, then click the map to add vertices in order.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
