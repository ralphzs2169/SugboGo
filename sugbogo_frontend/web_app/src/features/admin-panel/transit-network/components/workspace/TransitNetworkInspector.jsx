import DataErrorState from "@/shared/components/errors/DataErrorState";

import RouteForm from "../routes/RouteForm";
import RouteInspector from "../routes/RouteInspector";
import RouteVariantEditorPanel from "../routes/RouteVariantEditorPanel";
import TransferForm from "../transfers/TransferForm";
import TransferInspector from "../transfers/TransferInspector";
import TransitPointEditorPanel from "../transit-point-workspace/TransitPointEditorPanel";
import {
  isRouteDrawingMode,
  isVariantEditingMode,
  TRANSIT_CONTEXTS,
  TRANSIT_MODES,
} from "./transitWorkspaceModes";

/**
 * Composes the context-sensitive inspector, switching between browse details
 * and explicit route, point, variant, or transfer editing surfaces.
 */
export default function TransitNetworkInspector({
  context,
  mode,
  routeState,
  pointState,
  transferState,
}) {
  return (
    <aside className="themed-scrollbar min-h-[420px] space-y-4 overflow-y-auto xl:h-[72vh]">
      {/* Context-sensitive inspector */}
      {context === TRANSIT_CONTEXTS.ROUTES && (
        <RouteContextInspector mode={mode} {...routeState} />
      )}
      {context === TRANSIT_CONTEXTS.POINTS && (
        <TransitPointEditorPanel mode={mode} {...pointState} />
      )}
      {context === TRANSIT_CONTEXTS.TRANSFERS && (
        <TransferContextInspector mode={mode} {...transferState} />
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
  onDirtyChange,
  onRouteSaved,
  onVariantSaved,
  onStartEditRoute,
  onStartCreateVariant,
  onStartEditVariant,
  onToggleDrawing,
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

  if (isVariantEditingMode(mode)) {
    if (routeReferencePointsQuery.error) {
      return (
        <DataErrorState
          title="Unable to load Transit Points"
          message="Route editing requires managed Transit Point reference data."
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
        isDrawing={isRouteDrawingMode(mode)}
        onToggleDrawing={onToggleDrawing}
        onCancel={onCancelVariant}
        onSaved={onVariantSaved}
      />
    );
  }

  if (routeDetailQuery.error && selectedRoute) {
    return (
      <DataErrorState
        title="Unable to load route"
        message="The selected route details could not be loaded."
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
    />
  );
}

/** Shows transfer details or the active directed-connection form. */
function TransferContextInspector({
  mode,
  selectedTransfer,
  geometryError,
  onDirtyChange,
  onCancel,
  onSaved,
  onEdit,
  onConfirm,
  onIgnore,
  onGeometryRetry,
}) {
  if (
    mode === TRANSIT_MODES.CREATE_TRANSFER ||
    mode === TRANSIT_MODES.EDIT_TRANSFER
  ) {
    return (
      <TransferForm
        key={`${mode}-${selectedTransfer?.id ?? "new"}`}
        transfer={
          mode === TRANSIT_MODES.EDIT_TRANSFER ? selectedTransfer : null
        }
        onDirtyChange={onDirtyChange}
        onCancel={onCancel}
        onSaved={onSaved}
      />
    );
  }

  return (
    <>
      <TransferInspector
        transfer={selectedTransfer}
        onEdit={onEdit}
        onConfirm={onConfirm}
        onIgnore={onIgnore}
      />
      {geometryError && selectedTransfer && (
        <DataErrorState
          title="Unable to load transfer map"
          message="The transfer remains reviewable while its route geometries reload."
          onRetry={onGeometryRetry}
        />
      )}
    </>
  );
}
