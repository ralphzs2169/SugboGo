import DataErrorState from "@/shared/components/errors/DataErrorState";
import Button from "@/shared/components/Button";

import RouteForm from "../routes/RouteForm";
import RouteInspector from "../routes/RouteInspector";
import RouteVariantEditorPanel from "../routes/RouteVariantEditorPanel";
import TransitPointEditorPanel from "../transit-point-workspace/TransitPointEditorPanel";
import {
  isRouteDrawingMode,
  isRouteTransitPointCreationMode,
  isVariantEditingMode,
  TRANSIT_CONTEXTS,
  TRANSIT_MODES,
} from "./transitWorkspaceModes";

/**
 * Composes the context-sensitive inspector, switching between browse details
 * and explicit route, point, and variant editing surfaces.
 */
export default function TransitNetworkInspector({
  context,
  mode,
  isCollapsed,
  isFullscreen,
  routeState,
  pointState,
}) {
  return (
    <aside
      id="transit-network-inspector"
      className={`themed-scrollbar space-y-4 overflow-y-auto ${
        isCollapsed ? "hidden" : "min-h-[420px]"
      } xl:col-start-3 ${isFullscreen ? "xl:h-full" : "xl:h-[72vh]"}`}
      aria-hidden={isCollapsed}
      inert={isCollapsed}
    >
      {/* Context-sensitive inspector */}
      {context === TRANSIT_CONTEXTS.ROUTES && (
        <RouteContextInspector mode={mode} {...routeState} />
      )}
      {context === TRANSIT_CONTEXTS.POINTS && (
        <TransitPointEditorPanel mode={mode} {...pointState} />
      )}
    </aside>
  );
}

/** Shows route details or the active route/variant authoring surface. */
function RouteContextInspector({
  mode,
  selectedRoute,
  selectedVariant,
  routeDetailQuery,
  routeReferencePointsQuery,
  variantEditor,
  pointEditor,
  routePointCreationRole,
  onDirtyChange,
  onRouteSaved,
  onVariantSaved,
  onStartEditRoute,
  onStartCreateVariant,
  onStartEditVariant,
  onStartDeleteRoute,
  onStartDeleteVariant,
  onToggleDrawing,
  onStartCreateTransitPoint,
  onSaveRouteTransitPoint,
  onCancelRouteTransitPoint,
  onCancelRoute,
  onCancelVariant,
}) {
  if (mode === TRANSIT_MODES.CREATE_ROUTE || mode === TRANSIT_MODES.EDIT_ROUTE) {
    return (
      <RouteForm
        key={`${mode}-${selectedRoute?.id ?? "new"}`}
        route={mode === TRANSIT_MODES.EDIT_ROUTE ? selectedRoute : null}
        onDirtyChange={onDirtyChange}
        onCancel={onCancelRoute}
        onSaved={onRouteSaved}
      />
    );
  }

  if (isRouteTransitPointCreationMode(mode)) {
    const roleDescription = {
      origin:
        "After saving, this stop will become the starting stop for this direction.",
      destination:
        "After saving, this stop will become the last stop for this direction.",
      "transit-point":
        "After saving, this stop will be added before the last stop.",
    }[routePointCreationRole];

    return (
      <TransitPointEditorPanel
        mode={TRANSIT_MODES.ADD_POINT}
        selectedPoint={null}
        values={pointEditor.values}
        errors={pointEditor.errors}
        isSubmitting={pointEditor.isSubmitting}
        submittingAction={pointEditor.submittingAction}
        onNameChange={pointEditor.handleNameChange}
        onSave={() => onSaveRouteTransitPoint()}
        onCancel={onCancelRouteTransitPoint}
        allowSaveAndAddAnother={false}
        contextDescription={roleDescription}
      />
    );
  }

  if (isVariantEditingMode(mode)) {
    if (routeReferencePointsQuery.isLoading) {
      return (
        <div className="rounded-xl border border-stroke bg-surface p-4">
          <p role="status" className="text-sm text-text-secondary">Loading all stops…</p>
          <Button className="mt-3" variant="secondary" onClick={onCancelVariant}>Cancel</Button>
        </div>
      );
    }
    if (routeReferencePointsQuery.error) {
      return (
        <DataErrorState
          title="Unable to load Transit Points"
          message="The complete stop list could not be loaded. Retry before editing this direction."
          onRetry={routeReferencePointsQuery.refetch}
        />
      );
    }

    return (
      <RouteVariantEditorPanel
        route={selectedRoute}
        variant={mode.startsWith("edit-variant") ? selectedVariant : null}
        transitPoints={routeReferencePointsQuery.items}
        editor={variantEditor}
        isDrawing={
          isRouteDrawingMode(mode) && !variantEditor.isSelectingTransitPoint
        }
        onToggleDrawing={onToggleDrawing}
        onCreateTransitPoint={onStartCreateTransitPoint}
        onCancel={onCancelVariant}
        onSaved={onVariantSaved}
      />
    );
  }

  if (routeDetailQuery.error) {
    return (
      <DataErrorState
        title="Unable to load route"
        message={
          routeDetailQuery.error.response?.status === 404
            ? "The selected route is no longer available."
            : "The selected route details could not be loaded."
        }
        onRetry={routeDetailQuery.refetch}
      />
    );
  }

  return (
    <RouteInspector
      route={selectedRoute}
      variant={selectedVariant}
      isLoading={routeDetailQuery.isLoading}
      onEditRoute={onStartEditRoute}
      onAddVariant={onStartCreateVariant}
      onEditVariant={onStartEditVariant}
      onDeleteRoute={onStartDeleteRoute}
      onDeleteVariant={onStartDeleteVariant}
    />
  );
}
