import { ArrowDown, ArrowUp, MapPin, Plus, Trash2, X } from "lucide-react";

import Button from "@/shared/components/Button";

import TransitPointSearchSelect from "./TransitPointSearchSelect";

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
  isSelectingTransitPoint,
  onBeginTransitPointSelection,
  onCancelTransitPointSelection,
  onSelectTransitPoint,
  onCreateTransitPoint,
  onMoveIntermediate,
  onRemoveIntermediate,
}) {
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
      role: "Transit point",
      intermediateIndex: index,
    })),
    destinationId && {
      id: destinationId,
      point: pointById.get(destinationId),
      role: "Destination",
    },
  ].filter(Boolean);

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
        <TransitPointSearchSelect
          id="variant-origin"
          label="Origin"
          transitPoints={transitPoints}
          value={originId}
          excludedIds={destinationId ? [destinationId] : []}
          onChange={onOriginChange}
          error={errors.origin_transit_point_id}
          placeholder="Search for an origin"
          onCreateNew={() => onCreateTransitPoint("origin")}
        />
        <TransitPointSearchSelect
          id="variant-destination"
          label="Destination"
          transitPoints={transitPoints}
          value={destinationId}
          excludedIds={originId ? [originId] : []}
          onChange={onDestinationChange}
          error={errors.destination_transit_point_id}
          placeholder="Search for a destination"
          onCreateNew={() => onCreateTransitPoint("destination")}
        />
      </div>

      {/* Existing Transit Point selection */}
      <div className="mt-5 rounded-lg border border-stroke bg-surface p-3">
        {isSelectingTransitPoint ? (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Choose a Transit Point
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  Select an eligible marker on the map or search by name.
                </p>
              </div>
              <Button
                variant="action"
                size="sm"
                icon={X}
                iconOnly
                tooltipMessage="Cancel Transit Point selection"
                aria-label="Cancel Transit Point selection"
                onClick={onCancelTransitPointSelection}
              />
            </div>
            <TransitPointSearchSelect
              id="route-transit-point-search"
              transitPoints={availableIntermediatePoints}
              onChange={onSelectTransitPoint}
              alwaysOpen
              autoFocus
              placeholder="Search available Transit Points"
              emptyMessage="No additional Transit Points are available."
              onCreateNew={() => onCreateTransitPoint("transit-point")}
            />
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            className="w-full"
            disabled={!originId || !destinationId}
            disabledTooltip={
              !originId || !destinationId
                ? "Select an origin and destination first."
                : undefined
            }
            onClick={onBeginTransitPointSelection}
          >
            Add transit point
          </Button>
        )}
      </div>

      {/* Traversal order */}
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
          Traversal Order
        </h3>
        {orderedRows.length ? (
          <ol className="space-y-2">
            {orderedRows.map((row, index) => {
              const isTransitPoint = row.role === "Transit point";

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

                  {isTransitPoint && (
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
