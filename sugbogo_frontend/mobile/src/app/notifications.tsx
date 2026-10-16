import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import NotificationsScreen from "@/features/notifications/screens/NotificationsScreen";

/** Route entry for the shared account-level notification inbox. */
export default function Notifications() {
  useAuthGuard();

  return <NotificationsScreen />;
}
