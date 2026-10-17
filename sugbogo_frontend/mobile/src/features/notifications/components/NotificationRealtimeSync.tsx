import { useNotificationWebSocketLifecycle } from "../hooks/useNotificationWebSocketLifecycle";

/**
 * Mounts account-level notification synchronization once beneath the global
 * QueryClient provider without rendering any interface.
 */
export default function NotificationRealtimeSync() {
  useNotificationWebSocketLifecycle();

  return null;
}
