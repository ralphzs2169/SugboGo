import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import PrimaryButton from "../common/PrimaryButton";
import PasswordInput from "../password/PasswordInput";
import PasswordRequirementsList from "../password/PasswordRequirementsList";
import { useCompleteAdminInvitation } from "../../hooks/useCompleteAdminInvitation";
import {
  buildAdminInvitationCompletionPayload,
  canSubmitAdminInvitation,
  isInvalidAdminInvitationError,
  normalizeAdminInvitationFieldErrors,
  validateAdminInvitationPasswords,
} from "../../utils/adminInvitationSetup";

export default function AdminInvitationSetupForm({
  credentials,
  onCompleted,
  onInvitationInvalid,
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const submissionLockRef = useRef(false);
  const { completeInvitation, isCompleting } = useCompleteAdminInvitation();

  function clearFieldError(field) {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isCompleting || submissionLockRef.current) {
      return;
    }

    const validationErrors = validateAdminInvitationPasswords(
      password,
      confirmPassword,
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");
    submissionLockRef.current = true;

    try {
      await completeInvitation(
        buildAdminInvitationCompletionPayload(
          credentials,
          password,
          confirmPassword,
        ),
      );
      onCompleted();
    } catch (error) {
      if (isInvalidAdminInvitationError(error)) {
        onInvitationInvalid();
        return;
      }

      const response = error.response?.data;

      if (response?.errors) {
        setErrors(normalizeAdminInvitationFieldErrors(response.errors));
        return;
      }

      setFormError(
        response?.code === "NETWORK_ERROR" ||
          response?.code === "REQUEST_TIMEOUT"
          ? response.message
          : "Unable to complete account setup. Please try again.",
      );
    } finally {
      submissionLockRef.current = false;
    }
  }

  const submitDisabled = !canSubmitAdminInvitation({
    password,
    confirmPassword,
    isPending: isCompleting,
  });

  return (
    <article className="w-full">
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Set Up Your Admin Account
        </h1>

        <p className="mt-2.5 text-sm text-gray-500 sm:text-base">
          Create a password to finish setting up your SugboGo Admin account.
        </p>
      </div>

      <form
        className="space-y-6 sm:space-y-7 lg:space-y-8"
        onSubmit={handleSubmit}
      >
        <div className="space-y-3">
          <PasswordInput
            id="admin-setup-password"
            name="password"
            label="New Password"
            autoComplete="new-password"
            placeholder="Enter your new password"
            value={password}
            error={errors.password}
            onFocus={() => clearFieldError("password")}
            onChange={(event) => {
              setPassword(event.target.value);

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
          id="admin-setup-confirm-password"
          name="confirm_password"
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          error={errors.confirm_password || errors.confirmPassword}
          onFocus={() => {
            setErrors((current) => ({
              ...current,
              confirm_password: undefined,
              confirmPassword: undefined,
            }));
            setFormError("");
          }}
          onChange={(event) => {
            setConfirmPassword(event.target.value);

            if (
              errors.confirm_password ||
              errors.confirmPassword ||
              formError
            ) {
              setErrors((current) => ({
                ...current,
                confirm_password: undefined,
                confirmPassword: undefined,
              }));
              setFormError("");
            }
          }}
        />

        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 sm:text-sm"
          >
            {formError}
          </div>
        )}

        <PrimaryButton
          type="submit"
          loading={isCompleting}
          disabled={submitDisabled}
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        >
          Activate Account
        </PrimaryButton>
      </form>
    </article>
  );
}
