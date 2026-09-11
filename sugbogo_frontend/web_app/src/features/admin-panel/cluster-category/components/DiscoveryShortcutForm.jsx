import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import TextInput from "@/shared/components/forms/TextInput";

import ClusterSelectInput from "./ClusterSelectInput";

export default function DiscoveryShortcutForm({
  values,
  errors,
  clusters,
  isLoadingClusters,
  onChange,
  onSubmit,
  onClearError,
  isSubmitting,
  submitLabel,
  submitDisabled = false,
}) {
  function handleChange(event) {
    onChange(event);
    onClearError?.(event.target.name);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <ClusterSelectInput
        id="cluster_id"
        name="cluster_id"
        label="Cluster"
        value={values.cluster_id}
        onChange={handleChange}
        error={errors.cluster_id}
        clusters={clusters}
        disabled={isLoadingClusters}
        required
      />

      <TextInput
        id="title"
        name="title"
        label="Title"
        value={values.title}
        onChange={handleChange}
        error={errors.title}
        required
      />

      <TextArea
        id="subtitle"
        name="subtitle"
        label="Subtitle"
        value={values.subtitle}
        onChange={handleChange}
        error={errors.subtitle}
        required
      />

      <label className="flex cursor-pointer items-center gap-3 text-sm text-text-primary">
        <input
          type="checkbox"
          name="is_active"
          checked={values.is_active}
          onChange={(event) =>
            handleChange({
              target: {
                name: "is_active",
                value: event.target.checked,
              },
            })
          }
          className="h-4 w-4 accent-brand"
        />
        Active
      </label>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={submitDisabled}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
