import { User } from "lucide-react";

/**
 * AuthTextInput component that renders a text input field.
 */
export default function AuthTextInput({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  value,
  onChange,
  error,
  onFocus,
  icon: Icon = User,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-text-primary"
      >
        {label}
      </label>

      <div className="relative">
        <Icon
          className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${
            error ? "text-danger" : "text-text-secondary"
          }`}
        />

        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          className={`w-full rounded-md border bg-background py-3 pl-12 pr-4 text-sm text-text-primary outline-none transition placeholder:text-text-secondary  ${
            error
              ? "border-danger focus:border-danger "
              : "border-stroke focus:border-stroke-active "
          }`}
        />
      </div>

      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
