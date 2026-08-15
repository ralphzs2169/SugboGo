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

      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={clsx(
          "w-full rounded-md border-2 bg-background px-4 py-3 text-sm text-text-primary outline-none transition",
          disabled && "cursor-not-allowed opacity-60",
          error
            ? "border-danger focus:border-danger "
            : "border-stroke focus:border-stroke-active ",
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
