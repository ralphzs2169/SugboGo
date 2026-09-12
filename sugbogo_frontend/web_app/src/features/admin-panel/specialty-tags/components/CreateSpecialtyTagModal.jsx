import { useState } from "react";
import { toast } from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";

import useCreateSpecialtyTag from "../hooks/useCreateSpecialtyTag";
import { validateSpecialtyTag } from "../validation/specialtyTagValidation";
import SpecialtyTagForm from "./SpecialtyTagForm";

/**
 * Displays the create specialty tag modal and manages its form state.
 *
 * Initializes new tags with the default color and icon, validates form input,
 * submits the tag, and resets the form after a successful creation.
 */
export default function CreateSpecialtyTagModal({
  isOpen,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({
    name: "",
    color: "blue",
    icon: "tag",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useCreateSpecialtyTag();

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
      await submit(values);

      onSuccess?.();
      onClose();

      setValues({
        name: "",
        color: "blue",
        icon: "tag",
      });

      setErrors({});
    } catch (error) {
      setErrors(error.response?.data?.errors ?? {});

      toast.error(
        error.response?.data?.message ||
          "The specialty tag could not be created. Please try again.",
      );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Create Specialty Tag"
      description="Add a new specialty tag for businesses."
      onClose={onClose}
    >
      {/* Specialty tag creation form */}
      <SpecialtyTagForm
        values={values}
        errors={errors}
        onChange={handleChange}
        onColorChange={handleColorChange}
        onClearError={onClearError}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Create Specialty Tag"
      />
    </Modal>
  );
}
