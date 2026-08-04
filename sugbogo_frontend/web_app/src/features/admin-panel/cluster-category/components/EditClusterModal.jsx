import { useEffect, useState } from "react";

import Modal from "@/shared/components/modals/Modal";
import { hasFormChanges } from "@/shared/utils/formUtils";

import ClusterForm from "./ClusterForm";
import useUpdateCluster from "../hooks/useUpdateCluster";
import { validateCluster } from "../validation/clusterValidation";

/**
 * Modal for editing an existing cluster.
 *
 * Tracks the original cluster values so the save button
 * can be disabled when no changes have been made.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 * @param {Object|null} props.cluster
 *
 * @returns {JSX.Element}
 */
export default function EditClusterModal({
  isOpen,
  onClose,
  onSuccess,
  cluster,
}) {
  const [initialValues, setInitialValues] = useState({
    name: "",
    description: "",
  });

  const [values, setValues] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useUpdateCluster();

  useEffect(() => {
    if (!cluster) return;

    const nextValues = {
      name: cluster.name ?? "",
      description: cluster.description ?? "",
    };

    setValues(nextValues);
    setInitialValues(nextValues);
    setErrors({});
  }, [cluster]);

  // Determines whether the user changed any editable cluster fields.
  const hasChanges = hasFormChanges(values, initialValues, [
    "name",
    "description",
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

    const validationErrors = validateCluster(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const result = await submit(cluster.id, values);

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    onSuccess?.();

    onClose();

    setErrors({});
  }

  if (!cluster) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Cluster"
      description="Update cluster information."
      onClose={onClose}
    >
      <ClusterForm
        values={values}
        errors={errors}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClearError={onClearError}
        isSubmitting={isSubmitting}
        submitLabel="Update Cluster"
        submitDisabled={!hasChanges}
      />
    </Modal>
  );
}
