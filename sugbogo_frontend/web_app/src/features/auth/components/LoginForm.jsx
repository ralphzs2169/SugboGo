import PasswordInput from "./PasswordInput";
import TextInput from "./TextInput";
import AuthTextButton from "./AuthTextButton";
import PrimaryButton from "./PrimaryButton";

import { LogIn } from "lucide-react";
import { validateLoginForm } from "../utils/loginValidator";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLogin } from "../hooks/useLogin";
import { ArrowRight, Anchor } from "lucide-react";

/**
 * LoginForm component renders a login form for the admin dashboard.
 * Optimized for full-page split layouts with expanded typography and interactive states.
 */
function LoginForm() {
  const { handleLogin, loading } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();

  // Clear specific field error when the user focuses on the input
  const clearFieldError = (field) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  // Handle form submission
  async function onSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const validationErrors = validateLoginForm(email, password);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    const result = await handleLogin(email, password);

    if (result.success) {
      navigate("/admin-panel/dashboard");
      return;
    }

    if (result.errors) {
      setErrors({
        email: result.errors.email,
        password: result.errors.password,
      });

      return;
    }
    setFormError(result.message);
  }

  return (
    <section className="w-full">
      {/* Header Section - Enhanced title sizing & spacing for full-screen layout */}
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Welcome, Admin
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-gray-500">
          Sign in to manage SugboGo's tourism operations
        </p>
      </div>

      <form className="space-y-6 sm:space-y-7 lg:space-y-8" onSubmit={onSubmit}>
        {/* Input Fields Container */}
        <div className="space-y-5 sm:space-y-6 lg:space-y-7">
          <TextInput
            id="identifier"
            name="identifier"
            label="Email or Username"
            autoComplete="username"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            onFocus={() => clearFieldError("email")}
          />

          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            onFocus={() => clearFieldError("password")}
          />
        </div>

        {/* Options Row */}
        <div className="flex items-center justify-between gap-4 pt-1 text-sm">
          <label
            htmlFor="remember-me"
            className="flex select-none items-center gap-2.5 text-gray-600 cursor-pointer text-xs sm:text-sm font-medium"
          >
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <span>Remember me</span>
          </label>

          <AuthTextButton onClick={() => navigate("/forgot-password")}>
            Forgot Password?
          </AuthTextButton>
        </div>

        {/* Form Level Error Message */}
        {formError && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-600 font-medium">
            {formError}
          </div>
        )}

        {/* Primary Call to Action Button */}
        <PrimaryButton
          type="submit"
          loading={loading}
          icon={<LogIn className="h-5 w-5" />}
        >
          Sign In
        </PrimaryButton>
      </form>
    </section>
  );
}

export default LoginForm;
