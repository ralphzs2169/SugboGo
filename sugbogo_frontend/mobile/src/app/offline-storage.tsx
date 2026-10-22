import OfflineStorageScreen from "@/features/offline-pockets/screens/OfflineStorageScreen";

/** Device-only storage overview; backend authentication is never inferred from local access. */
export default function OfflineStorageRoute() {
  return <OfflineStorageScreen />;
}
