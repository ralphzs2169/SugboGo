import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PasswordInput from "./PasswordInput";
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
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();

    setError("");

    if (!uid || !token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const result = await handleResetPassword({
      uid,
      token,
      password,
    });

    if (!result.success) {
      setError(result.message);
      return;
    }

    navigate("/login");
  }

  return (
    <article className="rounded-2xl bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>

        <p className="mt-2 text-sm text-gray-500">
          Enter your new password below.
        </p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <PasswordInput
          id="password"
          name="password"
          label="New Password"
          autoComplete="new-password"
          placeholder="Enter your new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        <div className="text-center">
          <Link
            to="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </form>
    </article>
  );
}
