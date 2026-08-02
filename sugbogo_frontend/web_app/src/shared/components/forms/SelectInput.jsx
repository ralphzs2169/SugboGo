import clsx from "clsx";

/**
 * Reusable select input for admin forms.
 *
 * @param {Object} props
 * @param {string} props.id - Select input id.
 * @param {string} props.name - Select input name.
 * @param {string} props.label - Field label.
 * @param {string} props.value - Current select value.
 * @param {Function} props.onChange - Change handler.
 * @param {string} [props.error] - Validation error message.
 * @param {boolean} [props.required=false] - Whether the field is required.
 * @param {boolean} [props.disabled=false] - Whether the select input is disabled.
 * @param {string} [props.placeholder="Select an option"] - Placeholder text for the select input.
 * @param {React.ReactNode} props.children - Options to be rendered inside the select input.
 *
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
          {required && <span className="ml-1 text-text-error">*</span>}
        </label>
      )}

      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={clsx(
          "w-full rounded-md border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:ring-4",
          disabled && "cursor-not-allowed opacity-60",
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
            : "border-stroke focus:border-primary focus:ring-primary/15",
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
