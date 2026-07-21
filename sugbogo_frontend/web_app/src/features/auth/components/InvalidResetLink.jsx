import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCw, TriangleAlert } from "lucide-react";
import LinkExpiredIllustration from "../assets/link-expired3.svg?react";
import PrimaryButton from "./PrimaryButton";

import AuthTextButton from "./AuthTextButton";

export default function InvalidResetLink() {
  const navigate = useNavigate();

  return (
    <article className="w-full text-center">
      <div className="mx-auto flex h-48 w-48 items-center justify-center">
        <LinkExpiredIllustration />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Reset Link Expired
      </h1>

      <p className="mt-4 text-sm leading-6 text-gray-500 sm:text-base">
        This password reset link is no longer valid.
        <br />
        It may have expired or has already been used.
      </p>

      <PrimaryButton
        className="mt-8"
        icon={<RotateCw className="h-5 w-5" />}
        onClick={() => navigate("/forgot-password")}
      >
        Request New Reset Link
      </PrimaryButton>

      <div className="mt-5">
        <AuthTextButton
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/login")}
        >
          Back to Sign In
        </AuthTextButton>
      </div>
    </article>
  );
}
