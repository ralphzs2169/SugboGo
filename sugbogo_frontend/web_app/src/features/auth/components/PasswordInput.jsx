import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

/**
 * PasswordInput component that renders a password input field with a toggle button to show/hide the password.
 *
 * @component
 * @param {string} id - The id of the input field.
 * @param {string} name - The name of the input field.
 * @param {string} label - The label for the input field.
 * @param {string} autoComplete - The autocomplete attribute for the input field.
 * @param {string} placeholder - The placeholder text for the input field.
 * @param {string} value - The value of the input field.
 * @param {function} onChange - The onChange event handler for the input field.
 */
export default function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  value,
  onChange,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:text-primary"
        >
          {showPassword ? (
            <FiEyeOff className="h-4 w-4" />
          ) : (
            <FiEye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
