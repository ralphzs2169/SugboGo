import OfflinePocketLibraryScreen from "@/features/offline-pockets/screens/OfflinePocketLibraryScreen";

/** Local-only route; authorization is checked by the snapshot repository. */
export default function OfflinePocketsRoute() {
  return <OfflinePocketLibraryScreen />;
}
