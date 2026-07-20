import { Link } from "react-router-dom";
import { FiMail } from "react-icons/fi";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import AuthLayout from "../components/AuthLayout";

export default function ForgotPasswordSent() {
  useDocumentTitle("Forgot Password Sent | SugboGo Admin");
  return (
    <AuthLayout>
      <article className="rounded-2xl bg-white text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <FiMail className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900">Check your email</h1>

        <p className="mt-4 text-sm leading-6 text-gray-500">
          If an account exists with that email address, we've sent password
          reset instructions.
        </p>

        <Link
          to="/login"
          className="mt-8 inline-flex w-full justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Back to Login
        </Link>
      </article>
    </AuthLayout>
  );
}
