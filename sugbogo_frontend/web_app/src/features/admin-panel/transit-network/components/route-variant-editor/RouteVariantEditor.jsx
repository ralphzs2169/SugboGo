import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Save } from "lucide-react";

import Button from "@/shared/components/Button";

import useTransitMutations from "../../hooks/useTransitMutations";
import useUnsavedChangesGuard from "../../hooks/useUnsavedChangesGuard";
import { getApiFieldErrors } from "../../utils/transitFormatters";
import {
  buildVariantPayload,
  createVariantSnapshot,
  getInitialVariantEditorState,
  moveListItem,
  validateVariantEditor,
} from "../../utils/variantEditorUtils";
import EditorConfirmationModal from "./EditorConfirmationModal";
import GeometryEditorControls from "./GeometryEditorControls";
import OrderedTransitPointPanel from "./OrderedTransitPointPanel";
import RouteVariantMapWorkspace from "./RouteVariantMapWorkspace";

const ROUTES_PATH = "/admin-panel/transit-network?tab=routes";

/**
 * Coordinates controlled geometry, ordered Transit Points, validation, and saving.
 */
export default function RouteVariantEditor({ route, variant, transitPoints }) {
  const initialState = getInitialVariantEditorState(route.id, variant);
  const [editorState, setEditorState] = useState(initialState);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    createVariantSnapshot(initialState),
  );
  const [geometryHistory, setGeometryHistory] = useState([]);
  const [isDrawing, setIsDrawing] = useState(!variant);
  const [errors, setErrors] = useState({});
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] =
    useState(false);
  const {
    createVariant,
    updateVariant,
    isCreatingVariant,
    isUpdatingVariant,
  } = useTransitMutations();
  const currentSnapshot = createVariantSnapshot(editorState);
  const isDirty = currentSnapshot !== savedSnapshot;
  const isSaving = isCreatingVariant || isUpdatingVariant;
  const guard = useUnsavedChangesGuard(isDirty);

  function updateEditorState(updater, clearedErrorFields = []) {
    setEditorState(updater);

    if (clearedErrorFields.length) {
      setErrors((previous) => {
        const next = { ...previous };

        clearedErrorFields.forEach((field) => {
          delete next[field];
        });

        return next;
      });
    }
  }

  function commitGeometry(nextGeometry) {
    setGeometryHistory((previous) => [
      ...previous,
      editorState.geometry.map((coordinate) => ({ ...coordinate })),
    ]);
    updateEditorState(
      (previous) => ({ ...previous, geometry: nextGeometry }),
      ["geometry"],
    );
  }

  function handleAddGeometryVertex(coordinate) {
    commitGeometry([...editorState.geometry, coordinate]);
  }

  function handleUpdateGeometryVertex(index, coordinate) {
    const nextGeometry = editorState.geometry.map((item, itemIndex) =>
      itemIndex === index ? coordinate : item,
    );

    commitGeometry(nextGeometry);
  }

  function handleRemoveGeometryVertex(index) {
    commitGeometry(
      editorState.geometry.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function handleUndoGeometry() {
    const previousGeometry = geometryHistory.at(-1);

    if (!previousGeometry) {
      return;
    }

    setEditorState((previous) => ({
      ...previous,
      geometry: previousGeometry,
    }));
    setGeometryHistory((previous) => previous.slice(0, -1));
    setErrors((previous) => ({ ...previous, geometry: undefined }));
  }

  function handleOriginChange(originId) {
    if (originId && originId === editorState.destinationId) {
      setErrors((previous) => ({
        ...previous,
        origin_transit_point_id:
          "The origin must differ from the destination.",
      }));
      return;
    }

    updateEditorState(
      (previous) => ({
        ...previous,
        originId,
        intermediatePointIds: previous.intermediatePointIds.filter(
          (pointId) => pointId !== originId,
        ),
      }),
      ["origin_transit_point_id", "transit_point_ids"],
    );
  }

  function handleDestinationChange(destinationId) {
    if (destinationId && destinationId === editorState.originId) {
      setErrors((previous) => ({
        ...previous,
        destination_transit_point_id:
          "The destination must differ from the origin.",
      }));
      return;
    }

    updateEditorState(
      (previous) => ({
        ...previous,
        destinationId,
        intermediatePointIds: previous.intermediatePointIds.filter(
          (pointId) => pointId !== destinationId,
        ),
      }),
      ["destination_transit_point_id", "transit_point_ids"],
    );
  }

  function handleAddIntermediate(pointId) {
    if (
      pointId === editorState.originId ||
      pointId === editorState.destinationId ||
      editorState.intermediatePointIds.includes(pointId)
    ) {
      return;
    }

    updateEditorState(
      (previous) => ({
        ...previous,
        intermediatePointIds: [...previous.intermediatePointIds, pointId],
      }),
      ["transit_point_ids"],
    );
  }

  function handleTransitPointMapSelect(pointId) {
    if (!editorState.originId) {
      handleOriginChange(pointId);
      toast.success("Origin Transit Point selected.");
      return;
    }
    if (!editorState.destinationId && pointId !== editorState.originId) {
      handleDestinationChange(pointId);
      toast.success("Destination Transit Point selected.");
      return;
    }

    const isAlreadySelected =
      pointId === editorState.originId ||
      pointId === editorState.destinationId ||
      editorState.intermediatePointIds.includes(pointId);

    if (isAlreadySelected) {
      toast("This Transit Point is already in the route.");
      return;
    }

    handleAddIntermediate(pointId);
    toast.success("Intermediate Transit Point added.");
  }

  function handleMoveIntermediate(index, direction) {
    updateEditorState(
      (previous) => ({
        ...previous,
        intermediatePointIds: moveListItem(
          previous.intermediatePointIds,
          index,
          direction,
        ),
      }),
      ["transit_point_ids"],
    );
  }

  function handleRemoveIntermediate(index) {
    updateEditorState(
      (previous) => ({
        ...previous,
        intermediatePointIds: previous.intermediatePointIds.filter(
          (_, itemIndex) => itemIndex !== index,
        ),
      }),
      ["transit_point_ids"],
    );
  }

  async function handleSave() {
    const validationErrors = validateVariantEditor(editorState);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      toast.error("Complete the required route information before saving.");
      return;
    }

    try {
      const payload = buildVariantPayload(editorState);
      const savedVariant = variant
        ? await updateVariant({ variantId: variant.id, data: payload })
        : await createVariant(payload);
      const savedState = getInitialVariantEditorState(route.id, savedVariant);

      setEditorState(savedState);
      setSavedSnapshot(createVariantSnapshot(savedState));
      setGeometryHistory([]);
      guard.allowNavigation();
      toast.success(
        variant
          ? "Route variant updated successfully."
          : "Route variant created successfully.",
      );
      guard.requestNavigation(ROUTES_PATH);
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The route variant could not be ${variant ? "updated" : "created"}.`,
      );
    }
  }

  return (
    <>
      {/* Editor action bar */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-stroke bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => guard.requestNavigation(ROUTES_PATH)}
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Transit Network
        </button>
        <div className="flex items-center justify-end gap-3">
          {isDirty && (
            <span className="text-xs font-medium text-warning">
              Unsaved changes
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => guard.requestNavigation(ROUTES_PATH)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            icon={Save}
            loading={isSaving}
            disabled={!isDirty}
            disabledTooltip="Make a route change before saving."
            onClick={handleSave}
          >
            {variant ? "Save Route Path" : "Create Variant"}
          </Button>
        </div>
      </div>

      {/* Map-first editor layout */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <RouteVariantMapWorkspace
          geometry={editorState.geometry}
          transitPoints={transitPoints}
          originId={editorState.originId}
          destinationId={editorState.destinationId}
          intermediatePointIds={editorState.intermediatePointIds}
          isDrawing={isDrawing}
          onAddGeometryVertex={handleAddGeometryVertex}
          onMoveGeometryVertex={handleUpdateGeometryVertex}
          onTransitPointSelect={handleTransitPointMapSelect}
        />

        {/* Route configuration panel */}
        <aside className="space-y-5">
          <OrderedTransitPointPanel
            transitPoints={transitPoints}
            originId={editorState.originId}
            destinationId={editorState.destinationId}
            intermediatePointIds={editorState.intermediatePointIds}
            errors={errors}
            onOriginChange={handleOriginChange}
            onDestinationChange={handleDestinationChange}
            onAddIntermediate={handleAddIntermediate}
            onMoveIntermediate={handleMoveIntermediate}
            onRemoveIntermediate={handleRemoveIntermediate}
          />
          <GeometryEditorControls
            geometry={editorState.geometry}
            isDrawing={isDrawing}
            canUndo={geometryHistory.length > 0}
            error={errors.geometry}
            onToggleDrawing={() => setIsDrawing((current) => !current)}
            onUndo={handleUndoGeometry}
            onRequestClear={() => setIsClearConfirmationOpen(true)}
            onUpdateVertex={handleUpdateGeometryVertex}
            onRemoveVertex={handleRemoveGeometryVertex}
          />
          {errors.non_field_errors && (
            <p
              className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger"
              role="alert"
            >
              {errors.non_field_errors}
            </p>
          )}
        </aside>
      </div>

      {/* Clear geometry confirmation */}
      <EditorConfirmationModal
        isOpen={isClearConfirmationOpen}
        title="Clear Route Geometry?"
        description="All current LineString vertices will be removed from the editor."
        warning="You can restore the cleared geometry with Undo while this editor remains open."
        confirmLabel="Clear Route"
        onCancel={() => setIsClearConfirmationOpen(false)}
        onConfirm={() => {
          commitGeometry([]);
          setIsClearConfirmationOpen(false);
        }}
      />

      {/* Unsaved navigation confirmation */}
      <EditorConfirmationModal
        isOpen={guard.isLeaveConfirmationOpen}
        title="Discard Unsaved Route Changes?"
        description="Your geometry and ordered Transit Point changes have not been saved."
        warning="Discarded route changes cannot be recovered after leaving this page."
        confirmLabel="Discard and Leave"
        onCancel={guard.stayOnPage}
        onConfirm={guard.discardAndLeave}
      />
    </>
  );
}
