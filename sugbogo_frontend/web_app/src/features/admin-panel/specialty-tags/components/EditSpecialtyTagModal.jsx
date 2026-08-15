import { useEffect, useState } from "react";

import Modal from "@/shared/components/modals/Modal";
import { hasFormChanges } from "@/shared/utils/formUtils";
import toast from "react-hot-toast";
import { validateSpecialtyTag } from "../validation/specialtyTagValidation";
import useUpdateSpecialtyTag from "../hooks/useUpdateSpecialtyTag";

import SpecialtyTagForm from "./SpecialtyTagForm";

export default function EditSpecialtyTagModal({
  isOpen,
  specialtyTag,
  onClose,
  onSuccess,
}) {
  // Keep the original values so the form can detect whether
  // the user actually changed anything before enabling Save.
  const [initialValues, setInitialValues] = useState({
    name: "",
    color: "blue",
  });

  const [values, setValues] = useState({
    name: "",
    color: "blue",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useUpdateSpecialtyTag();

  useEffect(() => {
    if (!specialtyTag) return;

    const nextValues = {
      name: specialtyTag.name ?? "",
      color: specialtyTag.color ?? "blue",
    };

    setValues(nextValues);
    setInitialValues(nextValues);
    setErrors({});
  }, [specialtyTag]);

  // Prevents submitting when the form still matches
  // the values loaded from the selected specialty tag.
  const hasChanges = hasFormChanges(values, initialValues, ["name", "color"]);

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
