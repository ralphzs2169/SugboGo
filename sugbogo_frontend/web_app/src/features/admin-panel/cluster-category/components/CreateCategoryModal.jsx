import { useState } from "react";
import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";
import CategoryForm from "./CategoryForm";
import useCreateCategory from "../hooks/useCreateCategory";
import { useQuery } from "@tanstack/react-query";
import { taxonomyReferenceOptions } from "../../taxonomy/queries/taxonomyQueries";
import { validateCategory } from "../validation/categoryValidation";
import { toast } from "react-hot-toast";

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

  const { submit } = useCreateCategory();
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    isOpen,
    undefined,
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
        await submit(values);

        await onSuccess?.();
        if (!isCurrent()) {
          return;
        }

        onClose();

        setValues({
          name: "",
          description: "",
          cluster_id: "",
        });

        setErrors({});
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setErrors(error.response?.data?.errors ?? {});

        if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        }
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      dismissDisabled={isSubmitting}
      title="Create Category"
      description="Add a new category and assign it to a cluster."
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
        submitDisabled={referenceUnavailable}
        submitLabel="Create Category"
        onClearError={onClearError}
      />
    </Modal>
  );
}
