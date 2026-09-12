import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/shared/components/modals/Modal";
import { hasFormChanges } from "@/shared/utils/formUtils";

import DiscoveryShortcutForm from "./DiscoveryShortcutForm";
import useClusters from "../hooks/useClusters";
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
  const { submit, isSubmitting } = useUpdateDiscoveryShortcut();
  const { clusters, isLoading: isLoadingClusters } = useClusters(
    { page_size: 100 },
    { enabled: isOpen },
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
    const validationErrors = validateDiscoveryShortcut(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await submit(shortcut.id, values);
      await onSuccess?.();
      onClose();
    } catch (error) {
      setErrors(error.response?.data?.errors ?? {});
      toast.error(
        error.response?.data?.message ||
          "The Discovery Shortcut could not be updated. Please try again.",
      );
    }
  }

  if (!shortcut) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Edit Discovery Shortcut"
      description="Update the shortcut content or availability."
      onClose={onClose}
    >
      <DiscoveryShortcutForm
        values={values}
        errors={errors}
        clusters={clusters}
        isLoadingClusters={isLoadingClusters}
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
