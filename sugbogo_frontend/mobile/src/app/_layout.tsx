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
import { useFonts } from "expo-font";

export default function RootLayout() {
  useRestoreSession();

  const [fontsLoaded] = useFonts({
    Inter: require("@/assets/fonts/Inter_28pt-Regular.ttf"),
    "Inter-Light": require("@/assets/fonts/Inter_28pt-Light.ttf"),
    "Inter-ExtraLight": require("@/assets/fonts/Inter_28pt-ExtraLight.ttf"),
    "Inter-Medium": require("@/assets/fonts/Inter_28pt-Medium.ttf"),
    "Inter-SemiBold": require("@/assets/fonts/Inter_28pt-SemiBold.ttf"),
    "Inter-Bold": require("@/assets/fonts/Inter_28pt-Bold.ttf"),
    "Inter-ExtraBold": require("@/assets/fonts/Inter_28pt-ExtraBold.ttf"),
    "Inter-Black": require("@/assets/fonts/Inter_28pt-Black.ttf"),
  });

  const isLoading = useAuthStore((state) => state.isLoading);

  if (!fontsLoaded) {
    return null;
  }

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

              <Toast config={toastConfig} />
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </ActionSheetProvider>
      </GestureHandlerRootView>
    </>
  );
}
