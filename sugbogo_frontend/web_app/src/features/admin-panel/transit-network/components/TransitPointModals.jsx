import { useState } from "react";
import toast from "react-hot-toast";
import { MapPin } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import TextInput from "@/shared/components/forms/TextInput";
import Modal from "@/shared/components/modals/Modal";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useTransitMutations from "../hooks/useTransitMutations";
import { useTransitPoint } from "../hooks/useTransitQueries";
import { getApiFieldErrors } from "../utils/transitFormatters";
import TransitPointMapPicker from "./transit-point-editor/TransitPointMapPicker";

const EMPTY_VALUES = { name: "", latitude: "", longitude: "" };

function validatePoint(values) {
  const errors = {};
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);

  if (!values.name.trim()) {
    errors.name = "Transit Point name is required.";
  }
  if (values.latitude === "" || latitude < -90 || latitude > 90) {
    errors.latitude = "Enter a latitude between -90 and 90.";
  }
  if (values.longitude === "" || longitude < -180 || longitude > 180) {
    errors.longitude = "Enter a longitude between -180 and 180.";
  }

  return errors;
}

/**
 * Provides the controlled create/edit dialog for transit infrastructure points.
 */
export function TransitPointFormModal({ isOpen, transitPoint, onClose }) {
  const [values, setValues] = useState(() =>
    transitPoint
      ? {
          name: transitPoint.name ?? "",
          latitude: String(transitPoint.latitude ?? ""),
          longitude: String(transitPoint.longitude ?? ""),
        }
      : EMPTY_VALUES,
  );
  const [errors, setErrors] = useState({});
  const { createPoint, updatePoint, isCreatingPoint, isUpdatingPoint } =
    useTransitMutations();
  const isEditing = Boolean(transitPoint);
  const isSubmitting = isCreatingPoint || isUpdatingPoint;
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);
  const hasValidPosition =
    values.latitude !== "" &&
    values.longitude !== "" &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  const position = hasValidPosition
    ? {
        lat: latitude,
        lng: longitude,
      }
    : null;

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function handlePositionChange(nextPosition) {
    setValues((previous) => ({
      ...previous,
      latitude: nextPosition.lat.toFixed(6),
      longitude: nextPosition.lng.toFixed(6),
    }));
    setErrors((previous) => ({
      ...previous,
      latitude: undefined,
      longitude: undefined,
      coordinates: undefined,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validatePoint(values);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    const data = {
      name: values.name.trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };

    try {
      if (isEditing) {
        await updatePoint({ transitPointId: transitPoint.id, data });
      } else {
        await createPoint(data);
      }

      toast.success(
        isEditing
          ? "Transit Point updated successfully."
          : "Transit Point created successfully.",
      );
      onClose();
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The Transit Point could not be ${isEditing ? "updated" : "created"}.`,
      );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Transit Point" : "Add Transit Point"}
      description="Store a SugboGo-managed point used by the transit network."
      maxWidth="max-w-3xl"
      scrollable
    >
      {/* Transit Point form */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <TextInput
          id="transit-point-name"
          name="name"
          label="Name"
          placeholder="e.g. Cebu Provincial Capitol"
          value={values.name}
          onChange={handleChange}
          error={errors.name}
          required
        />

        {/* Visual location picker */}
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">
            Location <span className="text-danger">*</span>
          </p>
          <TransitPointMapPicker
            position={position}
            onPositionChange={handlePositionChange}
          />
        </div>

        {/* Coordinate verification */}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="transit-point-latitude"
            name="latitude"
            type="number"
            min="-90"
            max="90"
            step="any"
            label="Latitude"
            placeholder="10.315699"
            value={values.latitude}
            error={errors.latitude}
            readOnly
            required
          />
          <TextInput
            id="transit-point-longitude"
            name="longitude"
            type="number"
            min="-180"
            max="180"
            step="any"
            label="Longitude"
            placeholder="123.885437"
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

        {/* Form actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? "Save Changes" : "Add Transit Point"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Displays one managed Transit Point and its frontend-friendly coordinates.
 */
export function TransitPointDetailModal({ transitPointId, onClose }) {
  const isOpen = Boolean(transitPointId);
  const { transitPoint, isLoading, error, refetch } = useTransitPoint(
    transitPointId,
    { enabled: isOpen },
  );

  useApiErrorNotification(error, {
    toastId: `transit-point-detail-${transitPointId}-error`,
    fallbackMessage: "Unable to load the Transit Point.",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transit Point Details"
      description="Review the managed transit location and its coordinates."
    >
      {isLoading ? (
        <div className="h-36 animate-pulse rounded-xl bg-skeleton" />
      ) : error ? (
        <DataErrorState
          title="Unable to load Transit Point"
          message="The Transit Point details could not be loaded."
          onRetry={refetch}
        />
      ) : (
        <div className="rounded-xl border border-stroke bg-surface p-5">
          {/* Transit Point detail */}
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-text-primary">
                {transitPoint?.name}
              </h3>
              <dl className="mt-4 grid grid-cols-2 gap-5 text-sm">
                <div>
                  <dt className="text-text-secondary">Latitude</dt>
                  <dd className="mt-1 font-mono tabular-nums text-text-primary">
                    {transitPoint?.latitude}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Longitude</dt>
                  <dd className="mt-1 font-mono tabular-nums text-text-primary">
                    {transitPoint?.longitude}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
