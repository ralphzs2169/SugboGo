import clsx from "clsx";

/**
 * Reusable select input for admin forms.
 
 */
export default function SelectInput({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder = "Select an option",
  children,
  compact = false,
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className={compact ? "mb-1 block text-xs font-medium text-text-secondary" : "mb-2 block text-sm font-medium text-text-primary"}
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={clsx(
          "w-full cursor-pointer rounded-md bg-background text-text-primary outline-none transition",
          compact ? "min-h-9 border px-2.5 py-1.5 text-xs" : "border-2 px-4 py-3 text-sm",
          disabled && "cursor-not-allowed opacity-60",
          error
            ? "border-danger focus:border-danger "
            : "border-stroke focus:border-stroke-active ",
        )}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {children}
      </select>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
