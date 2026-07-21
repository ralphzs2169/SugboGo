import { useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import PrimaryButton from "../common/PrimaryButton";

import TextInput from "../common/TextInput";
import AuthTextButton from "../common/AuthTextButton";
import { validateEmail } from "../../../../shared/utils/validators/auth.validator";
import { useForgotPassword } from "../../hooks/useForgotPassword";
import { useNavigate, useLocation } from "react-router-dom";
import { usePasswordResetConfig } from "../../hooks/usePasswordResetConfig";

export default function ForgotPasswordForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const { handleForgotPassword, loading } = useForgotPassword();
  const { expiryHours } = usePasswordResetConfig();

  const [email, setEmail] = useState(location.state?.email ?? "");

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const clearEmailError = () => {
    setErrors({});
    setFormError("");
  };

  async function onSubmit(event) {
    event.preventDefault();

    if (loading) return;
    const validationErrors = validateEmail(email);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    const response = await handleForgotPassword(email);

    if (!response.success) {
      setFormError(response.message);
      return;
    }

    navigate("/forgot-password/sent", {
      state: {
        email,
        successMessage: "Password reset link sent successfully.",
      },
    });
  }

  return (
    <article className="w-full">
      {/* Header */}
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Forgot your Password?
        </h1>

        <p className="mt-2.5 text-sm sm:text-base text-gray-500">
          Enter your email address and we'll send you a password reset link.
        </p>
      </div>

      <form className="space-y-6 sm:space-y-7 lg:space-y-8" onSubmit={onSubmit}>
        {/* Email */}
        <TextInput
          id="email"
          name="email"
          label="Email Address"
          autoComplete="email"
          placeholder="admin@example.com"
          value={email}
          error={errors.email}
          onFocus={clearEmailError}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Reassurance detail — plain inline hint, not boxed, so it doesn't
            read as another form field */}
        <p className="flex items-center gap-1.5 px-0.5 text-xs text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          We'll send a secure reset link that expires in{" "}
          {expiryHours ? `${expiryHours} hours` : "..."}.
        </p>

        {/* Form Error */}
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 sm:text-sm">
            {formError}
          </div>
        )}

        {/* Submit */}
        <PrimaryButton
          type="submit"
          loading={loading}
          icon={<Mail className="h-5 w-5" />}
        >
          Send Reset Link
        </PrimaryButton>

        {/* Back */}
        <AuthTextButton
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/login")}
        >
          Back to Sign In
        </AuthTextButton>
      </form>
    </article>
  );
}
