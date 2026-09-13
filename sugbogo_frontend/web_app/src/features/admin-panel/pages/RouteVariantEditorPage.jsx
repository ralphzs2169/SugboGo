import { useParams } from "react-router-dom";

import PageHeader from "@/features/admin-panel/components/PageHeader";
import RouteVariantEditor from "@/features/admin-panel/transit-network/components/route-variant-editor/RouteVariantEditor";
import {
  useJeepneyRoute,
  useRouteVariant,
  useTransitPoints,
} from "@/features/admin-panel/transit-network/hooks/useTransitQueries";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

/**
 * Loads server state for dedicated visual route-variant creation and editing.
 */
export default function RouteVariantEditorPage() {
  const { routeId, variantId } = useParams();
  const isEditing = Boolean(variantId);
  const routeQuery = useJeepneyRoute(routeId);
  const variantQuery = useRouteVariant(variantId, { enabled: isEditing });
  const transitPointsQuery = useTransitPoints({ page_size: 100 });
  const error =
    routeQuery.error || variantQuery.error || transitPointsQuery.error;
  const isLoading =
    routeQuery.isLoading ||
    transitPointsQuery.isLoading ||
    (isEditing && variantQuery.isLoading);
  const route = routeQuery.route;
  const variant = variantQuery.variant;
  const hasRouteMismatch =
    variant && String(variant.route_id) !== String(routeId);
  const directionLabel = variant
    ? `${variant.origin.name} → ${variant.destination.name}`
    : "New Directional Variant";

  useDocumentTitle(
    `${route?.code ?? "Route"} ${directionLabel} | SugboGo Admin`,
  );
  useApiErrorNotification(error, {
    toastId: "route-variant-editor-load-error",
    fallbackMessage: "Unable to load the route variant editor.",
  });

  async function retryEditorData() {
    await Promise.all([
      routeQuery.refetch(),
      transitPointsQuery.refetch(),
      isEditing ? variantQuery.refetch() : Promise.resolve(),
    ]);
  }

  return (
    <>
      {/* Editor page header */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          {
            label: "Transit Network",
            href: "/admin-panel/transit-network?tab=routes",
          },
          { label: route?.code ?? "Jeepney Route" },
          { label: directionLabel },
        ]}
        title={
          route
            ? `${route.code} · ${directionLabel}`
            : "Route Variant Editor"
        }
      />

      {isLoading ? (
        /* Editor loading state */
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="h-[68vh] min-h-[520px] animate-pulse rounded-xl bg-skeleton" />
          <div className="space-y-4">
            <div className="h-80 animate-pulse rounded-xl bg-skeleton" />
            <div className="h-64 animate-pulse rounded-xl bg-skeleton" />
          </div>
        </div>
      ) : error || !route || (isEditing && !variant) || hasRouteMismatch ? (
        /* Persistent editor error */
        <DataErrorState
          title="Unable to load route editor"
          message={
            hasRouteMismatch
              ? "This route variant does not belong to the selected jeepney route."
              : "The route, variant, or Transit Point data could not be loaded."
          }
          onRetry={retryEditorData}
        />
      ) : (
        /* Controlled route editor */
        <RouteVariantEditor
          key={variant?.id ?? `new-${route.id}`}
          route={route}
          variant={variant}
          transitPoints={transitPointsQuery.items}
        />
      )}
    </>
  );
}
