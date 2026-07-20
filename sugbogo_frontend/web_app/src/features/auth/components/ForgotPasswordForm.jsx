import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SugboGoText from "@/shared/components/SugboGoText";
import TextInput from "./TextInput";
import { useForgotPassword } from "../hooks/useForgotPassword";

/**
 * ForgotPasswordForm component renders a form for users to request a password reset.
 * It includes an email input field, a submit button, and a link to navigate back to the login page.
 */
export default function ForgotPasswordForm() {
  const navigate = useNavigate();

  const { handleForgotPassword, loading } = useForgotPassword();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();

    setError("");

    const result = await handleForgotPassword(email);

    if (!result.success) {
      setError(result.message);
      return;
    }

    navigate("/forgot-password/sent");
  }

  return (
    <article className="rounded-2xl bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Forgot Password
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Enter your email address and we'll send you a password reset link.
        </p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <TextInput
          id="email"
          name="email"
          label="Email Address"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:brightness-95 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Reset Link"}
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
