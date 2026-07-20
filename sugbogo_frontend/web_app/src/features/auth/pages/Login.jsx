import LoginCard from "../components/LoginCard";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function Login() {
  useDocumentTitle("Login | SugboGo Admin");

  return <LoginCard />;
}
