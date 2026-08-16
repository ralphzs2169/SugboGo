import TextInput from "@/shared/components/forms/TextInput";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";

import ClusterIconPicker from "./ClusterIconPicker";

/**
 * Reusable form for creating and editing clusters.
 */
export default function ClusterForm({
  values,
  errors,
  onChange,
  onSubmit,
  isSubmitting,
  onClearError,
  submitLabel = "Save Cluster",
  submitDisabled = false,
}) {
  function handleChange(event) {
    onChange(event);
    onClearError?.(event.target.name);
  }

  function handleIconChange(icon) {
    onChange({
      target: {
        name: "icon",
        value: icon,
      },
    });

    onClearError?.("icon");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Cluster identity */}
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        <TextInput
          id="name"
          name="name"
          label="Cluster Name"
          placeholder="Enter cluster name"
          value={values.name}
          onChange={handleChange}
          error={errors.name}
          required
          minLength={3}
          showCharacterCount
        />

        <ClusterIconPicker
          value={values.icon}
          onChange={handleIconChange}
          error={errors.icon}
          required
        />
      </div>

      {/* Cluster description */}
      <TextArea
        id="description"
        name="description"
        label="Description"
        placeholder="Enter cluster description"
        value={values.description}
        onChange={handleChange}
        error={errors.description}
        rows={4}
      />

      {/* Form actions */}
      <div className="flex justify-end">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={submitDisabled}
          disabledTooltip="Make a change before saving."
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
