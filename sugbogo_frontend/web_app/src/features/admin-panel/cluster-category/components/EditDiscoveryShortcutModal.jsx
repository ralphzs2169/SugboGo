import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";
import { hasFormChanges } from "@/shared/utils/formUtils";

import DiscoveryShortcutForm from "./DiscoveryShortcutForm";
import { useQuery } from "@tanstack/react-query";
import { taxonomyReferenceOptions } from "../../taxonomy/queries/taxonomyQueries";
import useUpdateDiscoveryShortcut from "../hooks/useUpdateDiscoveryShortcut";
import { validateDiscoveryShortcut } from "../validation/discoveryShortcutValidation";

const EDITABLE_FIELDS = [
  "cluster_id",
  "title",
  "subtitle",
  "is_active",
];

export default function EditDiscoveryShortcutModal({
  isOpen,
  shortcut,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({});
  const [initialValues, setInitialValues] = useState({});
  const [errors, setErrors] = useState({});
  const { submit } = useUpdateDiscoveryShortcut();
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    isOpen,
    shortcut?.id,
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
    if (!shortcut) {
      return;
    }

    const nextValues = {
      cluster_id: shortcut.cluster.id,
      title: shortcut.title,
      subtitle: shortcut.subtitle,
      is_active: shortcut.is_active,
    };

    // Form state mirrors the newly selected table row when the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(nextValues);
    setInitialValues(nextValues);
    setErrors({});
  }, [shortcut]);

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
        await submit(shortcut.id, values);
        await onSuccess?.();
        if (!isCurrent()) {
          return;
        }
        onClose();
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setErrors(error.response?.data?.errors ?? {});
        toast.error(
          error.response?.data?.message ||
            "The Discovery Shortcut could not be updated. Please try again.",
        );
      }
    });
  }

  if (!shortcut) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      dismissDisabled={isSubmitting}
      title="Edit Discovery Shortcut"
      description="Update the shortcut content or availability."
      onClose={close}
    >
      <DiscoveryShortcutForm
        values={values}
        errors={errors}
        clusters={clusters}
        isLoadingClusters={isLoadingClusters}
        clusterOptionsQuery={clusterOptionsQuery}
        onChange={(event) =>
          setValues((previous) => ({
            ...previous,
            [event.target.name]: event.target.value,
          }))
        }
        onSubmit={handleSubmit}
        onClearError={(field) =>
          setErrors((previous) => ({ ...previous, [field]: undefined }))
        }
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
        submitDisabled={
          referenceUnavailable ||
          !hasFormChanges(
            values,
            initialValues,
            EDITABLE_FIELDS,
          )
        }
      />
    </Modal>
  );
}
