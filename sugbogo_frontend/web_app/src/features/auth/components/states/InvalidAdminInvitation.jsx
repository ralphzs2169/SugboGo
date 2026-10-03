import { ArrowLeft, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import LinkExpiredIllustration from "../../assets/link-expired.svg?react";
import AuthTextButton from "../common/AuthTextButton";
import PrimaryButton from "../common/PrimaryButton";

export default function InvalidAdminInvitation({ retryable = false, onRetry }) {
  const navigate = useNavigate();

  return (
    <article className="w-full text-center">
      <div className="mx-auto flex h-48 w-48 items-center justify-center">
        <LinkExpiredIllustration />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        {retryable ? "Unable to Verify Invitation" : "Invitation Unavailable"}
      </h1>

      <p className="mt-4 text-sm leading-6 text-gray-500 sm:text-base">
        {retryable
          ? "We could not verify this invitation right now. Please try again."
          : "This invitation link is invalid or has expired. Contact your administrator for a new invitation."}
      </p>

      {retryable && (
        <PrimaryButton
          className="mt-8"
          icon={<RotateCw className="h-5 w-5" aria-hidden="true" />}
          onClick={onRetry}
        >
          Try Again
        </PrimaryButton>
      )}

      <div className={retryable ? "mt-5" : "mt-8"}>
        <AuthTextButton
          icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          onClick={() => navigate("/login")}
        >
          Go to Admin Login
        </AuthTextButton>
      </div>
    </article>
  );
}
