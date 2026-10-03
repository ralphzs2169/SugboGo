import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/features/auth/store/auth.store";
import AppSplash from "@/shared/components/AppSplash";
import { toastConfig } from "@/shared/components/ToastConfig";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import "../../global.css";

/**
 * Initializes the application's global providers, fonts, authentication
 * restoration, navigation, keyboard handling, and shared UI infrastructure.
 */
export default function RootLayout() {
  useRestoreSession();

  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <AppSplash />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />

        <ActionSheetProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <KeyboardProvider>
              <BottomSheetModalProvider>
                {/* App navigation */}
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" options={{ animation: "none" }} />

                  <Stack.Screen name="(auth)" options={{ animation: "none" }} />

                  <Stack.Screen
                    name="(explorer)"
                    options={{ animation: "none" }}
                  />

                  <Stack.Screen
                    name="(setup)"
                    options={{ animation: "none" }}
                  />

                  <Stack.Screen
                    name="(merchant)"
                    options={{ animation: "none" }}
                  />
                </Stack>
              </BottomSheetModalProvider>

              {/* Global toast notifications */}
              <Toast config={toastConfig} />
            </KeyboardProvider>
          </SafeAreaProvider>
        </ActionSheetProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
