import TextInput from "@/shared/components/forms/TextInput";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";

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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextInput
        id="name"
        name="name"
        label="Cluster Name"
        placeholder="Enter cluster name"
        value={values.name}
        onChange={handleChange}
        error={errors.name}
        required
      />

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
