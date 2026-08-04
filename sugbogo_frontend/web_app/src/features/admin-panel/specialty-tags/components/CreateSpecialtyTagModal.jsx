import { useState } from "react";

import Modal from "@/shared/components/modals/Modal";

import { validateSpecialtyTag } from "../validation/specialtyTagValidation";
import useCreateSpecialtyTag from "../hooks/useCreateSpecialtyTag";

import SpecialtyTagForm from "./SpecialtyTagForm";

export default function CreateSpecialtyTagModal({
  isOpen,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({
    name: "",
    color: "blue",
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

    const result = await submit(values);

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    onSuccess?.();
    onClose();

    // Reset the form so the next creation starts with
    // an empty name and the default blue color.
    setValues({
      name: "",
      color: "blue",
    });

    setErrors({});
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Create Specialty Tag"
      description="Add a new specialty tag for businesses."
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
        submitLabel="Create Specialty Tag"
      />
    </Modal>
  );
}
