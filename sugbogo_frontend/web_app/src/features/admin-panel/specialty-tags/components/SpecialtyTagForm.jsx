import TextInput from "@/shared/components/forms/TextInput";
import Button from "@/shared/components/Button";

import ColorPicker from "./ColorPicker";

/**
 * Reusable form for creating and editing specialty tags.
 *
 * Provides specialty tag name input and color selection.
 */
export default function SpecialtyTagForm({
  values,
  errors,
  onChange,
  onColorChange,
  onSubmit,
  onClearError,
  isSubmitting,
  submitLabel = "Save Specialty Tag",
  submitDisabled = false,
}) {
  function handleChange(event) {
    onChange(event);
    onClearError?.(event.target.name);
  }

  function handleColorChange(color) {
    onColorChange(color);
    onClearError?.("color");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextInput
        id="name"
        name="name"
        label="Specialty Tag"
        placeholder="Enter specialty tag"
        value={values.name}
        onChange={handleChange}
        error={errors.name}
        required
      />

      <ColorPicker
        value={values.color}
        name={values.name}
        error={errors.color}
        onChange={handleColorChange}
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
