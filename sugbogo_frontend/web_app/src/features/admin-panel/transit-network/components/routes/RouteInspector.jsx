import { Edit3, Map, Plus, Route } from "lucide-react";

import Button from "@/shared/components/Button";

/**
 * Shows browse-mode route or variant details and exposes explicit authoring
 * actions without making selection itself editable.
 */
export default function RouteInspector({
  route,
  variant,
  isLoading,
  onEditRoute,
  onAddVariant,
  onEditVariant,
}) {
  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-skeleton" />;
  }

  if (!route) {
    return (
      <div className="rounded-xl border border-dashed border-stroke-strong bg-surface p-5 text-center">
        <Route className="mx-auto h-8 w-8 text-text-secondary" />
        <p className="mt-3 text-sm font-semibold text-text-primary">
          Select a route
        </p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Choose a route code to inspect its directional variants on the map.
        </p>
      </div>
    );
  }

  if (variant) {
    return (
      <section className="rounded-xl border border-stroke bg-background p-4">
        {/* Variant identity */}
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Route {route.code}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-text-primary">
          {variant.origin.name} → {variant.destination.name}
        </h2>
        <dl className="mt-5 space-y-3 text-sm">
          <InspectorField label="Origin" value={variant.origin.name} />
          <InspectorField label="Destination" value={variant.destination.name} />
          <InspectorField
            label="Ordered Transit Points"
            value={`${variant.transit_points?.length ?? 0}`}
          />
          <InspectorField
            label="Geometry Vertices"
            value={`${variant.geometry?.length ?? 0}`}
          />
        </dl>

        {/* Variant action */}
        <Button className="mt-5 w-full" icon={Map} onClick={onEditVariant}>
          Edit Path
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stroke bg-background p-4">
      {/* Route summary */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Selected route
          </p>
          <h2 className="mt-1 text-2xl font-bold text-text-primary">
            {route.code}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {route.variant_count ?? route.variants?.length ?? 0} directional
            variants
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={Edit3}
          onClick={onEditRoute}
        >
          Edit
        </Button>
      </div>

      {/* Route actions */}
      <Button className="mt-5 w-full" icon={Plus} onClick={onAddVariant}>
        Add Variant
      </Button>
      {!route.variants?.length && (
        <p className="mt-3 rounded-lg border border-dashed border-stroke-strong px-3 py-4 text-center text-xs text-text-secondary">
          No variants yet. Add the first directional path for this route.
        </p>
      )}
    </section>
  );
}

/** Displays one compact route or variant attribute. */
function InspectorField({ label, value }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2.5">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="mt-1 font-medium text-text-primary">{value}</dd>
    </div>
  );
}
