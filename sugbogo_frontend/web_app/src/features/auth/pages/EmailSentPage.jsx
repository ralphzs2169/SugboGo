import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import AuthSplitLayout from "../components/common/AuthSplitLayout";
import EmailSent from "../components/states/EmailSent";
import { useForgotPassword } from "../hooks/useForgotPassword";

const DEFAULT_RESEND_DELAY = 60;

export default function EmailSentPage() {
  useDocumentTitle("Check Your Email | SugboGo Admin");

  const location = useLocation();
  const navigate = useNavigate();

  const { handleForgotPassword, loading } = useForgotPassword();

  const email = location.state?.email ?? "";

  const [countdown, setCountdown] = useState(DEFAULT_RESEND_DELAY);

  // Show toast only once
  useEffect(() => {
    if (location.state?.successMessage) {
      toast.success(location.state.successMessage);

      navigate(location.pathname, {
        replace: true,
        state: {
          email,
        },
      });
    }
  }, [location, navigate, email]);

  // Countdown timer
  useEffect(() => {
    if (countdown === 0) return;

    const timer = setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle resend password reset email
  async function handleResend() {
    if (!email) return;

    const result = await handleForgotPassword(email);

    if (!result.success) {
      if (result.retry_after) {
        setCountdown(result.retry_after);
      }

      toast.error(result.message);
      return;
    }

    toast.success("Password reset email sent.");

    setCountdown(result.retry_after ?? DEFAULT_RESEND_DELAY);
  }

  return (
    <AuthSplitLayout>
      <EmailSent
        resendDisabled={loading || countdown > 0}
        resendCountdown={countdown}
        onResend={handleResend}
      />
    </AuthSplitLayout>
  );
}
