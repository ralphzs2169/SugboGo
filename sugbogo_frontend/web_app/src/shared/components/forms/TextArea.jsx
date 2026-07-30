/**
 * Reusable textarea for admin forms.
 *
 * @param {Object} props
 * @param {string} props.id - Textarea id.
 * @param {string} props.name - Textarea name.
 * @param {string} props.label - Field label.
 * @param {string} [props.placeholder] - Placeholder text.
 * @param {string} props.value - Current textarea value.
 * @param {Function} props.onChange - Change handler.
 * @param {string} [props.error] - Validation error message.
 * @param {number} [props.rows=4] - Number of visible rows.
 * @param {boolean} [props.required=false] - Whether the field is required.
 *
 * @returns {JSX.Element}
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
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-primary"
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
        className={`
          w-full rounded-lg border px-3 py-2.5
          bg-background
          text-sm text-text-primary
          placeholder:text-text-secondary
          outline-none transition resize-none

          ${
            error
              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
              : "border-stroke focus:border-primary focus:ring-2 focus:ring-primary/20"
          }
        `}
      />

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
