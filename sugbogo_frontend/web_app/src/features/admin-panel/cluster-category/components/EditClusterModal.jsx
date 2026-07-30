import { useEffect, useState } from "react";
import Modal from "@/shared/components/modals/Modal";
import ClusterForm from "./ClusterForm";
import useUpdateCluster from "../hooks/useUpdateCluster";

/**
 * Modal for editing an existing cluster.
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
  const [values, setValues] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState({});

  const { submit, isSubmitting } = useUpdateCluster();

  useEffect(() => {
    if (cluster) {
      setValues({
        name: cluster.name,
        description: cluster.description ?? "",
      });
    }
  }, [cluster]);

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
      />
    </Modal>
  );
}
