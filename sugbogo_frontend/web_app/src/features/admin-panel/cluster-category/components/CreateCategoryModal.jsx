import { useState } from "react";
import Modal from "@/shared/components/modals/Modal";
import CategoryForm from "./CategoryForm";
import useCreateCategory from "../hooks/useCreateCategory";
import useClusters from "../hooks/useClusters";
import { validateCategory } from "../validation/categoryValidation";

/**
 * Modal for creating a new category.
 *
 */
export default function CreateCategoryModal({ isOpen, onClose, onSuccess }) {
  const [values, setValues] = useState({
    name: "",
    description: "",
    cluster_id: "",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useCreateCategory();

  const { clusters, isLoading: isLoadingClusters } = useClusters();

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: value,
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

    const validationErrors = validateCategory(values);

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

    setValues({
      name: "",
      description: "",
      cluster_id: "",
    });

    setErrors({});
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Create Category"
      description="Add a new category and assign it to a cluster."
      onClose={onClose}
    >
      <CategoryForm
        values={values}
        errors={errors}
        clusters={clusters}
        isLoadingClusters={isLoadingClusters}
        onChange={handleChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Create Category"
        onClearError={onClearError}
      />
    </Modal>
  );
}
