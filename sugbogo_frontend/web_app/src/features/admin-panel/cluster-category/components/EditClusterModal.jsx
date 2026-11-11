import { useEffect, useState } from "react";

import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";
import { hasFormChanges } from "@/shared/utils/formUtils";

import ClusterForm from "./ClusterForm";
import useUpdateCluster from "../hooks/useUpdateCluster";
import { validateCluster } from "../validation/clusterValidation";
import { toast } from "react-hot-toast";

/**
 * Modal for editing an existing cluster.
 *
 * Tracks the original cluster values so the save button
 * can be disabled when no changes have been made.
 */
export default function EditClusterModal({
  isOpen,
  onClose,
  onSuccess,
  cluster,
}) {
  const [initialValues, setInitialValues] = useState({
    name: "",
    icon: "utensils",
    description: "",
  });

  const [values, setValues] = useState({
    name: "",
    icon: "utensils",
    description: "",
  });

  const [errors, setErrors] = useState({});

  const { submit } = useUpdateCluster();
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    isOpen,
    cluster?.id,
    onClose,
  );

  useEffect(() => {
    if (!cluster) return;

    const nextValues = {
      name: cluster.name ?? "",
      icon: cluster.icon ?? "utensils",
      description: cluster.description ?? "",
    };

    setValues(nextValues);
    setInitialValues(nextValues);
    setErrors({});
  }, [cluster]);

  // Determines whether the user changed any editable cluster fields.
  const hasChanges = hasFormChanges(values, initialValues, [
    "name",
    "icon",
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

    return runSubmission(async (isCurrent) => {
      try {
        await submit(cluster.id, values);

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

        if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        }
      }
    });
  }

  if (!cluster) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      dismissDisabled={isSubmitting}
      title="Edit Cluster"
      description="Update cluster information."
      onClose={close}
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
