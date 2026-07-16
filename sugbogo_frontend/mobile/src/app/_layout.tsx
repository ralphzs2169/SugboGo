import "../../global.css";

import { Stack } from "expo-router";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/store/auth.store";
import Toast from "react-native-toast-message";
import { toastConfig } from "@/shared/components/ToastConfig";

import AppSplash from "@/shared/components/AppSplash";

export default function RootLayout() {
  useRestoreSession();

  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <AppSplash />;
  }
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(explorer)" />
        <Stack.Screen name="(setup)" />
      </Stack>

      <Toast config={toastConfig} />
    </>
  );
}
