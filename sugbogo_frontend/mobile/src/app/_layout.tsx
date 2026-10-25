import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import LogoutConfirmationModal from "@/features/auth/components/LogoutConfirmationModal";
import "@/features/explore/stores/recentSearches.store";
import QueryPersistenceProvider from "@/shared/query/QueryPersistenceProvider";
import QueryLifecycle from "@/shared/query/QueryLifecycle";
import RecentExploreReconnect from "@/features/explore/components/RecentExploreReconnect";
import { useAuthStore } from "@/features/auth/store/auth.store";
import AppSplash from "@/shared/components/AppSplash";
import ErrorState from "@/shared/components/ErrorState";
import { View } from "react-native";
import { toastConfig } from "@/shared/components/ToastConfig";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  NunitoSans_900Black,
  useFonts,
} from "@expo-google-fonts/nunito-sans";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import NotificationRealtimeSync from "@/features/notifications/components/NotificationRealtimeSync";
import PocketPickerProvider from "@/features/pockets/providers/PocketPickerProvider";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import OfflinePocketSync from "@/features/offline-pockets/providers/OfflinePocketSync";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

import "../../global.css";

/**
 * Initializes the application's global providers, fonts, authentication
 * restoration, navigation, keyboard handling, and shared UI infrastructure.
 */
export default function RootLayout() {
  const restoration = useRestoreSession();

  const [fontsLoaded] = useFonts({
    // Native map markers snapshot their glyphs before async icon updates.
    ...MaterialCommunityIcons.font,
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
    NunitoSans_900Black,
  });

  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const offlineOwnerId = useOfflineAccessStore((state) => state.ownerId);
  const recentExplore = useOfflineAccessStore((state) => state.recentExplore);

  if (!fontsLoaded) {
    return null;
  }

  if (isLoading) {
    return <AppSplash />;
  }

  if (restoration.recoveryRequired && !isAuthenticated) {
    return (
      <View className="flex-1 bg-background">
        {/* Retry server validation without discarding saved credentials. */}
        <ErrorState
          title="Unable to restore your session"
          description="Your saved sign-in has been kept. Retry when the service is available, or continue without restoring this session."
          primaryActionTitle="Retry"
          onPrimaryAction={restoration.retry}
          secondaryActionTitle={
            offlineOwnerId || recentExplore ? "Offline guidance" : "Sign in"
          }
          onSecondaryAction={restoration.continueWithoutSession}
        />
      </View>
    );
  }

  return (
    <QueryPersistenceProvider>
      <QueryLifecycle />
      <RecentExploreReconnect />
      <NotificationRealtimeSync />
      <OfflinePocketSync />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />

        <ActionSheetProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <KeyboardProvider>
              <BottomSheetModalProvider>
                <PocketPickerProvider>
                  {/* App navigation */}
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen
                      name="index"
                      options={{ animation: "none" }}
                    />
                    <Stack.Screen
                      name="offline-routes"
                      options={{
                        headerShown: true,
                        ...defaultStackScreenOptions,
                        ...slideFromRight,
                      }}
                    />
                    <Stack.Screen
                      name="offline-storage"
                      options={{
                        headerShown: true,
                        ...defaultStackScreenOptions,
                        ...slideFromRight,
                      }}
                    />
                    <Stack.Screen
                      name="offline-pockets"
                      options={{
                        headerShown: true,
                        ...defaultStackScreenOptions,
                        ...slideFromRight,
                      }}
                    />
                    <Stack.Screen
                      name="offline-business/[businessId]"
                      options={{
                        headerShown: false,
                        ...defaultStackScreenOptions,
                        ...slideFromRight,
                      }}
                    />

                    <Stack.Screen
                      name="(auth)"
                      options={{ animation: "none" }}
                    />

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

                    <Stack.Screen
                      name="notifications"
                      options={{
                        headerShown: false,
                        animation: "slide_from_right",
                      }}
                    />
                  </Stack>
                </PocketPickerProvider>
              </BottomSheetModalProvider>

              {/* Logout feedback survives authentication redirects. */}
              <LogoutConfirmationModal />

              {/* Global toast notifications */}
              <Toast config={toastConfig} />
            </KeyboardProvider>
          </SafeAreaProvider>
        </ActionSheetProvider>
      </GestureHandlerRootView>
    </QueryPersistenceProvider>
  );
}
