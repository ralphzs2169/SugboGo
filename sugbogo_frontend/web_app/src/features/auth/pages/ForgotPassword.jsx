import AuthLayout from "../components/AuthLayout";
import ForgotPasswordForm from "../components/ForgotPasswordForm";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function ForgotPassword() {
  useDocumentTitle("Forgot Password | SugboGo Admin");
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
