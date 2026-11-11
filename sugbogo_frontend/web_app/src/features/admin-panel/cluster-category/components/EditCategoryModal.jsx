import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";
import { hasFormChanges } from "@/shared/utils/formUtils";

import CategoryForm from "./CategoryForm";
import useUpdateCategory from "../hooks/useUpdateCategory";
import { useQuery } from "@tanstack/react-query";
import { taxonomyReferenceOptions } from "../../taxonomy/queries/taxonomyQueries";
import { validateCategory } from "../validation/categoryValidation";

/**
 * Modal for editing an existing category.
 *
 * Tracks the original category values so the save button
 * can be disabled when no changes have been made.
 */
export default function EditCategoryModal({
  isOpen,
  category,
  onClose,
  onSuccess,
}) {
  const [initialValues, setInitialValues] = useState({
    name: "",
    description: "",
    cluster_id: "",
  });

  const [values, setValues] = useState({
    name: "",
    description: "",
    cluster_id: "",
  });

  const [errors, setErrors] = useState({});

  const { submit } = useUpdateCategory();
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    isOpen,
    category?.id,
    onClose,
  );

  const clusterOptionsQuery = useQuery({
    ...taxonomyReferenceOptions("clusters"),
    enabled: isOpen,
  });
  const clusters = clusterOptionsQuery.data ?? [];
  const isLoadingClusters = clusterOptionsQuery.isPending;
  const referenceUnavailable = (
    isLoadingClusters ||
    Boolean(clusterOptionsQuery.error)
  );

  useEffect(() => {
    if (!category) return;

    const nextValues = {
      name: category.name ?? "",
      description: category.description ?? "",
      cluster_id: category.cluster_id ?? "",
    };

    setValues(nextValues);
    setInitialValues(nextValues);
    setErrors({});
  }, [category]);

  // Determines whether the user has changed any editable category fields.
  const hasChanges = hasFormChanges(values, initialValues, [
    "name",
    "description",
    "cluster_id",
  ]);

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
    if (referenceUnavailable) {
      return;
    }

    const validationErrors = validateCategory(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    return runSubmission(async (isCurrent) => {
      try {
        await submit(category.id, values);

        await onSuccess?.();
        if (!isCurrent()) {
          return;
        }
        onClose();
        setErrors({});
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setErrors(error.response?.data?.errors ?? {});

        toast.error(
          error.response?.data?.message ||
            "The category could not be updated. Please try again.",
        );
      }
    });
  }

  if (!category) return null;

  return (
    <Modal
      isOpen={isOpen}
      dismissDisabled={isSubmitting}
      title="Edit Category"
      description="Update category information and cluster assignment."
      onClose={close}
    >
      <CategoryForm
        values={values}
        errors={errors}
        clusters={clusters}
        isLoadingClusters={isLoadingClusters}
        clusterOptionsQuery={clusterOptionsQuery}
        onChange={handleChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
        onClearError={onClearError}
        submitDisabled={!hasChanges || referenceUnavailable}
      />
    </Modal>
  );
}
