import TextInput from "@/shared/components/forms/TextInput";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";
/**
 * Reusable form for creating and editing clusters.
 *
 * @param {Object} props
 * @param {Object} props.values - Current form values.
 * @param {Object} props.errors - Validation errors keyed by field.
 * @param {Function} props.onChange - Input change handler.
 * @param {Function} props.onSubmit - Form submit handler.
 * @param {boolean} props.isSubmitting - Whether the form is submitting.
 * @param {Function} props.onClearError - Handler to clear validation errors.
 * @param {string} [props.submitLabel="Save Cluster"] - Label for the submit button.
 *
 * @returns {JSX.Element}
 */
export default function ClusterForm({
  values,
  errors,
  onChange,
  onSubmit,
  isSubmitting,
  onClearError,
  submitLabel = "Save Cluster",
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextInput
        id="name"
        name="name"
        label="Cluster Name"
        placeholder="Enter cluster name"
        value={values.name}
        onChange={onChange}
        onFocus={() => onClearError("name")}
        error={errors.name}
        required
      />

      <TextArea
        id="description"
        name="description"
        label="Description"
        placeholder="Enter cluster description"
        value={values.description}
        onChange={onChange}
        onFocus={() => onClearError("description")}
        error={errors.description}
        rows={4}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
