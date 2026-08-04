import { useState } from "react";

import Modal from "@/shared/components/modals/Modal";

import SpecialtyTagForm from "./SpecialtyTagForm";
import useCreateSpecialtyTag from "../hooks/useCreateSpecialtyTag";

/**
 * Modal for creating a new specialty tag.
 *
 * Manages the form state, submission, validation errors,
 * and successful creation flow.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Closes the modal.
 * @param {Function} props.onSuccess - Called after successful creation.
 *
 * @returns {JSX.Element}
 */
export default function CreateSpecialtyTagModal({
  isOpen,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({
    name: "",
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

  function handleSubmit(event) {
    event.preventDefault();

    submit(values).then((result) => {
      if (!result.success) {
        setErrors(result.errors);
        return;
      }

      onSuccess?.();
      onClose();

      setValues({
        name: "",
      });

      setErrors({});
    });
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
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Create Specialty Tag"
      />
    </Modal>
  );
}
