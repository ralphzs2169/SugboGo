import { useNavigate } from "react-router-dom";
import { logout } from "../utils/authSession";

/**
 * Custom hook for handling user logout.
 * Provides a function to perform logout and navigate to the login page.
 */
export function useLogout() {
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return {
    handleLogout,
  };
}
