import { Check, Tag } from "lucide-react";

import {
  TAG_COLORS,
  colorClasses,
  ringClasses,
} from "@/shared/components/SpecialtyTagChip";

import { SPECIALTY_TAG_ICONS } from "../constants/specialtyTagIcons";

/**
 * Displays specialty tag color options with a live tag preview.
 *
 * Reflects the current tag name, color, and selected icon so admins can see
 * how the specialty tag will appear before saving.
 */
export default function SpecialtyTagColorPicker({
  value,
  name,
  icon,
  error,
  onChange,
}) {
  const previewName = name.trim() || "Preview";

  const selectedIcon = SPECIALTY_TAG_ICONS.find(
    (option) => option.value === icon,
  );

  const PreviewIcon = selectedIcon?.icon ?? Tag;

  return (
    <div>
      {/* Field description */}
      <p className="mb-2 text-sm font-medium text-text-primary">Tag Color</p>

      <p className="mb-4 text-xs text-text-secondary">
        Choose how this specialty tag will appear throughout the application.
      </p>

      {/* Tag color previews */}
      <div className="flex flex-wrap gap-3">
        {TAG_COLORS.map((color) => {
          const isSelected = value === color;

          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={`inline-flex min-w-28 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                colorClasses[color]
              } ${
                isSelected
                  ? `ring-2 ${ringClasses[color]}`
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <PreviewIcon
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={2.25}
              />

              <span>{previewName}</span>

              {isSelected && (
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>

      {/* Validation error */}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
