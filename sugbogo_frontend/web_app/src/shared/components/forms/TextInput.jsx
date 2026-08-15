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
          className={clsx(
            "w-full rounded-md border-2 bg-background py-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary",
            Icon ? "pl-12 pr-4" : "px-4",
            error
              ? "border-danger focus:border-danger "
              : "border-stroke focus:border-stroke-active ",
          )}
        />
      </div>

      {error && <p className="mt-1 text-xs font-bold text-danger">{error}</p>}
    </div>
  );
}
