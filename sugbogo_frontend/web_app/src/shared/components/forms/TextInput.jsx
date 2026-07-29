import clsx from "clsx";

/**
 * Reusable text input for admin forms.
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
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-text-primary"
        >
          {label}
          {required && <span className="ml-1 text-error">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className={clsx(
              "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2",
              error ? "text-red-400" : "text-text-secondary",
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
          className={clsx(
            "w-full rounded-md border bg-background-primary py-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary focus:ring-4",
            Icon ? "pl-12 pr-4" : "px-4",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
              : "border-stroke focus:border-primary focus:ring-primary/15",
          )}
        />
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
