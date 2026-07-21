import { useLocation, useNavigate } from "react-router-dom";
import { RotateCw, Clock, Pencil, ArrowLeft } from "lucide-react";
import EmailSentIllustration from "../../assets/email-sent.svg?react";
import PrimaryButton from "../common/PrimaryButton";

export default function EmailSent({
  resendDisabled = true,
  resendCountdown = 60,
  onResend,
}) {
  const navigate = useNavigate();
  const { state } = useLocation();

  const email = state?.email ?? "";
  const expiryHours = state?.expiryHours ?? 24;

  return (
    <article className="w-full text-center">
      <div className="mx-auto flex h-42 w-42 items-center justify-center">
        <EmailSentIllustration />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Check your email
      </h1>

      <p className="mt-4 text-sm leading-6 text-gray-500">
        We've sent password reset instructions to
      </p>

      <p className="mt-2 break-all text-base font-semibold text-gray-800">
        {email}
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="text-sm font-semibold text-gray-800">
          Didn't receive it?
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li>Check your Spam or Junk folder.</li>
          <li>Make sure the email address is correct.</li>
        </ul>

        {/* Secondary actions, grouped with the "didn't receive it" context */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={resendDisabled}
            onClick={onResend}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:no-underline"
          >
            {resendDisabled ? (
              <>
                <Clock className="h-4 w-4" />
                Resend in {resendCountdown}s
              </>
            ) : (
              <>
                <RotateCw className="h-4 w-4" />
                Resend Email
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/forgot-password", {
                state: { email },
              })
            }
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-gray-900 hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Different email
          </button>
        </div>
      </div>

      <PrimaryButton
        icon={<ArrowLeft className="h-5 w-5" />}
        onClick={() => navigate("/login")}
        className="mt-8"
      >
        Back to Sign In
      </PrimaryButton>
    </article>
  );
}
