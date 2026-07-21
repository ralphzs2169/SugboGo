import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import LoginForm from "../components/LoginForm";
import AuthSplitLayout from "../components/AuthSplitLayout";

/**
 * Login page component for the admin dashboard.
 */
export default function LoginPage() {
  useDocumentTitle("Login | SugboGo Admin");

  const location = useLocation();
  const navigate = useNavigate();

  // Check for success message in location state and display toast notification
  useEffect(() => {
    if (location.state?.successMessage) {
      toast.success(location.state.successMessage);

      navigate(location.pathname, {
        replace: true,
        state: null,
      });
    }
  }, [location, navigate]);

  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  );
}
