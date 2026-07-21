import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import AuthSplitLayout from "../components/AuthSplitLayout";
import ResetPasswordForm from "../components/ResetPasswordForm";
import InvalidResetLink from "../components/InvalidResetLink";

import { useValidateResetToken } from "../hooks/useValidateResetToken";

export default function ResetPasswordPage() {
  useDocumentTitle("Reset Password | SugboGo Admin");

  const [searchParams] = useSearchParams();

  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const { handleValidateResetToken } = useValidateResetToken();

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    async function validateToken() {
      // Missing parameters
      if (!uid || !token) {
        setTokenValid(false);
        setCheckingToken(false);
        return;
      }

      const result = await handleValidateResetToken({
        uid,
        token,
      });

      setTokenValid(result.success);
      setCheckingToken(false);
    }

    validateToken();
  }, [uid, token, handleValidateResetToken]);

  if (checkingToken) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">
            Verifying your reset link...
          </p>
        </div>
      </AuthSplitLayout>
    );
  }

  if (!tokenValid) {
    return (
      <AuthSplitLayout>
        <InvalidResetLink />
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <ResetPasswordForm />
    </AuthSplitLayout>
  );
}
