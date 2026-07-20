import LoginCard from "@/features/auth/components/LoginCard";
import useDocumentTitle from "../hooks/useDocumentTitle";

function Login() {
  useDocumentTitle("Login | SugboGo Admin");

  return <LoginCard />;
}

export default Login;
