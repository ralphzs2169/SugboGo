import ForgotPasswordForm from "../components/forms/ForgotPasswordForm";
import AuthSplitLayout from "../components/common/AuthSplitLayout";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function ForgotPasswordPage() {
  useDocumentTitle("Forgot Password | SugboGo Admin");

  return (
    <AuthSplitLayout>
      <ForgotPasswordForm />
    </AuthSplitLayout>
  );
}
