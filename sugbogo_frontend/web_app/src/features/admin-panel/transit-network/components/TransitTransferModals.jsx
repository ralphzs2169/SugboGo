import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, Check, X } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import SelectInput from "@/shared/components/forms/SelectInput";
import Modal from "@/shared/components/modals/Modal";
import StatusBadge from "@/shared/components/StatusBadge";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useTransitMutations from "../hooks/useTransitMutations";
import {
  useRouteVariants,
  useTransitTransfer,
} from "../hooks/useTransitQueries";
import {
  formatVariantLabel,
  getApiFieldErrors,
} from "../utils/transitFormatters";

const EMPTY_VALUES = {
  source_variant_id: "",
  destination_variant_id: "",
  alighting_transit_point_id: "",
  boarding_transit_point_id: "",
};
const STATUS_VARIANTS = {
  pending: "warning",
  confirmed: "success",
  ignored: "muted",
};

function getVariantPointOptions(variant) {
  return (
    variant?.transit_points?.map((routePoint) => routePoint.transit_point) ?? []
  );
}

/**
 * Provides manual create/edit controls for a directed transfer connection.
 */
export function TransitTransferFormModal({ isOpen, transfer, onClose }) {
  const [values, setValues] = useState(() =>
    transfer
      ? {
          source_variant_id: String(transfer.source_variant.id),
          destination_variant_id: String(transfer.destination_variant.id),
          alighting_transit_point_id: String(
            transfer.alighting_transit_point.id,
          ),
          boarding_transit_point_id: String(
            transfer.boarding_transit_point.id,
          ),
        }
      : EMPTY_VALUES,
  );
  const [errors, setErrors] = useState({});
  const {
    items: variants,
    isLoading: areVariantsLoading,
    error: variantsError,
    refetch: refetchVariants,
  } = useRouteVariants(
    { page_size: 100 },
    { enabled: isOpen },
  );
  const {
    createTransfer,
    updateTransfer,
    isCreatingTransfer,
    isUpdatingTransfer,
  } = useTransitMutations();
  const isEditing = Boolean(transfer);
  const isSubmitting = isCreatingTransfer || isUpdatingTransfer;

  useApiErrorNotification(variantsError, {
    toastId: "transit-transfer-variant-options-error",
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
      if (isEditing) {
        await updateTransfer({ transferId: transfer.id, data });
      } else {
        await createTransfer(data);
      }

      toast.success(
        isEditing
          ? "Transit transfer updated successfully."
          : "Pending transit transfer created successfully.",
      );
      onClose();
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The transfer could not be ${isEditing ? "updated" : "created"}.`,
      );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Transit Transfer" : "Add Transit Transfer"}
      description="Define the directed alighting and boarding connection between variants."
      maxWidth="max-w-2xl"
      scrollable
    >
      {variantsError ? (
        <DataErrorState
          title="Unable to load route variants"
          message="Transfer selections are unavailable until route variants load."
          onRetry={refetchVariants}
        />
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Source connection */}
          <fieldset className="space-y-4 rounded-xl border border-stroke p-4">
            <legend className="px-2 text-sm font-semibold text-text-primary">
              Source connection
            </legend>
            <SelectInput
              id="source-variant"
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
              id="alighting-point"
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
          <fieldset className="space-y-4 rounded-xl border border-stroke p-4">
            <legend className="px-2 text-sm font-semibold text-text-primary">
              Destination connection
            </legend>
            <SelectInput
              id="destination-variant"
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
              id="boarding-point"
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
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEditing ? "Save Connection" : "Add Pending Transfer"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Displays the complete directed connection and review status for one transfer.
 */
export function TransitTransferDetailModal({ transferId, onClose }) {
  const isOpen = Boolean(transferId);
  const { transfer, isLoading, error, refetch } = useTransitTransfer(
    transferId,
    { enabled: isOpen },
  );

  useApiErrorNotification(error, {
    toastId: `transit-transfer-detail-${transferId}-error`,
    fallbackMessage: "Unable to load the transit transfer.",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transit Transfer Details"
      description="Review this connection in its valid travel direction."
      maxWidth="max-w-2xl"
    >
      {isLoading ? (
        <div className="h-72 animate-pulse rounded-xl bg-skeleton" />
      ) : error ? (
        <DataErrorState
          title="Unable to load transfer"
          message="The transfer details could not be loaded."
          onRetry={refetch}
        />
      ) : (
        <div>
          {/* Transfer status */}
          <div className="mb-5 flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              Transfer #{transfer?.id}
            </span>
            <StatusBadge variant={STATUS_VARIANTS[transfer?.status] ?? "neutral"}>
              {transfer?.status?.[0]?.toUpperCase() + transfer?.status?.slice(1)}
            </StatusBadge>
          </div>

          {/* Directed connection */}
          <div className="space-y-2 rounded-xl border border-stroke bg-surface p-5">
            <ConnectionStep
              label="Source route variant"
              value={formatVariantLabel(transfer?.source_variant)}
            />
            <ArrowDown className="ml-3 h-5 w-5 text-text-secondary" aria-hidden="true" />
            <ConnectionStep
              label="Alight at"
              value={transfer?.alighting_transit_point?.name}
            />
            <ArrowDown className="ml-3 h-5 w-5 text-text-secondary" aria-hidden="true" />
            <ConnectionStep
              label="Board at"
              value={transfer?.boarding_transit_point?.name}
            />
            <ArrowDown className="ml-3 h-5 w-5 text-text-secondary" aria-hidden="true" />
            <ConnectionStep
              label="Destination route variant"
              value={formatVariantLabel(transfer?.destination_variant)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Renders one labeled stop in the directed transfer detail sequence.
 */
function ConnectionStep({ label, value }) {
  return (
    <div className="rounded-lg border border-stroke bg-background px-4 py-3">
      {/* Connection step */}
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

/**
 * Confirms a pending transfer review decision before applying it.
 */
export function TransitTransferReviewModal({ transfer, action, onClose }) {
  const { confirmTransfer, ignoreTransfer, isConfirmingTransfer, isIgnoringTransfer } =
    useTransitMutations();
  const isConfirming = action === "confirm";
  const isSubmitting = isConfirming
    ? isConfirmingTransfer
    : isIgnoringTransfer;

  async function handleReview() {
    try {
      if (isConfirming) {
        await confirmTransfer(transfer.id);
      } else {
        await ignoreTransfer(transfer.id);
      }

      toast.success(
        isConfirming
          ? "Transit transfer confirmed successfully."
          : "Transit transfer ignored successfully.",
      );
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `The transit transfer could not be ${isConfirming ? "confirmed" : "ignored"}.`,
      );
    }
  }

  return (
    <Modal
      isOpen={Boolean(transfer && action)}
      onClose={onClose}
      title={isConfirming ? "Confirm Transit Transfer?" : "Ignore Transit Transfer?"}
      description={
        isConfirming
          ? "Confirmed transfers can participate in future routing behavior."
          : "Ignored transfers remain recorded but will not participate in routing."
      }
    >
      {/* Review summary */}
      <p className="rounded-lg bg-surface p-4 text-sm text-text-secondary">
        {formatVariantLabel(transfer?.source_variant)} to {" "}
        {formatVariantLabel(transfer?.destination_variant)}
      </p>

      {/* Review actions */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant={isConfirming ? "success" : "danger"}
          icon={isConfirming ? Check : X}
          loading={isSubmitting}
          onClick={handleReview}
        >
          {isConfirming ? "Confirm Transfer" : "Ignore Transfer"}
        </Button>
      </div>
    </Modal>
  );
}
