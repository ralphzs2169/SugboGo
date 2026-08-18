import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Lock } from "lucide-react";

/**
 * PasswordInput component that renders a password input field with a
 * toggle button to show/hide the password.
 */
export default function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  value,
  onChange,
  error,
  onFocus,
  icon: Icon = Lock,
}) {
  const [showPassword, setShowPassword] = useState(false);

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
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          className={`w-full rounded-lg border bg-background py-3 pl-12 pr-12 text-sm text-text-primary outline-none transition placeholder:text-text-secondary ${
            error
              ? "border-danger focus:border-danger "
              : "border-stroke focus:border-stroke-active "
          }`}
        />

        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary transition hover:text-text-primary focus:outline-none focus-visible:text-text-primary"
        >
          {showPassword ? (
            <FiEyeOff className="h-4 w-4" />
          ) : (
            <FiEye className="h-4 w-4" />
          )}
        </button>
      </div>

      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
