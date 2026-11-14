import { Save } from "lucide-react";

import Button from "@/shared/components/Button";

import { validateVariantEditor } from "../../utils/variantEditorUtils";
import EditorConfirmationModal from "../route-variant-editor/EditorConfirmationModal";
import GeometryEditorControls from "../route-variant-editor/GeometryEditorControls";
import OrderedTransitPointPanel from "../route-variant-editor/OrderedTransitPointPanel";
import { useState } from "react";

/**
 * Presents the existing ordered-point and geometry tools inside the persistent
 * workspace inspector for route variant creation and path editing.
 */
export default function RouteVariantEditorPanel({
  route,
  variant,
  transitPoints,
  editor,
  isDrawing,
  onToggleDrawing,
  onCreateTransitPoint,
  onCancel,
  onSaved,
}) {
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const [saveRequirement] = Object.values(
    validateVariantEditor(editor.editorState),
  );

  async function handleSave() {
    const savedVariant = await editor.save(variant);

    if (savedVariant) {
      onSaved(savedVariant);
    }
  }

  return (
    <>
      <section className="space-y-4">
        {/* Editing mode heading */}
        <div className="rounded-xl border border-stroke bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {variant ? "Edit direction" : "Add direction"}
          </p>
          <h2 className="mt-1 font-semibold text-text-primary">
            Route {route.code}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Choose the starting and last stops and draw the route path. Add
            stops along the way as needed. The return journey needs its own
            direction.
          </p>
          {editor.isDirty && (
            <p className="mt-3 text-xs font-semibold text-warning">
              Unsaved changes
            </p>
          )}
        </div>

        <OrderedTransitPointPanel
          transitPoints={transitPoints}
          originId={editor.editorState.originId}
          destinationId={editor.editorState.destinationId}
          intermediatePointIds={editor.editorState.intermediatePointIds}
          errors={editor.errors}
          onOriginChange={editor.changeOrigin}
          onDestinationChange={editor.changeDestination}
          isSelectingTransitPoint={editor.isSelectingTransitPoint}
          onBeginTransitPointSelection={editor.beginTransitPointSelection}
          onCancelTransitPointSelection={editor.cancelTransitPointSelection}
          onSelectTransitPoint={(pointId) =>
            editor.selectTransitPoint(pointId, { keepOpen: true })
          }
          onCreateTransitPoint={onCreateTransitPoint}
          onMoveIntermediate={editor.moveIntermediate}
          onRemoveIntermediate={editor.removeIntermediate}
        />
        <GeometryEditorControls
          geometry={editor.editorState.geometry}
          isDrawing={isDrawing}
          canUndo={editor.canUndo}
          error={editor.errors.geometry}
          onToggleDrawing={onToggleDrawing}
          onUndo={editor.undoGeometry}
          onRequestClear={() => setIsClearConfirmationOpen(true)}
          onUpdateVertex={editor.updateGeometryVertex}
          onRemoveVertex={editor.removeGeometryVertex}
        />
        {editor.errors.non_field_errors && (
          <p
            className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger"
            role="alert"
          >
            {editor.errors.non_field_errors}
          </p>
        )}

        {/* Editor actions */}
        <div className="sticky bottom-0 space-y-2 rounded-xl border border-stroke bg-background/95 p-4 shadow-lg backdrop-blur-sm">
          {saveRequirement && (
            <p className="text-xs text-text-secondary">
              {saveRequirement}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={editor.isSaving}
            >
              Cancel
            </Button>
            <Button
              icon={Save}
              loading={editor.isSaving}
              disabled={!editor.isDirty}
              disabledTooltip={
                saveRequirement || "Make a route change before saving."
              }
              onClick={handleSave}
            >
              {variant ? "Save Changes" : "Save Direction"}
            </Button>
          </div>
        </div>
      </section>

      {/* Clear geometry confirmation */}
      <EditorConfirmationModal
        isOpen={isClearConfirmationOpen}
        title="Clear Route Path?"
        description="All drawing points for this path will be removed from the editor."
        warning="You can restore the cleared geometry with Undo while this editor remains open."
        confirmLabel="Clear Route"
        onCancel={() => setIsClearConfirmationOpen(false)}
        onConfirm={() => {
          editor.clearGeometry();
          setIsClearConfirmationOpen(false);
        }}
      />
    </>
  );
}
