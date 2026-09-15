import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import TextInput from "@/shared/components/forms/TextInput";

import useTransitMutations from "../../hooks/useTransitMutations";
import { getApiFieldErrors } from "../../utils/transitFormatters";

/**
 * Creates or renames a Jeepney Route inside the shared workspace inspector.
 */
export default function RouteForm({
  route,
  onDirtyChange,
  onCancel,
  onSaved,
}) {
  const [code, setCode] = useState(route?.code ?? "");
  const [errors, setErrors] = useState({});
  const { createRoute, updateRoute, isCreatingRoute, isUpdatingRoute } =
    useTransitMutations();
  const isEditing = Boolean(route);
  const isSubmitting = isCreatingRoute || isUpdatingRoute;
  const isDirty = code !== (route?.code ?? "");

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setErrors({ code: "Jeepney route code is required." });
      return;
    }

    try {
      const savedRoute = isEditing
        ? await updateRoute({ routeId: route.id, data: { code: normalizedCode } })
        : await createRoute({ code: normalizedCode });

      toast.success(
        isEditing
          ? "Jeepney route updated successfully."
          : "Jeepney route created successfully.",
      );
      onDirtyChange(false);
      onSaved(savedRoute);
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The jeepney route could not be ${isEditing ? "updated" : "created"}.`,
      );
    }
  }

  return (
    <form className="rounded-xl border border-stroke bg-background p-4" onSubmit={handleSubmit}>
      {/* Route editor heading */}
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {isEditing ? "Edit route" : "Create route"}
      </p>
      <h2 className="mt-1 font-semibold text-text-primary">
        {isEditing ? `Route ${route.code}` : "New Jeepney Route"}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
        Route codes identify a service; directional paths are managed separately.
      </p>

      {/* Route code */}
      <div className="mt-5">
        <TextInput
          id="workspace-route-code"
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
      </div>

      {/* Form actions */}
      <div className="mt-5 flex justify-end gap-2 border-t border-stroke pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isEditing ? "Save Changes" : "Create Route"}
        </Button>
      </div>
    </form>
  );
}
