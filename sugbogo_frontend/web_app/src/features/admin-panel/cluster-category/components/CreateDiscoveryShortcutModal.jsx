import { useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";

import DiscoveryShortcutForm from "./DiscoveryShortcutForm";
import { useQuery } from "@tanstack/react-query";
import { taxonomyReferenceOptions } from "../../taxonomy/queries/taxonomyQueries";
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
  const { submit } = useCreateDiscoveryShortcut();
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    isOpen,
    undefined,
    () => {
      setValues(INITIAL_VALUES);
      setErrors({});
      onClose();
    },
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
    if (referenceUnavailable) {
      return;
    }
    const validationErrors = validateDiscoveryShortcut(values);

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
        setValues(INITIAL_VALUES);
        setErrors({});
        onClose();
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setErrors(error.response?.data?.errors ?? {});
        toast.error(
          error.response?.data?.message ||
            "The Discovery Shortcut could not be created. Please try again.",
        );
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      dismissDisabled={isSubmitting}
      title="Create Discovery Shortcut"
      description="Link a Discovery Shortcut to an existing cluster."
      onClose={close}
    >
      <DiscoveryShortcutForm
        values={values}
        errors={errors}
        clusters={availableClusters}
        isLoadingClusters={isLoadingClusters}
        clusterOptionsQuery={clusterOptionsQuery}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClearError={(field) =>
          setErrors((previous) => ({ ...previous, [field]: undefined }))
        }
        isSubmitting={isSubmitting}
        submitDisabled={referenceUnavailable}
        submitLabel="Create Discovery Shortcut"
      />
    </Modal>
  );
}
