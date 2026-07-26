import SigningInOverlay from "@/features/auth/components/SigningInOverlay";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/store/auth.store";
import AppSplash from "@/shared/components/AppSplash";
import { toastConfig } from "@/shared/components/ToastConfig";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import "../../global.css";

export default function RootLayout() {
  useRestoreSession();

  const isLoading = useAuthStore((state) => state.isLoading);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);

  if (isLoading) {
    return <AppSplash />;
  }

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <ActionSheetProvider>
          <SafeAreaProvider>
            <BottomSheetModalProvider>
              <Stack screenOptions={{ headerShown: false, animation: "none" }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(explorer)" />
                <Stack.Screen name="(setup)" />
              </Stack>

              {isSigningIn && <SigningInOverlay />}
              <Toast config={toastConfig} />
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </ActionSheetProvider>
      </GestureHandlerRootView>
    </>
  );
}
