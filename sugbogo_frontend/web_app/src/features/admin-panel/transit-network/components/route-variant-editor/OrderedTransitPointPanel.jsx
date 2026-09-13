import { useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react";

import Button from "@/shared/components/Button";
import SelectInput from "@/shared/components/forms/SelectInput";

/**
 * Manages meaningful route Transit Points while fixing endpoints in traversal order.
 */
export default function OrderedTransitPointPanel({
  transitPoints,
  originId,
  destinationId,
  intermediatePointIds,
  errors,
  onOriginChange,
  onDestinationChange,
  onAddIntermediate,
  onMoveIntermediate,
  onRemoveIntermediate,
}) {
  const [pointToAdd, setPointToAdd] = useState("");
  const pointById = new Map(
    transitPoints.map((point) => [String(point.id), point]),
  );
  const selectedIds = new Set([
    originId,
    destinationId,
    ...intermediatePointIds,
  ]);
  const availableIntermediatePoints = transitPoints.filter(
    (point) => !selectedIds.has(String(point.id)),
  );
  const orderedRows = [
    originId && {
      id: originId,
      point: pointById.get(originId),
      role: "Origin",
    },
    ...intermediatePointIds.map((pointId, index) => ({
      id: pointId,
      point: pointById.get(pointId),
      role: "Intermediate",
      intermediateIndex: index,
    })),
    destinationId && {
      id: destinationId,
      point: pointById.get(destinationId),
      role: "Destination",
    },
  ].filter(Boolean);

  function handleAddPoint() {
    if (!pointToAdd) {
      return;
    }

    onAddIntermediate(pointToAdd);
    setPointToAdd("");
  }

  return (
    <section className="rounded-xl border border-stroke bg-background p-4">
      {/* Panel heading */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Ordered Transit Points
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          These named points define meaningful stops and transfer locations, not
          route geometry vertices.
        </p>
      </div>

      {/* Direction endpoints */}
      <div className="space-y-4">
        <SelectInput
          id="variant-origin"
          name="origin_transit_point_id"
          label="Origin"
          value={originId}
          onChange={(event) => onOriginChange(event.target.value)}
          error={errors.origin_transit_point_id}
          required
        >
          {transitPoints.map((point) => (
            <option
              key={point.id}
              value={point.id}
              disabled={String(point.id) === destinationId}
            >
              {point.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          id="variant-destination"
          name="destination_transit_point_id"
          label="Destination"
          value={destinationId}
          onChange={(event) => onDestinationChange(event.target.value)}
          error={errors.destination_transit_point_id}
          required
        >
          {transitPoints.map((point) => (
            <option
              key={point.id}
              value={point.id}
              disabled={String(point.id) === originId}
            >
              {point.name}
            </option>
          ))}
        </SelectInput>
      </div>

      {/* Intermediate point selector */}
      <div className="mt-5 rounded-lg bg-surface p-3">
        <SelectInput
          id="intermediate-transit-point"
          name="intermediate_transit_point_id"
          label="Add Intermediate Point"
          value={pointToAdd}
          onChange={(event) => setPointToAdd(event.target.value)}
          disabled={!originId || !destinationId}
          placeholder="Select a Transit Point"
        >
          {availableIntermediatePoints.map((point) => (
            <option key={point.id} value={point.id}>
              {point.name}
            </option>
          ))}
        </SelectInput>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          className="mt-3 w-full"
          disabled={!pointToAdd}
          onClick={handleAddPoint}
        >
          Add to Route
        </Button>
      </div>

      {/* Traversal order */}
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
          Traversal Order
        </h3>
        {orderedRows.length ? (
          <ol className="space-y-2">
            {orderedRows.map((row, index) => {
              const isIntermediate = row.role === "Intermediate";

              return (
                <li
                  key={`${row.role}-${row.id}`}
                  className="flex items-center gap-2 rounded-lg border border-stroke bg-surface px-3 py-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-text-secondary">
                    {index + 1}
                  </span>
                  <MapPin
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {row.point?.name ?? `Transit Point #${row.id}`}
                    </p>
                    <p className="text-[11px] text-text-secondary">{row.role}</p>
                  </div>

                  {isIntermediate && (
                    <div className="flex shrink-0 items-center">
                      {/* Reorder and remove actions */}
                      <Button
                        variant="action"
                        size="sm"
                        icon={ArrowUp}
                        iconOnly
                        disabled={row.intermediateIndex === 0}
                        tooltipMessage="Move point earlier"
                        aria-label={`Move ${row.point?.name} earlier`}
                        onClick={() =>
                          onMoveIntermediate(row.intermediateIndex, -1)
                        }
                      />
                      <Button
                        variant="action"
                        size="sm"
                        icon={ArrowDown}
                        iconOnly
                        disabled={
                          row.intermediateIndex ===
                          intermediatePointIds.length - 1
                        }
                        tooltipMessage="Move point later"
                        aria-label={`Move ${row.point?.name} later`}
                        onClick={() =>
                          onMoveIntermediate(row.intermediateIndex, 1)
                        }
                      />
                      <Button
                        variant="action"
                        size="sm"
                        icon={Trash2}
                        iconOnly
                        tooltipMessage="Remove from route"
                        aria-label={`Remove ${row.point?.name} from route`}
                        className="hover:text-danger"
                        onClick={() =>
                          onRemoveIntermediate(row.intermediateIndex)
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-stroke-strong px-3 py-6 text-center text-xs text-text-secondary">
            Select an origin and destination to establish traversal order.
          </p>
        )}
        {errors.transit_point_ids && (
          <p className="mt-2 text-xs font-bold text-danger" role="alert">
            {errors.transit_point_ids}
          </p>
        )}
      </div>
    </section>
  );
}
