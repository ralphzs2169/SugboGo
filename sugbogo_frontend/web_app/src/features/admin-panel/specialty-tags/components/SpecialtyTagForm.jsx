import TextInput from "@/shared/components/forms/TextInput";
import Button from "@/shared/components/Button";

/**
 * Reusable form for creating and editing specialty tags.
 *
 * @param {Object} props
 * @param {Object} props.values - Current form values.
 * @param {Object} props.errors - Validation errors keyed by field.
 * @param {Function} props.onChange - Input change handler.
 * @param {Function} props.onSubmit - Form submit handler.
 * @param {boolean} props.isSubmitting - Whether the form is submitting.
 * @param {string} props.submitLabel - Label displayed on the submit button.
 *
 * @returns {JSX.Element}
 */
export default function SpecialtyTagForm({
  values,
  errors,
  onChange,
  onSubmit,
  isSubmitting,
  submitLabel = "Save Specialty Tag",
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextInput
        id="name"
        name="name"
        label="Specialty Tag"
        placeholder="Enter specialty tag"
        value={values.name}
        onChange={onChange}
        error={errors.name}
        required
      />

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
