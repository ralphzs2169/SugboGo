import { useState } from "react";

import Modal from "@/shared/components/modals/Modal";

import { validateSpecialtyTag } from "../validation/specialtyTagValidation";
import useCreateSpecialtyTag from "../hooks/useCreateSpecialtyTag";
import { toast } from "react-hot-toast";
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

    try {
      await submit(values);

      onSuccess?.();
      onClose();

      setValues({
        name: "",
        color: "blue",
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
