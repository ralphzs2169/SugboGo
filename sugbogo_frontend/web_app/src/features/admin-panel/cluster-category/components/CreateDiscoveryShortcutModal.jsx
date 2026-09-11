import { useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";

import DiscoveryShortcutForm from "./DiscoveryShortcutForm";
import useClusters from "../hooks/useClusters";
import useCreateDiscoveryShortcut from "../hooks/useCreateDiscoveryShortcut";
import { validateDiscoveryShortcut } from "../validation/discoveryShortcutValidation";

const INITIAL_VALUES = {
  cluster_id: "",
  title: "",
  subtitle: "",
  is_active: true,
};

export default function CreateDiscoveryShortcutModal({
  isOpen,
  shortcuts,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const { submit, isSubmitting } = useCreateDiscoveryShortcut();
  const { clusters, isLoading: isLoadingClusters } = useClusters(
    { page_size: 100 },
    { enabled: isOpen },
  );
  const assignedClusterIds = new Set(
    shortcuts.map((shortcut) => String(shortcut.cluster.id)),
  );
  const availableClusters = clusters.filter(
    (cluster) => !assignedClusterIds.has(String(cluster.id)),
  );

  function handleChange(event) {
    setValues((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateDiscoveryShortcut(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await submit(values);
      await onSuccess?.();
      setValues(INITIAL_VALUES);
      setErrors({});
      onClose();
    } catch (error) {
      setErrors(error.response?.data?.errors ?? {});
      toast.error(
        error.response?.data?.message ||
          "The Discovery Shortcut could not be created. Please try again.",
      );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Create Discovery Shortcut"
      description="Link a Discovery Shortcut to an existing cluster."
      onClose={() => {
        setValues(INITIAL_VALUES);
        setErrors({});
        onClose();
      }}
    >
      <DiscoveryShortcutForm
        values={values}
        errors={errors}
        clusters={availableClusters}
        isLoadingClusters={isLoadingClusters}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClearError={(field) =>
          setErrors((previous) => ({ ...previous, [field]: undefined }))
        }
        isSubmitting={isSubmitting}
        submitLabel="Create Discovery Shortcut"
      />
    </Modal>
  );
}
