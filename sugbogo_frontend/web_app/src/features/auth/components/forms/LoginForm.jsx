import PasswordInput from "../password/PasswordInput";
import AuthTextInput from "../common/AuthTextInput";
import AuthTextButton from "../common/AuthTextButton";
import PrimaryButton from "../common/PrimaryButton";
import { LogIn } from "lucide-react";
import { validateLoginForm } from "../../utils/loginValidator";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../../hooks/useLogin";
import { getSessionExpired, clearSessionExpired } from "@/shared/api/storage";

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
  const [retryAfter, setRetryAfter] = useState(0);

  const navigate = useNavigate();

  // Run a live countdown while the login request is rate limited.
  useEffect(() => {
    if (retryAfter <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRetryAfter((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfter]);

  // Clear specific field errors when the user focuses on the input.
  const clearFieldError = (field) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  // Handle form submission.
  async function onSubmit(event) {
    event.preventDefault();

    if (loading || retryAfter > 0) {
      return;
    }

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

    if (result.code === "RATE_LIMIT_EXCEEDED") {
      setRetryAfter(result.errors?.retry_after ?? 0);
      setFormError("");
      return;
    }

    setRetryAfter(0);

    if (result.errors) {
      setErrors({
        email: result.errors.email,
        password: result.errors.password,
      });

      return;
    }

    setFormError(result.message);
  }

  useEffect(() => {
    if (!getSessionExpired()) {
      return;
    }

    setFormError("Your session has expired. Please log in again.");
    clearSessionExpired();
  }, []);

  const displayedFormError =
    retryAfter > 0
      ? `Too many login attempts. Please try again in ${retryAfter} seconds.`
      : formError;

  return (
    <section className="w-full bg-background">
      {/* Header Section */}
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Welcome, Admin
        </h1>

        <p className="mt-2.5 text-sm text-text-secondary sm:text-base">
          Sign in to manage SugboGo's tourism operations
        </p>
      </div>

      <form className="space-y-6 sm:space-y-7 lg:space-y-8" onSubmit={onSubmit}>
        {/* Input Fields Container */}
        <div className="space-y-5 sm:space-y-6 lg:space-y-7">
          <AuthTextInput
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
            className="flex cursor-pointer select-none items-center gap-2.5 text-xs font-medium text-text-secondary sm:text-sm"
          >
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary accent-primary focus:ring-primary"
            />

            <span>Remember me</span>
          </label>

          <AuthTextButton onClick={() => navigate("/forgot-password")}>
            Forgot Password?
          </AuthTextButton>
        </div>

        {/* Form Level Error Message */}
        {displayedFormError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 sm:text-sm"
          >
            {displayedFormError}
          </div>
        )}

        {/* Primary Call to Action Button */}
        <PrimaryButton
          type="submit"
          loading={loading}
          disabled={loading || retryAfter > 0}
          icon={<LogIn className="h-5 w-5" />}
        >
          Log In
        </PrimaryButton>
      </form>
    </section>
  );
}

export default LoginForm;
