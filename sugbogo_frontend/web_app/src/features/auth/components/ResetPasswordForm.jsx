import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { FiArrowLeft } from "react-icons/fi";

import PrimaryButton from "./PrimaryButton";
import PasswordInput from "./PasswordInput";
import AuthTextButton from "./AuthTextButton";
import PasswordRequirementsList from "./PasswordRequirementsList";

import { validateResetPassword } from "../utils/resetPasswordValidator";
import { useResetPassword } from "../hooks/useResetPassword";

/**
 * ResetPasswordForm component renders a form for users to reset their password.
 * It includes fields for new password and confirm password, a submit button, and a link to navigate back to the login page.
 */
export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const { handleResetPassword, loading } = useResetPassword();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const clearFieldError = (field) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  async function onSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const validationErrors = validateResetPassword(password, confirmPassword);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    const result = await handleResetPassword({
      uid,
      token,
      password,
      confirm_password: confirmPassword,
    });

    if (!result.success) {
      if (result.errors) {
        setErrors(result.errors);
        return;
      }

      setFormError(result.message);
      return;
    }

    navigate("/login", {
      replace: true,
      state: {
        successMessage: "Password updated successfully. You can now sign in.",
      },
    });
  }

  return (
    <article className="w-full">
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Reset Password
        </h1>

        <p className="mt-2.5 text-sm text-gray-500 sm:text-base">
          Enter your new password below.
        </p>
      </div>

      <form className="space-y-6 sm:space-y-7 lg:space-y-8" onSubmit={onSubmit}>
        <div className="space-y-3">
          <PasswordInput
            id="password"
            name="password"
            label="New Password"
            autoComplete="new-password"
            placeholder="Enter your new password"
            value={password}
            error={errors.password}
            onFocus={() => clearFieldError("password")}
            onChange={(e) => {
              setPassword(e.target.value);

              if (errors.password || formError) {
                clearFieldError("password");
              }
            }}
          />

          <PasswordRequirementsList
            password={password}
            confirmPassword={confirmPassword}
          />
        </div>

        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          error={errors.confirmPassword}
          onFocus={() => clearFieldError("confirmPassword")}
          onChange={(e) => {
            setConfirmPassword(e.target.value);

            if (errors.confirmPassword || formError) {
              clearFieldError("confirmPassword");
            }
          }}
        />

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 sm:text-sm">
            {formError}
          </div>
        )}

        <PrimaryButton
          type="submit"
          loading={loading}
          icon={<KeyRound className="h-5 w-5" />}
        >
          Reset Password
        </PrimaryButton>

        <AuthTextButton
          icon={<FiArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/login")}
        >
          Back to Sign In
        </AuthTextButton>
      </form>
    </article>
  );
}
