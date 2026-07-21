import ForgotPasswordForm from "../components/ForgotPasswordForm";
import AuthSplitLayout from "../components/AuthSplitLayout";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function ForgotPasswordPage() {
  useDocumentTitle("Forgot Password | SugboGo Admin");

  return (
    <AuthSplitLayout>
      <ForgotPasswordForm />
    </AuthSplitLayout>
  );
}
