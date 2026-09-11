import TextInput from "@/shared/components/forms/TextInput";
import Button from "@/shared/components/Button";

import ColorPicker from "./ColorPicker";
import SpecialtyTagIconPicker from "./SpecialtyTagIconPicker";

/**
 * Reusable form for creating and editing specialty tags.
 *
 * Provides specialty tag identity, icon, color, and submission controls.
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
      {/* Specialty tag identity */}
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        <TextInput
          id="name"
          name="name"
          label="Specialty Tag"
          placeholder="Enter specialty tag"
          value={values.name}
          onChange={handleChange}
          error={errors.name}
          required
          minLength={3}
          showCharacterCount
        />

        <SpecialtyTagIconPicker
          value={values.icon}
          onChange={handleIconChange}
          error={errors.icon}
          required
        />
      </div>

      {/* Specialty tag appearance */}
      <ColorPicker
        value={values.color}
        name={values.name}
        icon={values.icon}
        error={errors.color}
        onChange={handleColorChange}
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
