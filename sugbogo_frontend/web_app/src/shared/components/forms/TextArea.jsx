import { Check } from "lucide-react";

/**
 * Reusable textarea for admin forms.
 *
 * Supports optional minimum-length validation and character-count feedback
 * for forms that need to communicate completion requirements.
 */
export default function TextArea({
  id,
  name,
  label,
  placeholder,
  value,
  onChange,
  error,
  rows = 4,
  required = false,
  minLength,
  showCharacterCount = false,
}) {
  const characterCount = value?.trim().length ?? 0;

  const isValid =
    !error && minLength !== undefined && characterCount >= minLength;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm mb-2 font-medium text-text-primary"
      >
        {label}

        {required && <span className="ml-1 text-danger">*</span>}
      </label>

      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`
          w-full resize-none rounded-lg border-2 px-3 py-2.5
          bg-background text-sm text-text-primary
          placeholder:text-text-secondary
          outline-none transition

          ${
            error
              ? "border-danger focus:border-danger"
              : "border-stroke focus:border-stroke-active"
          }
        `}
      />

      {/* Validation feedback */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {error && (
            <p id={`${id}-error`} className="text-xs font-bold text-danger">
              {error}
            </p>
          )}
        </div>

        {showCharacterCount && minLength !== undefined && (
          <span
            className={`flex shrink-0 items-center gap-1 text-xs ${
              isValid ? "text-success" : "text-text-secondary"
            }`}
          >
            {isValid && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
                <Check
                  className="h-2.5 w-2.5 text-background"
                  strokeWidth={3}
                />
              </span>
            )}
            {characterCount}/{minLength}
          </span>
        )}
      </div>
    </div>
  );
}
