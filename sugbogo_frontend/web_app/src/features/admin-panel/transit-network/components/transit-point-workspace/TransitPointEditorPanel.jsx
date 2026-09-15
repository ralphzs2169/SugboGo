import { Edit3, MapPin, Plus } from "lucide-react";

import Button from "@/shared/components/Button";
import TextInput from "@/shared/components/forms/TextInput";

/**
 * Presents selected Transit Point details or the controlled add/edit form whose
 * coordinates are supplied exclusively by the map workspace.
 */
export default function TransitPointEditorPanel({
  mode,
  selectedPoint,
  values,
  errors,
  isSubmitting,
  submittingAction,
  onNameChange,
  onStartAdd,
  onStartEdit,
  onSave,
  onCancel,
}) {
  if (mode === "browse" && !selectedPoint) {
    return (
      <div className="rounded-xl border border-dashed border-stroke-strong bg-surface p-5 text-center">
        <MapPin className="mx-auto h-8 w-8 text-text-secondary" />
        <p className="mt-3 text-sm font-semibold text-text-primary">
          Select a Transit Point
        </p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Choose a marker or list item to inspect it, or place new transit
          infrastructure on the map.
        </p>
        <Button className="mt-4" size="sm" icon={Plus} onClick={onStartAdd}>
          Add Point
        </Button>
      </div>
    );
  }

  if (mode === "browse") {
    return (
      <div className="rounded-xl border border-stroke bg-surface p-4">
        {/* Selected point summary */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Selected Transit Point
            </p>
            <h3 className="mt-1 truncate font-semibold text-text-primary">
              {selectedPoint.name}
            </h3>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={Edit3}
            onClick={onStartEdit}
          >
            Edit
          </Button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-text-secondary">Latitude</dt>
            <dd className="mt-1 font-mono tabular-nums text-text-primary">
              {Number(selectedPoint.latitude).toFixed(6)}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Longitude</dt>
            <dd className="mt-1 font-mono tabular-nums text-text-primary">
              {Number(selectedPoint.longitude).toFixed(6)}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const isAdding = mode === "add-transit-point";

  function handleSubmit(event) {
    event.preventDefault();
    onSave(false);
  }

  return (
    <form
      className="rounded-xl border border-stroke bg-surface p-4"
      onSubmit={handleSubmit}
    >
      {/* Editor heading */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {isAdding ? "Placement mode" : "Edit mode"}
        </p>
        <h3 className="mt-1 font-semibold text-text-primary">
          {isAdding ? "Add Transit Point" : `Edit ${selectedPoint?.name}`}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          {values.latitude
            ? "Drag the highlighted marker or click the map to adjust its location."
            : "Click the map to choose the managed point location."}
        </p>
      </div>

      {/* Point fields */}
      <div className="mt-4 space-y-3">
        <TextInput
          id="transit-point-workspace-name"
          name="name"
          label="Name"
          placeholder="e.g. Cebu Provincial Capitol"
          value={values.name}
          onChange={onNameChange}
          error={errors.name}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <TextInput
            id="transit-point-workspace-latitude"
            name="latitude"
            type="number"
            label="Latitude"
            placeholder="Select on map"
            value={values.latitude}
            error={errors.latitude}
            readOnly
            required
          />
          <TextInput
            id="transit-point-workspace-longitude"
            name="longitude"
            type="number"
            label="Longitude"
            placeholder="Select on map"
            value={values.longitude}
            error={errors.longitude}
            readOnly
            required
          />
        </div>
        {errors.coordinates && (
          <p className="text-xs font-bold text-danger" role="alert">
            {errors.coordinates}
          </p>
        )}
      </div>

      {/* Editor actions */}
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stroke pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        {isAdding && (
          <Button
            variant="secondary"
            loading={isSubmitting && submittingAction === "another"}
            disabled={isSubmitting}
            onClick={() => onSave(true)}
          >
            Save & Add Another
          </Button>
        )}
        <Button
          type="submit"
          loading={isSubmitting && submittingAction === "save"}
          disabled={isSubmitting}
        >
          {isAdding ? "Save Point" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
