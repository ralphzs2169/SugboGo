import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../storage/auth.store";

/**
 * ProtectedRoute component that restricts access to authenticated users.
 * If the user is not authenticated, it redirects to the login page.
 * If the authentication state is still loading, it renders nothing.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
