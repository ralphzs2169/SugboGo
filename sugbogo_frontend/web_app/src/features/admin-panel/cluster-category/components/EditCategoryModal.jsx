import { useEffect, useState } from "react";
import Modal from "@/shared/components/modals/Modal";
import CategoryForm from "./CategoryForm";
import useUpdateCategory from "../hooks/useUpdateCategory";
import useClusters from "../hooks/useClusters";

/**
 * Modal for editing an existing category.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object|null} props.category
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 *
 * @returns {JSX.Element}
 */
export default function EditCategoryModal({
  isOpen,
  category,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({
    name: "",
    description: "",
    cluster_id: "",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useUpdateCategory();

  const { clusters, isLoading: isLoadingClusters } = useClusters();

  useEffect(() => {
    if (!category) return;

    setValues({
      name: category.name ?? "",
      description: category.description ?? "",
      cluster_id: category.cluster_id ?? "",
    });

    setErrors({});
  }, [category]);

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

    const result = await submit(category.id, values);

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    onSuccess?.();

    onClose();

    setErrors({});
  }

  if (!category) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Category"
      description="Update category information and cluster assignment."
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
        submitLabel="Save Changes"
        onClearError={onClearError}
      />
    </Modal>
  );
}
