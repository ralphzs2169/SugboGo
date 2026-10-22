import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import SafePressable from "@/shared/components/SafePressable";
import AppText from "@/shared/components/AppText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { shadows } from "@/shared/styles/shadows";
import { Platform, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { isAuthSessionGenerationCurrent } from "@/shared/api/authSessionGeneration.service";
import BusinessProfilePresentation from "@/features/explore/components/business-profile/BusinessProfilePresentation";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import useOfflineBusinessSnapshots from "../hooks/useOfflineBusinessSnapshots";
import { removeUnreadableOfflineBusinessSnapshot } from "../services/offlinePockets.service";
import type { OfflinePocketReadContext } from "../types/offlinePockets.types";

const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify);

/** Displays only validated device information and narrowly scoped unreadable-copy cleanup. */
export default function OfflineBusinessDetailScreen({
  businessId,
}: {
  businessId: number;
}) {
  const saved = useOfflineBusinessSnapshots(businessId);
  const openingProfile = useRef(false);
  useFocusEffect(
    useCallback(() => {
      openingProfile.current = false;
    }, []),
  );
  const insets = useSafeAreaInsets();
  const [actionHeight, setActionHeight] = useState(56);
  const online = useSyncExternalStore(subscribeOnline, () =>
    onlineManager.isOnline(),
  );
  const authenticated = useAuthStore(
    (state) => state.isAuthenticated && !state.isLoading,
  );
  const entry = saved.data?.entries[0];
  const [cleanup, setCleanup] = useState<{
    context: OfflinePocketReadContext;
    businessId: number;
  } | null>(null);
  const [isRemoving, setRemoving] = useState(false);
  const removing = useRef(false);
  async function removeCopy() {
    if (!cleanup || removing.current) return;
    const pending = cleanup;
    removing.current = true;
    setRemoving(true);
    try {
      await removeUnreadableOfflineBusinessSnapshot(
        pending.context,
        pending.businessId,
      );
      setCleanup(null);
      if (isAuthSessionGenerationCurrent(pending.context.sessionGeneration)) {
        router.dismissTo("/offline-pockets");
      }
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to remove device copy",
        text2: "Please try again.",
      });
    } finally {
      removing.current = false;
      setRemoving(false);
    }
  }
  const unreadable =
    entry?.status === "corrupt" || entry?.status === "unsupported";
  const showProfileShell =
    saved.ownerId !== null &&
    Platform.OS !== "web" &&
    (saved.isPending || (!saved.isError && entry?.status === "available"));
  return (
    <SafeAreaView
      edges={showProfileShell ? [] : ["left", "right", "bottom"]}
      className="flex-1 bg-background"
    >
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Saved business",
          headerShown: !showProfileShell,
        }}
      />
      {/* Authorization failures never retain a previous account's presentation. */}
      {saved.ownerId === null ? (
        <ErrorState
          size="small"
          icon="lock-outline"
          title="Sign in to access saved businesses"
          description="Offline access is no longer available for this session."
          primaryActionTitle="Sign in"
          onPrimaryAction={() => router.replace("/(auth)/login")}
        />
      ) : Platform.OS === "web" ? (
        <ErrorState
          size="small"
          icon="cellphone"
          title="Available in the mobile app"
          description="Saved offline businesses are available on Android and iOS."
        />
      ) : saved.isPending ? (
        <BusinessProfilePresentation
          businessId={businessId}
          distance={null}
          distanceAccuracy={null}
          previewAsExplorer
          detail={{
            source: "unavailable",
            business: null,
            snapshot: null,
            localCoverUri: undefined,
            error: null,
            denied: false,
            isInitialLoading: true,
            isLoading: true,
            isFetching: saved.isFetching,
            refetch: saved.refetch,
          }}
        />
      ) : saved.isError ? (
        <ErrorState
          size="small"
          icon="database-alert-outline"
          title="Unable to read this business"
          description="Your device storage couldn't be read. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void saved.refetch()}
        />
      ) : entry?.status === "available" ? (
        <BusinessProfilePresentation
          businessId={businessId}
          distance={null}
          distanceAccuracy={null}
          previewAsExplorer
          sourceLabel="Saved device copy"
          extraBottomPadding={online && authenticated ? actionHeight + 32 : 0}
          detail={{
            source: "offline-pocket",
            business: null,
            snapshot: entry.snapshot,
            localCoverUri: saved.data?.covers?.[businessId],
            error: null,
            denied: false,
            isInitialLoading: false,
            isLoading: false,
            isFetching: saved.isFetching,
            refetch: saved.refetch,
          }}
        />
      ) : (
        <ErrorState
          size="small"
          icon="database-alert-outline"
          title={
            entry?.status === "unsupported"
              ? "This saved format isn't supported"
              : unreadable
                ? "This device copy can't be read"
                : "Business unavailable offline"
          }
          description={
            entry?.status === "unsupported"
              ? "This copy was saved in a different format. You can remove it from this device."
              : unreadable
                ? "The saved information is damaged. You can safely remove this device copy."
                : "This business hasn't been saved on this device, or its offline copy was removed."
          }
          primaryActionTitle={
            unreadable ? "Remove device copy" : "Back to saved businesses"
          }
          onPrimaryAction={() =>
            unreadable && saved.data
              ? setCleanup({ context: saved.data.context, businessId })
              : router.dismissTo("/offline-pockets")
          }
        />
      )}
      {entry?.status === "available" &&
        saved.ownerId !== null &&
        !saved.isError &&
        !saved.isPending &&
        Platform.OS !== "web" &&
        online &&
        authenticated && (
          <View
            onLayout={({ nativeEvent }) =>
              setActionHeight(nativeEvent.layout.height)
            }
            className="absolute right-4 z-30 max-w-[90%] rounded-full bg-brand"
            style={[{ bottom: insets.bottom + 16 }, shadows.floating]}
          >
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="View current profile"
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-full px-5 py-3.5 active:opacity-80"
              onPress={() => {
                const auth = useAuthStore.getState();
                if (
                  openingProfile.current ||
                  !onlineManager.isOnline() ||
                  !auth.isAuthenticated ||
                  auth.isLoading ||
                  auth.user?.id !== saved.ownerId
                )
                  return;
                openingProfile.current = true;
                router.push({
                  pathname: "/(explorer)/business/[businessId]",
                  params: { businessId: String(businessId) },
                });
              }}
            >
              <MaterialCommunityIcons
                name="open-in-new"
                size={18}
                color="#FFFFFF"
                accessible={false}
              />
              <AppText weight="semibold" className="text-sm text-white">
                View current profile
              </AppText>
            </SafePressable>
          </View>
        )}
      <ConfirmModal
        visible={
          cleanup !== null &&
          unreadable &&
          cleanup.businessId === businessId &&
          cleanup.context.ownerId === saved.ownerId &&
          cleanup.context.sessionGeneration ===
            saved.data?.context.sessionGeneration &&
          cleanup.context.clearGeneration ===
            saved.data?.context.clearGeneration
        }
        title="Remove unreadable copy?"
        message="This removes business information from this device. Your Pockets stay saved online."
        confirmText="Remove"
        destructive
        isLoading={isRemoving}
        onConfirm={() => void removeCopy()}
        onCancel={() => {
          if (!removing.current) setCleanup(null);
        }}
      />
    </SafeAreaView>
  );
}
