import clsx from "clsx";
import { Check } from "lucide-react";

/**
 * Reusable text input for admin forms.
 *
 * Supports optional minimum-length validation and character-count feedback
 * for forms that need to communicate completion requirements.
 */
export default function TextInput({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  value,
  onChange,
  onFocus,
  error,
  required = false,
  icon: Icon,
  minLength,
  showCharacterCount = false,
}) {
  const characterCount = value?.trim().length ?? 0;

  const isValid =
    !error && minLength !== undefined && characterCount >= minLength;

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-text-primary"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className={clsx(
              "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2",
              error ? "text-danger" : "text-text-secondary",
            )}
          />
        )}

        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={clsx(
            "w-full rounded-md border-2 bg-background py-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary",
            Icon ? "pl-12 pr-4" : "px-4",
            error
              ? "border-danger focus:border-danger"
              : "border-stroke focus:border-stroke-active",
          )}
        />
      </div>

      {/* Validation feedback */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {error && (
            <p id={`${id}-error`} className="text-xs font-bold text-danger">
              {error}
            </p>
          )}
        </div>

        {showCharacterCount && minLength !== undefined && (
          <span
            className={clsx(
              "flex shrink-0 items-center gap-1 text-xs",
              isValid ? "text-success" : "text-text-secondary",
            )}
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
