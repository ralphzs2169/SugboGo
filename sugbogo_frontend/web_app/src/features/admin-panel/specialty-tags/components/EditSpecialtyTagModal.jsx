import { useEffect, useState } from "react";

import Modal from "@/shared/components/modals/Modal";

import SpecialtyTagForm from "./SpecialtyTagForm";
import useUpdateSpecialtyTag from "../hooks/useUpdateSpecialtyTag";

/**
 * Modal for editing an existing specialty tag.
 *
 * Initializes the form from the selected specialty tag
 * and manages submission and validation errors.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Object|null} props.specialtyTag - Specialty tag being edited.
 * @param {Function} props.onClose - Closes the modal.
 * @param {Function} props.onSuccess - Called after successful update.
 *
 * @returns {JSX.Element|null}
 */
export default function EditSpecialtyTagModal({
  isOpen,
  specialtyTag,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({
    name: "",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useUpdateSpecialtyTag();

  useEffect(() => {
    if (!specialtyTag) return;

    setValues({
      name: specialtyTag.name ?? "",
    });

    setErrors({});
  }, [specialtyTag]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const result = await submit(specialtyTag.id, values);

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    onSuccess?.();

    onClose();

    setErrors({});
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
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
      />
    </Modal>
  );
}
