import { useCallback, useMemo, useRef, useState } from "react";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useRouteVariantWorkspaceEditor from "../../hooks/useRouteVariantWorkspaceEditor";
import useTransitPointWorkspaceEditor from "../../hooks/useTransitPointWorkspaceEditor";
import {
  useJeepneyRoute,
  useJeepneyRoutes,
  useRouteVariants,
  useRouteVariant,
  useTransitPoints,
  useTransitTransfers,
} from "../../hooks/useTransitQueries";
import useTransitTableState from "../../hooks/useTransitTableState";
import useUnsavedChangesGuard from "../../hooks/useUnsavedChangesGuard";
import EditorConfirmationModal from "../route-variant-editor/EditorConfirmationModal";
import RouteBrowser from "../routes/RouteBrowser";
import TransferBrowser from "../transfers/TransferBrowser";
import TransferDecisionModal from "../transfers/TransferDecisionModal";
import TransitPointList from "../transit-point-workspace/TransitPointList";
import TransitNetworkContextActions from "./TransitNetworkContextActions";
import TransitNetworkInspector from "./TransitNetworkInspector";
import TransitNetworkMapCanvas from "./TransitNetworkMapCanvas";
import TransitNetworkNavigation from "./TransitNetworkNavigation";
import {
  isPointEditingMode,
  isRouteDrawingMode,
  isVariantEditingMode,
  TRANSIT_CONTEXTS,
  TRANSIT_MODES,
} from "./transitWorkspaceModes";

function geometryPositions(variants = []) {
  return variants.flatMap((variant) =>
    (variant.geometry ?? []).map((coordinate) => ({
      lat: Number(coordinate.latitude),
      lng: Number(coordinate.longitude),
    })),
  );
}

/**
 * Coordinates the persistent three-region Transit Network workspace while
 * delegating browsers, map layers, inspectors, and editors to focused modules.
 */
export default function TransitNetworkWorkspace() {
  const [mode, setMode] = useState(TRANSIT_MODES.BROWSE);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedRouteFallback, setSelectedRouteFallback] = useState(null);
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedVariantFallback, setSelectedVariantFallback] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [transferDecision, setTransferDecision] = useState(null);
  const [formDirty, setFormDirty] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const [isLocalDiscardOpen, setIsLocalDiscardOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const pointEditor = useTransitPointWorkspaceEditor();
  const variantEditor = useRouteVariantWorkspaceEditor();
  const {
    currentTab: context,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    isSearching,
    statusFilter,
    setStatusFilter,
    routeParams,
    pointParams,
    transferParams,
    handleTabChange,
  } = useTransitTableState();

  const routesQuery = useJeepneyRoutes(routeParams, {
    enabled: context === TRANSIT_CONTEXTS.ROUTES,
  });
  const pointsQuery = useTransitPoints(pointParams, {
    enabled: context === TRANSIT_CONTEXTS.POINTS,
  });
  const transfersQuery = useTransitTransfers(transferParams, {
    enabled: context === TRANSIT_CONTEXTS.TRANSFERS,
  });
  const routeDetailQuery = useJeepneyRoute(expandedRouteId, {
    enabled: context === TRANSIT_CONTEXTS.ROUTES && Boolean(expandedRouteId),
  });
  const routeReferencePointsQuery = useTransitPoints(
    { page_size: 100 },
    { enabled: context === TRANSIT_CONTEXTS.ROUTES },
  );
  const pointReferenceVariantsQuery = useRouteVariants(
    { page_size: 100 },
    { enabled: context === TRANSIT_CONTEXTS.POINTS },
  );
  const sourceVariantQuery = useRouteVariant(
    selectedTransfer?.source_variant?.id,
    {
      enabled:
        context === TRANSIT_CONTEXTS.TRANSFERS && Boolean(selectedTransfer),
    },
  );
  const destinationVariantQuery = useRouteVariant(
    selectedTransfer?.destination_variant?.id,
    {
      enabled:
        context === TRANSIT_CONTEXTS.TRANSFERS && Boolean(selectedTransfer),
    },
  );

  const selectedRoute =
    routeDetailQuery.route ??
    routesQuery.items.find(
      (route) => String(route.id) === String(selectedRouteId),
    ) ??
    selectedRouteFallback ??
    null;
  const selectedVariant =
    routeDetailQuery.route?.variants?.find(
      (variant) => String(variant.id) === String(selectedVariantId),
    ) ??
    selectedVariantFallback;
  const routeVariants = routeDetailQuery.route?.variants ?? [];
  const isVariantMode = isVariantEditingMode(mode);
  const isPointMode = isPointEditingMode(mode);
  const isFormMode = [
    TRANSIT_MODES.CREATE_ROUTE,
    TRANSIT_MODES.EDIT_ROUTE,
    TRANSIT_MODES.CREATE_TRANSFER,
    TRANSIT_MODES.EDIT_TRANSFER,
  ].includes(mode);
  const isDirty = isVariantMode
    ? variantEditor.isDirty
    : isPointMode
      ? pointEditor.isDirty
      : isFormMode
        ? formDirty
        : false;
  const navigationGuard = useUnsavedChangesGuard(isDirty);
  const activeQuery =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routesQuery
      : context === TRANSIT_CONTEXTS.POINTS
        ? pointsQuery
        : transfersQuery;

  useApiErrorNotification(activeQuery.error, {
    toastId: `transit-workspace-${context}-error`,
    fallbackMessage: `Unable to load ${context.replace("-", " ")}.`,
  });
  useApiErrorNotification(routeDetailQuery.error, {
    toastId: `transit-workspace-route-${expandedRouteId}-error`,
    fallbackMessage: "Unable to load the selected route and its variants.",
  });
  useApiErrorNotification(routeReferencePointsQuery.error, {
    toastId: "transit-workspace-route-reference-points-error",
    fallbackMessage: "Transit Point reference markers could not be loaded.",
  });
  useApiErrorNotification(pointReferenceVariantsQuery.error, {
    toastId: "transit-workspace-point-reference-routes-error",
    fallbackMessage: "Route reference lines could not be loaded.",
  });
  useApiErrorNotification(sourceVariantQuery.error, {
    toastId: `transit-workspace-transfer-source-${selectedTransfer?.id}-error`,
    fallbackMessage: "Unable to load the source route geometry.",
  });
  useApiErrorNotification(destinationVariantQuery.error, {
    toastId: `transit-workspace-transfer-destination-${selectedTransfer?.id}-error`,
    fallbackMessage: "Unable to load the destination route geometry.",
  });

  const focusRequest = useMemo(() => {
    if (!focusTarget) {
      return null;
    }

    if (focusTarget.type === "point") {
      return {
        key: focusTarget.key,
        positions: focusTarget.positions,
      };
    }
    if (focusTarget.type === "route") {
      return {
        key: focusTarget.key,
        positions: geometryPositions(routeDetailQuery.route?.variants),
      };
    }
    if (focusTarget.type === "variant") {
      return {
        key: focusTarget.key,
        positions: geometryPositions([selectedVariant].filter(Boolean)),
      };
    }

    return {
      key: focusTarget.key,
      positions: [
        ...geometryPositions([sourceVariantQuery.variant].filter(Boolean)),
        ...geometryPositions(
          [destinationVariantQuery.variant].filter(Boolean),
        ),
      ],
    };
  }, [
    destinationVariantQuery.variant,
    focusTarget,
    routeDetailQuery.route?.variants,
    selectedVariant,
    sourceVariantQuery.variant,
  ]);

  const handleFormDirtyChange = useCallback((nextDirty) => {
    setFormDirty(nextDirty);
  }, []);

  function requestWorkspaceAction(action) {
    if (isDirty) {
      pendingActionRef.current = action;
      setIsLocalDiscardOpen(true);
      return;
    }

    action();
  }

  function resetSelections() {
    setSelectedRouteId(null);
    setSelectedRouteFallback(null);
    setExpandedRouteId(null);
    setSelectedVariantId(null);
    setSelectedVariantFallback(null);
    setSelectedPoint(null);
    setSelectedTransfer(null);
    setFocusTarget(null);
    setFormDirty(false);
  }

  function changeContext(nextContext) {
    if (nextContext === context) {
      return;
    }

    requestWorkspaceAction(() => {
      resetSelections();
      setMode(TRANSIT_MODES.BROWSE);
      handleTabChange(nextContext);
    });
  }

  function selectRoute(route) {
    requestWorkspaceAction(() => {
      setSelectedRouteId(route.id);
      setSelectedRouteFallback(route);
      setExpandedRouteId(route.id);
      setSelectedVariantId(null);
      setSelectedVariantFallback(null);
      setMode(TRANSIT_MODES.BROWSE);
      setFocusTarget({
        type: "route",
        key: `route-${route.id}-${Date.now()}`,
      });
    });
  }

  function selectVariant(variant) {
    requestWorkspaceAction(() => {
      setSelectedRouteId(variant.route_id);
      setExpandedRouteId(variant.route_id);
      setSelectedVariantId(variant.id);
      setSelectedVariantFallback(variant);
      setMode(TRANSIT_MODES.BROWSE);
      setFocusTarget({
        type: "variant",
        key: `variant-${variant.id}-${Date.now()}`,
      });
    });
  }

  function selectPoint(point) {
    requestWorkspaceAction(() => {
      setSelectedPoint(point);
      setMode(TRANSIT_MODES.BROWSE);
      setFocusTarget({
        type: "point",
        key: `point-${point.id}-${Date.now()}`,
        positions: [
          {
            lat: Number(point.latitude),
            lng: Number(point.longitude),
          },
        ],
      });
    });
  }

  function selectTransfer(transfer) {
    requestWorkspaceAction(() => {
      setSelectedTransfer(transfer);
      setMode(TRANSIT_MODES.BROWSE);
      setFocusTarget({
        type: "transfer",
        key: `transfer-${transfer.id}-${Date.now()}`,
      });
    });
  }

  function startAddPoint() {
    pointEditor.beginAdd();
    setSelectedPoint(null);
    setMode(TRANSIT_MODES.ADD_POINT);
  }

  function startCreateRoute() {
    setSelectedRouteId(null);
    setSelectedRouteFallback(null);
    setExpandedRouteId(null);
    setSelectedVariantId(null);
    setSelectedVariantFallback(null);
    setMode(TRANSIT_MODES.CREATE_ROUTE);
  }

  function startCreateTransfer() {
    setSelectedTransfer(null);
    setMode(TRANSIT_MODES.CREATE_TRANSFER);
  }

  function startEditPoint() {
    pointEditor.beginEdit(selectedPoint);
    setMode(TRANSIT_MODES.EDIT_POINT);
  }

  async function savePoint(addAnother) {
    const savedPoint = await pointEditor.save({
      mode,
      selectedPoint,
      addAnother,
    });

    if (!savedPoint) {
      return;
    }

    if (addAnother) {
      setSelectedPoint(null);
      setMode(TRANSIT_MODES.ADD_POINT);
      return;
    }

    setSelectedPoint(savedPoint);
    setMode(TRANSIT_MODES.BROWSE);
    setFocusTarget({
      type: "point",
      key: `point-${savedPoint.id}-${Date.now()}`,
      positions: [
        {
          lat: Number(savedPoint.latitude),
          lng: Number(savedPoint.longitude),
        },
      ],
    });
  }

  function cancelPointEdit() {
    pointEditor.reset();
    setMode(TRANSIT_MODES.BROWSE);
  }

  function startCreateVariant() {
    if (!selectedRoute) {
      return;
    }

    variantEditor.begin(selectedRoute);
    setSelectedVariantId(null);
    setSelectedVariantFallback(null);
    setMode(TRANSIT_MODES.CREATE_VARIANT_DRAW);
  }

  function startEditVariant() {
    if (!selectedRoute || !selectedVariant) {
      return;
    }

    variantEditor.begin(selectedRoute, selectedVariant);
    setMode(TRANSIT_MODES.EDIT_VARIANT_ADJUST);
  }

  function cancelVariantEdit() {
    variantEditor.begin(selectedRoute, selectedVariant);
    setMode(TRANSIT_MODES.BROWSE);
  }

  function toggleRouteDrawing() {
    const isCreating = mode.startsWith("create-variant");

    if (isRouteDrawingMode(mode)) {
      setMode(
        isCreating
          ? TRANSIT_MODES.CREATE_VARIANT_ADJUST
          : TRANSIT_MODES.EDIT_VARIANT_ADJUST,
      );
      return;
    }

    setMode(
      isCreating
        ? TRANSIT_MODES.CREATE_VARIANT_DRAW
        : TRANSIT_MODES.EDIT_VARIANT_DRAW,
    );
  }

  function handleVariantSaved(savedVariant) {
    setSelectedVariantId(savedVariant.id);
    setSelectedVariantFallback(savedVariant);
    setMode(TRANSIT_MODES.BROWSE);
  }

  function handleRouteSaved(savedRoute) {
    setFormDirty(false);
    setSelectedRouteId(savedRoute.id);
    setSelectedRouteFallback(savedRoute);
    setExpandedRouteId(savedRoute.id);
    setSelectedVariantId(null);
    setSelectedVariantFallback(null);
    setMode(TRANSIT_MODES.BROWSE);
  }

  function handleTransferSaved(savedTransfer) {
    setFormDirty(false);
    setSelectedTransfer(savedTransfer);
    setMode(TRANSIT_MODES.BROWSE);
  }

  function discardLocalChanges() {
    setIsLocalDiscardOpen(false);
    setFormDirty(false);
    pointEditor.reset();
    setMode(TRANSIT_MODES.BROWSE);

    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    pendingAction?.();
  }

  const mapTransitPoints =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routeReferencePointsQuery.items
      : pointsQuery.items;
  const transferGeometryError =
    sourceVariantQuery.error || destinationVariantQuery.error;
  const referenceLayerError =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routeReferencePointsQuery.error
      : context === TRANSIT_CONTEXTS.POINTS
        ? pointReferenceVariantsQuery.error
        : null;
  const retryReferenceLayer =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routeReferencePointsQuery.refetch
      : pointReferenceVariantsQuery.refetch;

  return (
    <div className="rounded-2xl border border-stroke bg-background p-4 sm:p-6">
      {/* Persistent network context navigation */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <TransitNetworkNavigation context={context} onChange={changeContext} />
        <TransitNetworkContextActions
          context={context}
          mode={mode}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAddRoute={startCreateRoute}
          onAddPoint={startAddPoint}
          onAddTransfer={startCreateTransfer}
        />
      </div>

      {/* Shared browser, map, and inspector layout */}
      <div className="grid min-h-[72vh] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <div className="min-h-[420px] xl:h-[72vh]">
          {context === TRANSIT_CONTEXTS.ROUTES && (
            <RouteBrowser
              routes={routesQuery.items}
              routeDetail={routeDetailQuery.route}
              expandedRouteId={expandedRouteId}
              selectedRouteId={selectedRouteId}
              selectedVariantId={selectedVariantId}
              search={globalFilter}
              isSearching={isSearching}
              isLoading={routesQuery.isLoading}
              detailLoading={routeDetailQuery.isLoading}
              error={routesQuery.error}
              detailError={routeDetailQuery.error}
              pagination={pagination}
              pageCount={routesQuery.pageCount}
              totalItems={routesQuery.totalItems}
              interactionDisabled={mode !== TRANSIT_MODES.BROWSE}
              onSearchChange={setGlobalFilter}
              onPageChange={(pageIndex) =>
                setPagination({ ...pagination, pageIndex })
              }
              onRouteSelect={selectRoute}
              onVariantSelect={selectVariant}
              onRetry={routesQuery.refetch}
              onDetailRetry={routeDetailQuery.refetch}
              onAddRoute={startCreateRoute}
            />
          )}
          {context === TRANSIT_CONTEXTS.POINTS && (
            <TransitPointList
              transitPoints={pointsQuery.items}
              selectedPointId={selectedPoint?.id}
              search={globalFilter}
              isSearching={isSearching}
              isLoading={pointsQuery.isLoading}
              error={pointsQuery.error}
              pagination={pagination}
              pageCount={pointsQuery.pageCount}
              totalItems={pointsQuery.totalItems}
              selectionDisabled={mode !== TRANSIT_MODES.BROWSE}
              onSearchChange={setGlobalFilter}
              onPageChange={(pageIndex) =>
                setPagination({ ...pagination, pageIndex })
              }
              onPointSelect={selectPoint}
              onRetry={pointsQuery.refetch}
              onStartAdd={startAddPoint}
            />
          )}
          {context === TRANSIT_CONTEXTS.TRANSFERS && (
            <TransferBrowser
              transfers={transfersQuery.items}
              selectedTransferId={selectedTransfer?.id}
              isLoading={transfersQuery.isLoading}
              error={transfersQuery.error}
              pagination={pagination}
              pageCount={transfersQuery.pageCount}
              totalItems={transfersQuery.totalItems}
              interactionDisabled={mode !== TRANSIT_MODES.BROWSE}
              onTransferSelect={selectTransfer}
              onPageChange={(pageIndex) =>
                setPagination({ ...pagination, pageIndex })
              }
              onRetry={transfersQuery.refetch}
            />
          )}
        </div>

        <TransitNetworkMapCanvas
          context={context}
          mode={mode}
          routeVariants={routeVariants}
          referenceRouteVariants={pointReferenceVariantsQuery.items}
          selectedVariantId={selectedVariantId}
          variantEditor={variantEditor}
          transitPoints={mapTransitPoints}
          selectedPoint={selectedPoint}
          pointDraftPosition={pointEditor.draftPosition}
          transfer={selectedTransfer}
          transferSourceVariant={sourceVariantQuery.variant}
          transferDestinationVariant={destinationVariantQuery.variant}
          focusRequest={focusRequest}
          referenceLayerError={referenceLayerError}
          onVariantSelect={selectVariant}
          onTransitPointSelect={(point) =>
            isVariantMode
              ? variantEditor.selectTransitPoint(String(point.id))
              : selectPoint(point)
          }
          onPointPositionChange={pointEditor.handlePositionChange}
          onReferenceLayerRetry={retryReferenceLayer}
        />

        <TransitNetworkInspector
          context={context}
          mode={mode}
          routeState={{
            selectedRoute,
            selectedVariant,
            routeDetailQuery,
            routeReferencePointsQuery,
            variantEditor,
            onDirtyChange: handleFormDirtyChange,
            onRouteSaved: handleRouteSaved,
            onVariantSaved: handleVariantSaved,
            onStartEditRoute: () => setMode(TRANSIT_MODES.EDIT_ROUTE),
            onStartCreateVariant: startCreateVariant,
            onStartEditVariant: startEditVariant,
            onToggleDrawing: toggleRouteDrawing,
            onCancelRoute: () => {
              setFormDirty(false);
              setMode(TRANSIT_MODES.BROWSE);
            },
            onCancelVariant: cancelVariantEdit,
          }}
          pointState={{
            selectedPoint,
            values: pointEditor.values,
            errors: pointEditor.errors,
            isSubmitting: pointEditor.isSubmitting,
            submittingAction: pointEditor.submittingAction,
            onNameChange: pointEditor.handleNameChange,
            onStartAdd: startAddPoint,
            onStartEdit: startEditPoint,
            onSave: savePoint,
            onCancel: cancelPointEdit,
          }}
          transferState={{
            selectedTransfer,
            geometryError: transferGeometryError,
            onDirtyChange: handleFormDirtyChange,
            onCancel: () => {
              setFormDirty(false);
              setMode(TRANSIT_MODES.BROWSE);
            },
            onSaved: handleTransferSaved,
            onEdit: () => setMode(TRANSIT_MODES.EDIT_TRANSFER),
            onConfirm: () => setTransferDecision("confirm"),
            onIgnore: () => setTransferDecision("ignore"),
            onGeometryRetry: () =>
              Promise.all([
                sourceVariantQuery.refetch(),
                destinationVariantQuery.refetch(),
              ]),
          }}
        />
      </div>

      {/* Unsaved local action confirmation */}
      <EditorConfirmationModal
        isOpen={isLocalDiscardOpen}
        title="Discard Unsaved Changes?"
        description="Your current Transit Network edits have not been saved."
        warning="Discarded changes cannot be recovered."
        confirmLabel="Discard Changes"
        onCancel={() => {
          pendingActionRef.current = null;
          setIsLocalDiscardOpen(false);
        }}
        onConfirm={discardLocalChanges}
      />

      {/* Unsaved page navigation confirmation */}
      <EditorConfirmationModal
        isOpen={navigationGuard.isLeaveConfirmationOpen}
        title="Discard Unsaved Changes?"
        description="Your current Transit Network edits have not been saved."
        warning="Discarded changes cannot be recovered after leaving this page."
        confirmLabel="Discard and Leave"
        onCancel={navigationGuard.stayOnPage}
        onConfirm={navigationGuard.discardAndLeave}
      />

      {/* Explicit transfer decision confirmation */}
      <TransferDecisionModal
        transfer={selectedTransfer}
        action={transferDecision}
        onClose={() => setTransferDecision(null)}
        onSaved={(savedTransfer) => {
          setSelectedTransfer(savedTransfer);
          setTransferDecision(null);
        }}
      />
    </div>
  );
}
