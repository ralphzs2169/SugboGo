import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../storage/auth.store";

/**
 * Restricts administrative routes to restored Admin and Super Admin sessions.
 * If the user is not authenticated, it redirects to the login page.
 * If the authentication state is still loading, it renders nothing.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !["admin", "super_admin"].includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
