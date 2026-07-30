import { useState } from "react";
import Modal from "@/shared/components/modals/Modal";
import ClusterForm from "./ClusterForm";
import useCreateCluster from "../hooks/useCreateCluster";

/**
 * Modal for creating a new cluster.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 *
 * @returns {JSX.Element}
 */
export default function CreateClusterModal({ isOpen, onClose, onSuccess }) {
  const [values, setValues] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState({});
  const { submit, isSubmitting } = useCreateCluster();

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
    });

    setErrors({});
  }
  return (
    <Modal
      isOpen={isOpen}
      title="Create Cluster"
      description="Add a new business cluster."
      onClose={onClose}
    >
      <ClusterForm
        values={values}
        errors={errors}
        onChange={handleChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Create Cluster"
        onClearError={onClearError}
      />
    </Modal>
  );
}
