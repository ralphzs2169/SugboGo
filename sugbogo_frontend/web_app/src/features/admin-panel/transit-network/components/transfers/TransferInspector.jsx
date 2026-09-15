import { ArrowDown, Check, Edit3, X } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";

import {
  formatDistanceMeters,
  formatVariantLabel,
} from "../../utils/transitFormatters";

const STATUS_VARIANTS = {
  pending: "warning",
  confirmed: "success",
  ignored: "muted",
};

/**
 * Reviews one selected transfer beside its map layers and keeps status changes
 * behind explicit confirm and ignore actions.
 */
export default function TransferInspector({
  transfer,
  onEdit,
  onConfirm,
  onIgnore,
}) {
  if (!transfer) {
    return (
      <div className="rounded-xl border border-dashed border-stroke-strong bg-surface p-5 text-center">
        <p className="text-sm font-semibold text-text-primary">
          Select a transfer
        </p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Choose a connection to review its routes, points, distances, and status.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-stroke bg-background p-4">
      {/* Transfer status and direction */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Directed transfer
          </p>
          <h2 className="mt-1 text-sm font-semibold text-text-primary">
            {transfer.source_variant.route_code} → {" "}
            {transfer.destination_variant.route_code}
          </h2>
        </div>
        <StatusBadge variant={STATUS_VARIANTS[transfer.status] ?? "neutral"}>
          {transfer.status}
        </StatusBadge>
      </div>

      {/* Directed connection */}
      <div className="mt-4 space-y-2 rounded-xl bg-surface p-3">
        <ConnectionStep
          label="From route"
          value={formatVariantLabel(transfer.source_variant)}
        />
        <ArrowDown className="ml-2 h-4 w-4 text-text-secondary" />
        <ConnectionStep
          label="Alight at"
          value={transfer.alighting_transit_point?.name}
        />
        <ArrowDown className="ml-2 h-4 w-4 text-text-secondary" />
        <ConnectionStep
          label="Board at"
          value={transfer.boarding_transit_point?.name}
        />
        <ArrowDown className="ml-2 h-4 w-4 text-text-secondary" />
        <ConnectionStep
          label="To route"
          value={formatVariantLabel(transfer.destination_variant)}
        />
      </div>

      {/* Geographic distances */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-stroke p-3">
          <dt className="text-text-secondary">Approx. connection</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-text-primary">
            {formatDistanceMeters(transfer.connection_distance_meters)}
          </dd>
        </div>
        <div className="rounded-lg border border-stroke p-3">
          <dt className="text-text-secondary">Route separation</dt>
          <dd className="mt-1 font-semibold tabular-nums text-text-primary">
            {formatDistanceMeters(transfer.route_separation_meters)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-text-secondary">
        The connector is a geographic review aid, not a walking route, travel
        time, accessibility, or safety assessment.
      </p>

      {/* Review actions */}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" icon={Edit3} onClick={onEdit}>
          Edit
        </Button>
        {transfer.status === "pending" && (
          <>
            <Button variant="success" icon={Check} onClick={onConfirm}>
              Confirm
            </Button>
            <Button variant="danger" icon={X} onClick={onIgnore}>
              Ignore
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/** Displays one step in the directed connection. */
function ConnectionStep({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium text-text-primary">{value}</p>
    </div>
  );
}
