import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";
import { hasFormChanges } from "@/shared/utils/formUtils";

import useUpdateSpecialtyTag from "../hooks/useUpdateSpecialtyTag";
import { validateSpecialtyTag } from "../validation/specialtyTagValidation";
import SpecialtyTagForm from "./SpecialtyTagForm";

/**
 * Displays the specialty tag edit modal and manages its editable form state.
 *
 * Loads the selected tag's current name, color, and icon, tracks changes,
 * validates updates, and submits only when the form has been modified.
 */
export default function EditSpecialtyTagModal({
  isOpen,
  specialtyTag,
  onClose,
  onSuccess,
}) {
  const [initialValues, setInitialValues] = useState({
    name: "",
    color: "blue",
    icon: "tag",
  });

  const [values, setValues] = useState({
    name: "",
    color: "blue",
    icon: "tag",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useUpdateSpecialtyTag();

  useEffect(() => {
    if (!specialtyTag) return;

    const nextValues = {
      name: specialtyTag.name ?? "",
      color: specialtyTag.color ?? "blue",
      icon: specialtyTag.icon ?? "tag",
    };

    setValues(nextValues);
    setInitialValues(nextValues);
    setErrors({});
  }, [specialtyTag]);

  const hasChanges = hasFormChanges(values, initialValues, [
    "name",
    "color",
    "icon",
  ]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleColorChange(color) {
    setValues((previous) => ({
      ...previous,
      color,
    }));
  }

  function onClearError(field) {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateSpecialtyTag(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await submit(specialtyTag.id, values);

      onSuccess?.();
      onClose();

      setErrors({});
    } catch (error) {
      setErrors(error.response?.data?.errors ?? {});

      toast.error(
        error.response?.data?.message ||
          "The specialty tag could not be updated. Please try again.",
      );
    }
  }

  if (!specialtyTag) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Specialty Tag"
      description="Update specialty tag information."
      onClose={onClose}
    >
      {/* Specialty tag edit form */}
      <SpecialtyTagForm
        values={values}
        errors={errors}
        onChange={handleChange}
        onColorChange={handleColorChange}
        onClearError={onClearError}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
        submitDisabled={!hasChanges}
      />
    </Modal>
  );
}
