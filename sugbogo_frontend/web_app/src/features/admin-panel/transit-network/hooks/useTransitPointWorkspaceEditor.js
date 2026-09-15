import { useState } from "react";
import toast from "react-hot-toast";

import useTransitMutations from "./useTransitMutations";
import { getApiFieldErrors } from "../utils/transitFormatters";

const EMPTY_VALUES = {
  name: "",
  latitude: "",
  longitude: "",
};

function valuesFromPoint(point) {
  return {
    name: point?.name ?? "",
    latitude:
      point?.latitude == null ? "" : Number(point.latitude).toFixed(6),
    longitude:
      point?.longitude == null ? "" : Number(point.longitude).toFixed(6),
  };
}

function validatePoint(values) {
  const errors = {};
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);

  if (!values.name.trim()) {
    errors.name = "Transit Point name is required.";
  }
  if (values.latitude === "" || latitude < -90 || latitude > 90) {
    errors.latitude = "Select a valid latitude on the map.";
  }
  if (values.longitude === "" || longitude < -180 || longitude > 180) {
    errors.longitude = "Select a valid longitude on the map.";
  }

  return errors;
}

/**
 * Owns temporary Transit Point form and marker state until an explicit save
 * succeeds through the existing React Query mutations.
 */
export default function useTransitPointWorkspaceEditor() {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [baseline, setBaseline] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [submittingAction, setSubmittingAction] = useState(null);
  const { createPoint, updatePoint, isCreatingPoint, isUpdatingPoint } =
    useTransitMutations();
  const isSubmitting = isCreatingPoint || isUpdatingPoint;
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const draftPosition =
    values.latitude !== "" && values.longitude !== ""
      ? {
          lat: Number(values.latitude),
          lng: Number(values.longitude),
        }
      : null;

  function beginAdd() {
    setValues(EMPTY_VALUES);
    setBaseline(EMPTY_VALUES);
    setErrors({});
  }

  function beginEdit(point) {
    const nextValues = valuesFromPoint(point);

    setValues(nextValues);
    setBaseline(nextValues);
    setErrors({});
  }

  function reset() {
    setValues(baseline);
    setErrors({});
    setSubmittingAction(null);
  }

  function handleNameChange(event) {
    setValues((previous) => ({
      ...previous,
      name: event.target.value,
    }));
    setErrors((previous) => ({
      ...previous,
      name: undefined,
    }));
  }

  function handlePositionChange(position) {
    setValues((previous) => ({
      ...previous,
      latitude: position.lat.toFixed(6),
      longitude: position.lng.toFixed(6),
    }));
    setErrors((previous) => ({
      ...previous,
      latitude: undefined,
      longitude: undefined,
      coordinates: undefined,
    }));
  }

  async function save({ mode, selectedPoint, addAnother = false }) {
    if (isSubmitting) {
      return null;
    }

    const validationErrors = validatePoint(values);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return null;
    }

    const data = {
      name: values.name.trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };

    setSubmittingAction(addAnother ? "another" : "save");

    try {
      const savedPoint =
        mode === "edit-transit-point"
          ? await updatePoint({
              transitPointId: selectedPoint.id,
              data,
            })
          : await createPoint(data);

      toast.success(
        mode === "edit-transit-point"
          ? "Transit Point updated successfully."
          : "Transit Point created successfully.",
      );

      if (addAnother) {
        beginAdd();
      } else {
        const savedValues = valuesFromPoint(savedPoint);

        setValues(savedValues);
        setBaseline(savedValues);
      }

      return savedPoint;
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The Transit Point could not be ${mode === "edit-transit-point" ? "updated" : "created"}.`,
      );
      return null;
    } finally {
      setSubmittingAction(null);
    }
  }

  return {
    values,
    errors,
    isDirty,
    isSubmitting,
    submittingAction,
    draftPosition,
    beginAdd,
    beginEdit,
    reset,
    handleNameChange,
    handlePositionChange,
    save,
  };
}
