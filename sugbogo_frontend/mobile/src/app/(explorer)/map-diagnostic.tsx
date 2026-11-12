import { Redirect, Stack, type ErrorBoundaryProps } from "expo-router";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import MapDiagnosticScreen from "@/features/map/screens/MapDiagnosticScreen";
import ErrorState from "@/shared/components/ErrorState";
import { defaultStackScreenOptions } from "@/shared/navigation/stackOptions";

/** Opens the opt-in Maps diagnostic from a tester link. */
export default function MapDiagnosticRoute() {
  if (Platform.OS !== "android" || Updates.channel !== "preview") {
    return <Redirect href="/(explorer)/(tabs)/map" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          headerShown: true,
          title: "Google Maps diagnostic",
        }}
      />
      <MapDiagnosticScreen />
    </>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorState
      title="Could not render the diagnostic"
      description={`The map screen encountered a JavaScript error (${error.name}).`}
      primaryActionTitle="Retry"
      onPrimaryAction={() => void retry()}
    />
  );
}
