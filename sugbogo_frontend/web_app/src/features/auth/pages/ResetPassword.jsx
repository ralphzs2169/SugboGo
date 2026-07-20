import AuthLayout from "@/features/auth/components/AuthLayout";
import ResetPasswordForm from "@/features/auth/components/ResetPasswordForm";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function ResetPassword() {
  useDocumentTitle("Reset Password | SugboGo Admin");
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
