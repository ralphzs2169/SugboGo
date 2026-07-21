import { User } from "lucide-react";

/**
 * TextInput component that renders a text input field.
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
  error,
  onFocus,
  icon: Icon = User,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>

      <div className="relative">
        <Icon
          className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${
            error ? "text-red-400" : "text-gray-400"
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
          className={`w-full rounded-md border bg-white py-3 pl-12 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-4 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
              : "border-gray-300 focus:border-primary focus:ring-primary/15"
          }`}
        />
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
