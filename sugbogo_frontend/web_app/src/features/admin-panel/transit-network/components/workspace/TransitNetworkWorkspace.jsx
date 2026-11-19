import { useQueryClient } from "@tanstack/react-query";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useSelectedTransitRecord from "../../hooks/useSelectedTransitRecord";
import { transitQueryKeys } from "../../hooks/transitQueryKeys";
import { useCallback, useMemo, useRef, useState } from "react";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useRouteVariantWorkspaceEditor from "../../hooks/useRouteVariantWorkspaceEditor";
import useTransitPointWorkspaceEditor from "../../hooks/useTransitPointWorkspaceEditor";
import useTransitWorkspaceFullscreen from "../../hooks/useTransitWorkspaceFullscreen";
import useTransitWorkspaceKeyboardShortcuts from "../../hooks/useTransitWorkspaceKeyboardShortcuts";
import {
  useJeepneyRoute,
  useJeepneyRoutes,
  useRouteVariantReferences,
  useTransitPointReferences,
  useTransitPoint,
  useTransitPoints,
} from "../../hooks/useTransitQueries";
import useTransitTableState from "../../hooks/useTransitTableState";
import useUnsavedChangesGuard from "../../hooks/useUnsavedChangesGuard";
import EditorConfirmationModal from "../route-variant-editor/EditorConfirmationModal";
import RouteBrowser from "../routes/RouteBrowser";
import TransitPointList from "../transit-point-workspace/TransitPointList";
import TransitPointDeleteModal from "../transit-point-workspace/TransitPointDeleteModal";
import TransitNetworkContextActions from "./TransitNetworkContextActions";
import TransitNetworkInspector from "./TransitNetworkInspector";
import TransitNetworkMapCanvas from "./TransitNetworkMapCanvas";
import TransitNetworkNavigation from "./TransitNetworkNavigation";
import TransitWorkspaceToolbar from "./TransitWorkspaceToolbar";
import {
  isPointEditingMode,
  isRouteDrawingMode,
  isRouteTransitPointCreationMode,
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

function getWorkspaceGridClass(isBrowserCollapsed, isInspectorCollapsed) {
  if (isBrowserCollapsed && isInspectorCollapsed) {
    return "xl:grid-cols-[0_minmax(0,1fr)_0]";
  }
  if (isBrowserCollapsed) {
    return "xl:grid-cols-[0_minmax(0,1fr)_340px]";
  }
  if (isInspectorCollapsed) {
    return "xl:grid-cols-[260px_minmax(0,1fr)_0]";
  }

  return "xl:grid-cols-[260px_minmax(0,1fr)_340px]";
}

/**
 * Coordinates the persistent three-region Transit Network workspace while
 * delegating browsers, map layers, inspectors, and editors to focused modules.
 */
export default function TransitNetworkWorkspace() {
  const workspaceRef = useRef(null);
  const [mode, setMode] = useState(TRANSIT_MODES.BROWSE);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedRouteFallback, setSelectedRouteFallback] = useState(null);
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedVariantFallback, setSelectedVariantFallback] = useState(null);
  const client = useQueryClient();
  const [pointSelection, setPointSelection] = useState(null);
  const [deletingPointId, setDeletingPointId] = useState(null);
  const [editingPoint, setEditingPoint] = useState(null);
  function setSelectedPoint(record) {
    setPointSelection(record ? { id: record.id, fallback: record } : null);
  }

  const [formDirty, setFormDirty] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const [isLocalDiscardOpen, setIsLocalDiscardOpen] = useState(false);
  const [isBrowserCollapsed, setIsBrowserCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [routePointCreationRole, setRoutePointCreationRole] = useState(null);
  const [recentlyCreatedRoutePoints, setRecentlyCreatedRoutePoints] = useState(
    [],
  );
  const pendingActionRef = useRef(null);
  const routePointReturnModeRef = useRef(null);
  const pointEditor = useTransitPointWorkspaceEditor();
  const variantEditor = useRouteVariantWorkspaceEditor();
  const {
    currentTab: context,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    isSearching,
    routeParams,
    pointParams,
    handleTabChange,
  } = useTransitTableState();

  const routesQuery = useJeepneyRoutes(routeParams, {
    enabled: context === TRANSIT_CONTEXTS.ROUTES,
  });
  const pointsQuery = useTransitPoints(pointParams, {
    enabled: context === TRANSIT_CONTEXTS.POINTS,
  });
  const routeDetailQuery = useJeepneyRoute(
    context === TRANSIT_CONTEXTS.ROUTES ? expandedRouteId : null,
  );
  const routeReferencePointsQuery = useTransitPointReferences(
    { enabled: context === TRANSIT_CONTEXTS.ROUTES },
  );
  const pointReferenceVariantsQuery = useRouteVariantReferences(
    { enabled: context === TRANSIT_CONTEXTS.POINTS },
  );
  const activePointId =
    context === TRANSIT_CONTEXTS.POINTS ? pointSelection?.id : null;
  const pointDetail = useTransitPoint(activePointId);
  const pointSelectionState = useSelectedTransitRecord({
    id: activePointId, fallback: pointSelection?.fallback, list: pointsQuery,
    detail: pointDetail, field: "transitPoint",
    queryKey: transitQueryKeys.transitPointDetail(activePointId),
  });
  const selectedPoint = pointSelectionState.record;
  const visiblePoints = pointsQuery.items
    .filter((point) => !(pointSelectionState.unavailable && String(point.id) === String(pointSelection?.id)))
    .map((point) => String(point.id) === String(selectedPoint?.id) ? selectedPoint : point);
  const selectedPointOutsideResults = Boolean(
    selectedPoint &&
      !pointsQuery.error &&
      pointsQuery.dataUpdatedAt &&
      !pointsQuery.isPlaceholderData &&
      !visiblePoints.some((point) => String(point.id) === String(selectedPoint.id)),
  );
  const isEditing = mode !== TRANSIT_MODES.BROWSE;
  const routeUnavailable =
    !isEditing && routeDetailQuery.error?.response?.status === 404;
  const visibleRoutes = routeUnavailable
    ? routesQuery.items.filter((route) => String(route.id) !== String(expandedRouteId))
    : routesQuery.items;
  const selectedRoute = routeUnavailable
    ? null
    : routeDetailQuery.route ??
      visibleRoutes.find((route) => String(route.id) === String(selectedRouteId)) ??
      selectedRouteFallback;
  const routeVariants = routeUnavailable
    ? []
    : routeDetailQuery.route?.variants ?? [];
  const listedVariant = routeVariants.find(
    (variant) => String(variant.id) === String(selectedVariantId),
  );
  const selectedVariant =
    listedVariant ??
    (isEditing || (!routeUnavailable && !routeDetailQuery.route)
      ? selectedVariantFallback
      : null);
  const isVariantMode = isVariantEditingMode(mode);
  const isPointMode = isPointEditingMode(mode);
  const isRoutePointCreationMode = isRouteTransitPointCreationMode(mode);
  const isFormMode = [
    TRANSIT_MODES.CREATE_ROUTE,
    TRANSIT_MODES.EDIT_ROUTE,
    TRANSIT_MODES.CREATE_TRANSFER,
    TRANSIT_MODES.EDIT_TRANSFER,
  ].includes(mode);
  const isDirty = isRoutePointCreationMode
    ? variantEditor.isDirty || pointEditor.isDirty
    : isVariantMode
      ? variantEditor.isDirty
    : isPointMode
      ? pointEditor.isDirty
      : isFormMode
        ? formDirty
        : false;
  const navigationGuard = useUnsavedChangesGuard(isDirty);
  const fullscreen = useTransitWorkspaceFullscreen(workspaceRef);
  const isOverlayOpen =
    isLocalDiscardOpen ||
    navigationGuard.isLeaveConfirmationOpen ||
    Boolean(deletingPointId);

  useTransitWorkspaceKeyboardShortcuts({
    isRouteGeometryMode: isVariantMode && !isRoutePointCreationMode,
    canUndoGeometry: variantEditor.canUndo,
    isEditing,
    isOverlayOpen,
    onUndoGeometry: variantEditor.undoGeometry,
    onRequestCancel: requestCancelActiveMode,
  });
  const activeQuery =
    context === TRANSIT_CONTEXTS.ROUTES ? routesQuery : pointsQuery;

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
        positions: geometryPositions(
          routeUnavailable ? [] : routeDetailQuery.route?.variants,
        ),
      };
    }
    return {
      key: focusTarget.key,
      positions: geometryPositions([selectedVariant].filter(Boolean)),
    };
  }, [
    focusTarget,
    routeDetailQuery.route?.variants,
    routeUnavailable,
    selectedVariant,
  ]);

  const handleFormDirtyChange = useCallback((nextDirty) => {
    setFormDirty(nextDirty);
  }, []);

  function requestWorkspaceAction(action) {
    if (deletingPointId) return;
    if (isDirty) {
      pendingActionRef.current = action;
      setIsLocalDiscardOpen(true);
      return;
    }

    action();
  }

  function changeContext(nextContext) {
    if (nextContext === context) {
      return;
    }

    requestWorkspaceAction(() => {
      setFocusTarget(null);
      setFormDirty(false);
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

  function startAddPoint() {
    if (isEditing) return;

    pointEditor.beginAdd();
    setSelectedPoint(null);
    setIsInspectorCollapsed(false);
    setMode(TRANSIT_MODES.ADD_POINT);
  }

  function startCreateRoute() {
    if (isEditing) return;

    setSelectedRouteId(null);
    setSelectedRouteFallback(null);
    setExpandedRouteId(null);
    setSelectedVariantId(null);
    setSelectedVariantFallback(null);
    setIsInspectorCollapsed(false);
    setMode(TRANSIT_MODES.CREATE_ROUTE);
  }

  function startEditRoute() {
    if (isEditing) return;

    setIsInspectorCollapsed(false);
    setMode(TRANSIT_MODES.EDIT_ROUTE);
  }

  function startEditPoint() {
    if (isEditing || !pointSelectionState.canAct) return;

    setEditingPoint(selectedPoint);
    pointEditor.beginEdit(selectedPoint);
    setIsInspectorCollapsed(false);
    setMode(TRANSIT_MODES.EDIT_POINT);
  }

  function startDeletePoint() {
    if (
      mode !== TRANSIT_MODES.BROWSE ||
      context !== TRANSIT_CONTEXTS.POINTS ||
      !pointSelectionState.canAct ||
      !Number.isSafeInteger(Number(selectedPoint?.id)) ||
      Number(selectedPoint.id) <= 0
    ) {
      return;
    }
    requestWorkspaceAction(() => setDeletingPointId(selectedPoint.id));
  }

  function handlePointDeleted(pointId) {
    setDeletingPointId(null);
    if (String(pointSelection?.id) === String(pointId)) {
      setSelectedPoint(null);
      setEditingPoint(null);
      setFocusTarget(null);
      pointEditor.beginAdd();
    }
    setRecentlyCreatedRoutePoints((previous) => previous.filter(
      (point) => String(point.id) !== String(pointId),
    ));
    const cachedPage = client.getQueryData(transitQueryKeys.transitPointList(pointParams));
    const lastPageIndex = Math.max(0, (cachedPage?.pagination?.total_pages ?? 1) - 1);
    if (pagination.pageIndex > lastPageIndex) {
      setPagination({ ...pagination, pageIndex: lastPageIndex });
    }
    void Promise.all([
      client.invalidateQueries({
        queryKey: transitQueryKeys.transitPoints(),
        predicate: (query) => query.queryKey[3] !== "detail",
      }),
      client.invalidateQueries({ queryKey: transitQueryKeys.routes() }),
      client.invalidateQueries({ queryKey: transitQueryKeys.variants() }),
    ]);
  }

  async function savePoint(addAnother) {
    if (mode === TRANSIT_MODES.EDIT_POINT && !pointSelectionState.canAct) return;
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

    client.setQueryData(transitQueryKeys.transitPointDetail(savedPoint.id), savedPoint);
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

  function startRouteTransitPointCreation(role) {
    if (!isVariantMode) {
      return;
    }

    routePointReturnModeRef.current = mode;
    setRoutePointCreationRole(role);
    variantEditor.cancelTransitPointSelection();
    pointEditor.beginAdd();
    setMode(
      mode.startsWith("create-variant")
        ? TRANSIT_MODES.CREATE_VARIANT_POINT
        : TRANSIT_MODES.EDIT_VARIANT_POINT,
    );
  }

  function finishRouteTransitPointCreation() {
    const returnMode = routePointReturnModeRef.current;

    routePointReturnModeRef.current = null;
    setRoutePointCreationRole(null);
    setMode(
      returnMode ??
        (mode.startsWith("create-variant")
          ? TRANSIT_MODES.CREATE_VARIANT_ADJUST
          : TRANSIT_MODES.EDIT_VARIANT_ADJUST),
    );
  }

  function cancelRouteTransitPointCreation() {
    pointEditor.reset();
    finishRouteTransitPointCreation();
  }

  async function saveRouteTransitPoint() {
    const savedPoint = await pointEditor.save({
      mode: TRANSIT_MODES.ADD_POINT,
      selectedPoint: null,
    });

    if (!savedPoint) {
      return;
    }

    setRecentlyCreatedRoutePoints((previous) => [
      ...previous.filter(
        (point) => String(point.id) !== String(savedPoint.id),
      ),
      savedPoint,
    ]);
    variantEditor.attachCreatedTransitPoint(
      String(savedPoint.id),
      routePointCreationRole,
    );
    setFocusTarget({
      type: "point",
      key: `route-point-${savedPoint.id}-${Date.now()}`,
      positions: [
        {
          lat: Number(savedPoint.latitude),
          lng: Number(savedPoint.longitude),
        },
      ],
    });
    finishRouteTransitPointCreation();
  }

  function startCreateVariant() {
    if (!selectedRoute) {
      return;
    }

    variantEditor.begin(selectedRoute);
    setSelectedVariantId(null);
    setSelectedVariantFallback(null);
    setMode(TRANSIT_MODES.CREATE_VARIANT_ADJUST);
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

    if (isRouteDrawingMode(mode) && !variantEditor.isSelectingTransitPoint) {
      setMode(
        isCreating
          ? TRANSIT_MODES.CREATE_VARIANT_ADJUST
          : TRANSIT_MODES.EDIT_VARIANT_ADJUST,
      );
      return;
    }

    if (variantEditor.isSelectingTransitPoint) {
      variantEditor.cancelTransitPointSelection();
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

  function discardLocalChanges() {
    setIsLocalDiscardOpen(false);
    setFormDirty(false);
    pointEditor.reset();
    setMode(TRANSIT_MODES.BROWSE);

    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    pendingAction?.();
  }

  function cancelActiveMode() {
    if (isRoutePointCreationMode) {
      cancelRouteTransitPointCreation();
      return;
    }

    if (isVariantMode) {
      cancelVariantEdit();
      return;
    }
    if (isPointMode) {
      cancelPointEdit();
      return;
    }

    setFormDirty(false);
    setMode(TRANSIT_MODES.BROWSE);
  }

  function requestCancelActiveMode() {
    if (isRoutePointCreationMode) {
      cancelRouteTransitPointCreation();
      return;
    }

    if (variantEditor.isSelectingTransitPoint) {
      variantEditor.cancelTransitPointSelection();
      return;
    }

    requestWorkspaceAction(cancelActiveMode);
  }

  const routeReferencePoints = useMemo(() => {
    const pointIds = new Set(
      routeReferencePointsQuery.items.map((point) => String(point.id)),
    );

    return [
      ...routeReferencePointsQuery.items,
      ...recentlyCreatedRoutePoints.filter(
        (point) => !pointIds.has(String(point.id)),
      ),
    ];
  }, [recentlyCreatedRoutePoints, routeReferencePointsQuery.items]);
  const mapTransitPoints =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routeReferencePoints
      : visiblePoints;
  const referenceLayerError =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routeReferencePointsQuery.error
      : pointReferenceVariantsQuery.error;
  const retryReferenceLayer =
    context === TRANSIT_CONTEXTS.ROUTES
      ? routeReferencePointsQuery.refetch
      : pointReferenceVariantsQuery.refetch;
  const workspaceGridClass = getWorkspaceGridClass(
    isBrowserCollapsed,
    isInspectorCollapsed,
  );

  return (
    <div
      ref={workspaceRef}
      className={`flex flex-col bg-background ${
        fullscreen.isFullscreen
          ? "h-screen overflow-hidden p-4"
          : "rounded-2xl border border-stroke p-4 sm:p-6"
      }`}
    >
      {/* Persistent network context navigation */}
      <div className="mb-4 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <TransitNetworkNavigation context={context} onChange={changeContext} />
        <TransitNetworkContextActions
          context={context}
          mode={mode}
          onAddRoute={startCreateRoute}
          onAddPoint={startAddPoint}
        />
      </div>

      <TransitWorkspaceToolbar
        context={context}
        mode={mode}
        isSelectingTransitPoint={variantEditor.isSelectingTransitPoint}
        isCreatingRouteTransitPoint={isRoutePointCreationMode}
        isBrowserCollapsed={isBrowserCollapsed}
        isInspectorCollapsed={isInspectorCollapsed}
        isFullscreen={fullscreen.isFullscreen}
        isFullscreenSupported={fullscreen.isSupported}
        onToggleBrowser={() => setIsBrowserCollapsed((previous) => !previous)}
        onToggleInspector={() =>
          setIsInspectorCollapsed((previous) => !previous)
        }
        onToggleFullscreen={fullscreen.toggleFullscreen}
      />

      {pointSelectionState.error && (
        <DataErrorState
          compact framed
          title={pointSelectionState.unavailable ? "Selected record is no longer available" : "Unable to refresh selected record"}
          message="Your draft is preserved. Retry to check availability before editing or saving."
          onRetry={pointSelectionState.refetch}
        />
      )}
      {mode === TRANSIT_MODES.EDIT_POINT &&
        selectedPoint &&
        JSON.stringify(selectedPoint) !== JSON.stringify(editingPoint) && (
        <p role="status" className="mb-4 text-sm text-text-secondary">
          Server data changed while you were editing. Your draft is preserved; cancel to review the latest record before saving.
        </p>
      )}

      {/* Shared browser, map, and inspector layout */}
      <div
        className={`grid gap-4 ${workspaceGridClass} ${
          fullscreen.isFullscreen
            ? "min-h-0 flex-1 overflow-y-auto xl:overflow-hidden"
            : "min-h-[72vh]"
        }`}
      >
        <div
          id="transit-context-browser"
          className={`${
            isBrowserCollapsed ? "hidden" : "min-h-[420px]"
          } xl:col-start-1 ${
            fullscreen.isFullscreen ? "xl:h-full" : "xl:h-[72vh]"
          }`}
          aria-hidden={isBrowserCollapsed}
          inert={isBrowserCollapsed}
        >
          {context === TRANSIT_CONTEXTS.ROUTES && (
            <RouteBrowser
              routes={visibleRoutes}
              routeDetail={routeDetailQuery.route}
              expandedRouteId={expandedRouteId}
              selectedRouteId={selectedRouteId}
              selectedVariantId={selectedVariant?.id}
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
            />
          )}
          {context === TRANSIT_CONTEXTS.POINTS && (
            <TransitPointList
              transitPoints={visiblePoints}
              selectedPointId={selectedPoint?.id}
              selectedPointOutsideResults={selectedPointOutsideResults}
              search={globalFilter}
              isSearching={isSearching}
              isLoading={pointsQuery.isLoading}
              error={pointsQuery.error}
              pagination={pagination}
              pageCount={pointsQuery.pageCount}
              totalItems={pointsQuery.totalItems}
              interactionDisabled={isEditing}
              onSearchChange={setGlobalFilter}
              onPageChange={(pageIndex) =>
                setPagination({ ...pagination, pageIndex })
              }
              onPointSelect={selectPoint}
              onRetry={pointsQuery.refetch}
              onStartAdd={startAddPoint}
            />
          )}
        </div>

        <TransitNetworkMapCanvas
          context={context}
          mode={mode}
          routeVariants={routeVariants}
          referenceRouteVariants={pointReferenceVariantsQuery.items}
          selectedVariantId={
            context === TRANSIT_CONTEXTS.ROUTES ? selectedVariant?.id : undefined
          }
          variantEditor={variantEditor}
          transitPoints={mapTransitPoints}
          selectedPoint={selectedPoint}
          selectedPointOutsideResults={selectedPointOutsideResults}
          pointDraftPosition={pointEditor.draftPosition}
          focusRequest={focusRequest}
          referenceLayerError={referenceLayerError}
          referenceLayerLoading={
            context === TRANSIT_CONTEXTS.ROUTES
              ? routeReferencePointsQuery.isLoading
              : context === TRANSIT_CONTEXTS.POINTS && pointReferenceVariantsQuery.isLoading
          }
          isFullscreen={fullscreen.isFullscreen}
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
          isCollapsed={isInspectorCollapsed}
          isFullscreen={fullscreen.isFullscreen}
          routeState={{
            selectedRoute,
            selectedVariant,
            routeDetailQuery,
            routeReferencePointsQuery: {
              ...routeReferencePointsQuery,
              items: routeReferencePoints,
            },
            variantEditor,
            pointEditor,
            routePointCreationRole,
            onDirtyChange: handleFormDirtyChange,
            onRouteSaved: handleRouteSaved,
            onVariantSaved: handleVariantSaved,
            onStartEditRoute: startEditRoute,
            onStartCreateVariant: startCreateVariant,
            onStartEditVariant: startEditVariant,
            onToggleDrawing: toggleRouteDrawing,
            onStartCreateTransitPoint: startRouteTransitPointCreation,
            onSaveRouteTransitPoint: saveRouteTransitPoint,
            onCancelRouteTransitPoint: cancelRouteTransitPointCreation,
            onCancelRoute: () => {
              setFormDirty(false);
              setMode(TRANSIT_MODES.BROWSE);
            },
            onCancelVariant: cancelVariantEdit,
          }}
          pointState={{
            selectedPoint: mode === TRANSIT_MODES.EDIT_POINT ? editingPoint : selectedPoint,
            saveDisabled: mode === TRANSIT_MODES.EDIT_POINT && !pointSelectionState.canAct,
            editDisabled: !pointSelectionState.canAct,
            deleteDisabled: !pointSelectionState.canAct || isDirty || mode !== TRANSIT_MODES.BROWSE,
            values: pointEditor.values,
            errors: pointEditor.errors,
            isSubmitting: pointEditor.isSubmitting,
            submittingAction: pointEditor.submittingAction,
            onNameChange: pointEditor.handleNameChange,
            onStartAdd: startAddPoint,
            onStartEdit: startEditPoint,
            onStartDelete: startDeletePoint,
            onSave: savePoint,
            onCancel: cancelPointEdit,
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

      {/* Transit point deletion confirmation */}
      {deletingPointId && (
        <TransitPointDeleteModal
          key={deletingPointId}
          pointId={deletingPointId}
          onClose={() => setDeletingPointId(null)}
          onDeleted={handlePointDeleted}
        />
      )}
    </div>
  );
}
