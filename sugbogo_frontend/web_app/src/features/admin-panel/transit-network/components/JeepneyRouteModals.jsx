import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Route } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import TextInput from "@/shared/components/forms/TextInput";
import Modal from "@/shared/components/modals/Modal";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import useTransitMutations from "../hooks/useTransitMutations";
import { useJeepneyRoute } from "../hooks/useTransitQueries";
import { getApiFieldErrors } from "../utils/transitFormatters";

/**
 * Provides the controlled create/edit dialog for a basic jeepney route code.
 */
export function JeepneyRouteFormModal({ isOpen, route, onClose }) {
  const [code, setCode] = useState(route?.code ?? "");
  const [errors, setErrors] = useState({});
  const { createRoute, updateRoute, isCreatingRoute, isUpdatingRoute } =
    useTransitMutations();
  const isEditing = Boolean(route);
  const isSubmitting = isCreatingRoute || isUpdatingRoute;

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setErrors({ code: "Jeepney route code is required." });
      return;
    }

    try {
      if (isEditing) {
        await updateRoute({ routeId: route.id, data: { code: normalizedCode } });
      } else {
        await createRoute({ code: normalizedCode });
      }

      toast.success(
        isEditing
          ? "Jeepney route updated successfully."
          : "Jeepney route created successfully.",
      );
      onClose();
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The jeepney route could not be ${isEditing ? "updated" : "created"}.`,
      );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Jeepney Route" : "Add Jeepney Route"}
      description="Manage the public code used to identify this jeepney route."
    >
      {/* Route form */}
      <form className="space-y-6" onSubmit={handleSubmit}>
        <TextInput
          id="route-code"
          name="code"
          label="Route Code"
          placeholder="e.g. 14D"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setErrors({});
          }}
          error={errors.code}
          required
        />

        {/* Form actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? "Save Changes" : "Add Route"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Displays route detail and its existing directional variants without map editing.
 */
export function JeepneyRouteDetailModal({ routeId, onClose }) {
  const isOpen = Boolean(routeId);
  const { route, isLoading, error, refetch } = useJeepneyRoute(routeId, {
    enabled: isOpen,
  });

  useApiErrorNotification(error, {
    toastId: `transit-route-detail-${routeId}-error`,
    fallbackMessage: "Unable to load the jeepney route.",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={route ? `Route ${route.code}` : "Route Details"}
      description="Review the directional paths currently attached to this route."
      maxWidth="max-w-2xl"
      scrollable
    >
      {isLoading ? (
        <div className="space-y-3" aria-label="Loading route details">
          <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
          <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
        </div>
      ) : error ? (
        <DataErrorState
          title="Unable to load route"
          message="The route details could not be loaded."
          onRetry={refetch}
        />
      ) : (
        <div className="space-y-5">
          {/* Route summary */}
          <div className="flex items-center gap-3 rounded-xl border border-stroke bg-surface p-4">
            <Route className="h-6 w-6 text-primary" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold text-text-primary">{route?.code}</p>
              <p className="text-sm text-text-secondary">
                {route?.variant_count ?? 0} directional variants
              </p>
            </div>
          </div>

          {/* Directional variants */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Directional Variants
            </h3>
            {route?.variants?.length ? (
              <div className="space-y-3">
                {route.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex flex-col gap-3 rounded-xl border border-stroke p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary">
                      <span>{variant.origin.name}</span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-text-secondary"
                        aria-hidden="true"
                      />
                      <span>{variant.destination.name}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled
                      disabledTooltip="Route path editing will be available in the map editor."
                    >
                      Edit Route Path
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stroke-strong px-5 py-8 text-center text-sm text-text-secondary">
                No directional variants have been added yet.
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
