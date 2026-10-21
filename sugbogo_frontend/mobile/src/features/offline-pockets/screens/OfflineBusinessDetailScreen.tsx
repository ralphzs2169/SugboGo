import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { isAuthSessionGenerationCurrent } from "@/shared/api/authSessionGeneration.service";
import OfflineBusinessContent from "../components/OfflineBusinessContent";
import OfflineBusinessHeader from "../components/OfflineBusinessHeader";
import useOfflineBusinessSnapshots from "../hooks/useOfflineBusinessSnapshots";
import { removeUnreadableOfflineBusinessSnapshot } from "../services/offlinePockets.service";
import type { OfflinePocketReadContext } from "../types/offlinePockets.types";

/** Displays only validated device information and narrowly scoped unreadable-copy cleanup. */
export default function OfflineBusinessDetailScreen({
  businessId,
}: {
  businessId: number;
}) {
  const saved = useOfflineBusinessSnapshots(businessId);
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
  return (
    <SafeAreaView className="flex-1 bg-background">
      <OfflineBusinessHeader detail />
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
        <View className="gap-4 px-screen-x">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-28 rounded-card" />
        </View>
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
        <ScrollView>
          <OfflineBusinessContent snapshot={entry.snapshot} />
        </ScrollView>
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
