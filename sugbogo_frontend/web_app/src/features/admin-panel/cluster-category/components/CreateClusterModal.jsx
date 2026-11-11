import { useState } from "react";
import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";
import ClusterForm from "./ClusterForm";
import useCreateCluster from "../hooks/useCreateCluster";
import { toast } from "react-hot-toast";

/**
 * Modal for creating a new cluster.

 */
export default function CreateClusterModal({ isOpen, onClose, onSuccess }) {
  const [values, setValues] = useState({
    name: "",
    icon: "utensils",
    description: "",
  });

  const [errors, setErrors] = useState({});
  const { submit } = useCreateCluster();
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    isOpen,
    undefined,
    onClose,
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
          icon: "utensils",
          description: "",
        });

        setErrors({});
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setErrors(error.response?.data?.errors ?? {});

        toast.error(
          error.response?.data?.message ||
            "The cluster could not be created. Please try again.",
        );
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      dismissDisabled={isSubmitting}
      title="Create Cluster"
      description="Add a new business cluster."
      onClose={close}
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
