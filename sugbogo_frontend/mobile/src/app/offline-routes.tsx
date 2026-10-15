import { useLocalSearchParams } from "expo-router";

import OfflineRoutesScreen from "@/features/offline-routes/screens/OfflineRoutesScreen";

/** Opens device-only guidance; no account identifier is accepted from navigation parameters. */
export default function OfflineRoutesRoute() {
  const { journeyKey } = useLocalSearchParams<{
    journeyKey?: string | string[];
  }>();
  return (
    <OfflineRoutesScreen
      journeyKey={typeof journeyKey === "string" ? journeyKey : undefined}
    />
  );
}
