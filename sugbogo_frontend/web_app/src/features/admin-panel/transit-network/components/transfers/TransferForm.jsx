import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import SelectInput from "@/shared/components/forms/SelectInput";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useTransitMutations from "../../hooks/useTransitMutations";
import { useRouteVariants } from "../../hooks/useTransitQueries";
import {
  formatVariantLabel,
  getApiFieldErrors,
} from "../../utils/transitFormatters";

const EMPTY_VALUES = {
  source_variant_id: "",
  destination_variant_id: "",
  alighting_transit_point_id: "",
  boarding_transit_point_id: "",
};

function valuesFromTransfer(transfer) {
  if (!transfer) {
    return EMPTY_VALUES;
  }

  return {
    source_variant_id: String(transfer.source_variant.id),
    destination_variant_id: String(transfer.destination_variant.id),
    alighting_transit_point_id: String(transfer.alighting_transit_point.id),
    boarding_transit_point_id: String(transfer.boarding_transit_point.id),
  };
}

function getVariantPointOptions(variant) {
  return (
    variant?.transit_points?.map((routePoint) => routePoint.transit_point) ?? []
  );
}

/**
 * Creates or edits a directed transfer in the shared inspector using complete
 * route-variant data and the existing mutation contract.
 */
export default function TransferForm({
  transfer,
  onDirtyChange,
  onCancel,
  onSaved,
}) {
  const initialValues = useMemo(() => valuesFromTransfer(transfer), [transfer]);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const {
    items: variants,
    isLoading: areVariantsLoading,
    error: variantsError,
    refetch: refetchVariants,
  } = useRouteVariants({ page_size: 100 });
  const {
    createTransfer,
    updateTransfer,
    isCreatingTransfer,
    isUpdatingTransfer,
  } = useTransitMutations();
  const isEditing = Boolean(transfer);
  const isSubmitting = isCreatingTransfer || isUpdatingTransfer;
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useApiErrorNotification(variantsError, {
    toastId: "transit-transfer-workspace-variant-options-error",
    fallbackMessage: "Unable to load route variant options.",
  });

  const sourceVariant = useMemo(
    () =>
      variants.find(
        (variant) => String(variant.id) === values.source_variant_id,
      ),
    [variants, values.source_variant_id],
  );
  const destinationVariant = useMemo(
    () =>
      variants.find(
        (variant) => String(variant.id) === values.destination_variant_id,
      ),
    [variants, values.destination_variant_id],
  );
  const alightingOptions = getVariantPointOptions(sourceVariant);
  const boardingOptions = getVariantPointOptions(destinationVariant);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => {
      const next = { ...previous, [name]: value };

      if (name === "source_variant_id") {
        next.alighting_transit_point_id = "";
      }
      if (name === "destination_variant_id") {
        next.boarding_transit_point_id = "";
      }

      return next;
    });
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function validateValues() {
    const nextErrors = {};

    Object.entries(values).forEach(([field, value]) => {
      if (!value) {
        nextErrors[field] = "This selection is required.";
      }
    });

    if (
      values.source_variant_id &&
      values.source_variant_id === values.destination_variant_id
    ) {
      nextErrors.destination_variant_id =
        "The destination variant must differ from the source.";
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateValues();

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    const data = Object.fromEntries(
      Object.entries(values).map(([field, value]) => [field, Number(value)]),
    );

    try {
      const savedTransfer = isEditing
        ? await updateTransfer({ transferId: transfer.id, data })
        : await createTransfer(data);

      toast.success(
        isEditing
          ? "Transit transfer updated successfully."
          : "Pending transit transfer created successfully.",
      );
      onDirtyChange(false);
      onSaved(savedTransfer);
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The transfer could not be ${isEditing ? "updated" : "created"}.`,
      );
    }
  }

  if (variantsError) {
    return (
      <DataErrorState
        title="Unable to load route variants"
        message="Transfer selections are unavailable until route variants load."
        onRetry={refetchVariants}
      />
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Transfer editor heading */}
      <div className="rounded-xl border border-stroke bg-background p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {isEditing ? "Edit transfer" : "Create transfer"}
        </p>
        <h2 className="mt-1 font-semibold text-text-primary">
          {isEditing ? "Edit Connection" : "New Pending Transfer"}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Define a directed connection using Transit Points that belong to each
          selected variant.
        </p>
      </div>

      {/* Source connection */}
      <fieldset className="space-y-4 rounded-xl border border-stroke bg-background p-4">
        <legend className="px-2 text-sm font-semibold text-text-primary">
          Source connection
        </legend>
        <SelectInput
          id="workspace-source-variant"
          name="source_variant_id"
          label="Source Route Variant"
          value={values.source_variant_id}
          onChange={handleChange}
          error={errors.source_variant_id}
          disabled={areVariantsLoading}
          required
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {formatVariantLabel(variant)}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          id="workspace-alighting-point"
          name="alighting_transit_point_id"
          label="Alighting Transit Point"
          value={values.alighting_transit_point_id}
          onChange={handleChange}
          error={errors.alighting_transit_point_id}
          disabled={!sourceVariant}
          required
        >
          {alightingOptions.map((point) => (
            <option key={point.id} value={point.id}>
              {point.name}
            </option>
          ))}
        </SelectInput>
      </fieldset>

      {/* Destination connection */}
      <fieldset className="space-y-4 rounded-xl border border-stroke bg-background p-4">
        <legend className="px-2 text-sm font-semibold text-text-primary">
          Destination connection
        </legend>
        <SelectInput
          id="workspace-destination-variant"
          name="destination_variant_id"
          label="Destination Route Variant"
          value={values.destination_variant_id}
          onChange={handleChange}
          error={errors.destination_variant_id}
          disabled={areVariantsLoading}
          required
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {formatVariantLabel(variant)}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          id="workspace-boarding-point"
          name="boarding_transit_point_id"
          label="Boarding Transit Point"
          value={values.boarding_transit_point_id}
          onChange={handleChange}
          error={errors.boarding_transit_point_id}
          disabled={!destinationVariant}
          required
        >
          {boardingOptions.map((point) => (
            <option key={point.id} value={point.id}>
              {point.name}
            </option>
          ))}
        </SelectInput>
      </fieldset>

      {errors.non_field_errors && (
        <p className="text-sm font-medium text-danger" role="alert">
          {errors.non_field_errors}
        </p>
      )}

      {/* Form actions */}
      <div className="sticky bottom-0 flex justify-end gap-2 rounded-xl border border-stroke bg-background/95 p-4 shadow-lg backdrop-blur-sm">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isEditing ? "Save Connection" : "Add Pending Transfer"}
        </Button>
      </div>
    </form>
  );
}
