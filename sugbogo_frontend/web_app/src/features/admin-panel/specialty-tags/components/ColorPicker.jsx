import { Check } from "lucide-react";
import {
  TAG_COLORS,
  colorClasses,
  ringClasses,
} from "@/shared/components/SpecialtyTagChip";

export default function SpecialtyTagColorPicker({
  value,
  name,
  error,
  onChange,
}) {
  const previewName = name.trim() || "Preview";

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-primary">Tag Color</p>

      <p className="mb-4 text-xs text-text-secondary">
        Choose how this specialty tag will appear throughout the application.
      </p>

      <div className="flex flex-wrap gap-3">
        {TAG_COLORS.map((color) => {
          const isSelected = value === color;

          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={`inline-flex cursor-pointer min-w-28 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                colorClasses[color]
              } ${
                isSelected
                  ? `ring-2 ${ringClasses[color]}`
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {previewName}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
