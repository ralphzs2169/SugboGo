import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNetInfo } from "@react-native-community/netinfo";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import useSavedJourneys from "@/features/offline-routes/hooks/useSavedJourneys";
import MerchantContentSection from "@/features/merchant/layout/MerchantContentSection";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";

import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import useOfflineStorageSummary from "../hooks/useOfflineStorageSummary";
import {
  clearOfflineBusinessData,
  cleanupOfflinePocketCoverFiles,
  currentOfflineBusinessOwner,
} from "../services/offlinePockets.service";
import { retryOfflineBusinessDownloads } from "../services/offlineStorageActions.service";
import type { OfflinePocketReadContext } from "../types/offlinePockets.types";
import InfoBanner from "@/shared/components/InfoBanner";

type StorageIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

type StorageLinkProps = {
  icon: StorageIcon;
  title: string;
  description?: string;
  loading?: boolean;
  onPress: () => void;
  divided?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
};

// Shared navigation and management row
function StorageLink({
  icon,
  title,
  description,
  loading = false,
  onPress,
  divided = false,
  destructive = false,
  disabled = false,
  showChevron = true,
}: StorageLinkProps) {
  const iconColor = destructive
    ? theme.extends.colors.error
    : theme.extends.colors.text.secondary;

  return (
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 flex-row items-center gap-3 py-3.5 ${
        divided ? "border-t border-border-primary/60" : ""
      } ${disabled ? "opacity-50" : "active:opacity-70"}`}
    >
      <View
        className={`h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          destructive ? "bg-red-50" : "bg-surface-muted"
        }`}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={iconColor}
          accessible={false}
        />
      </View>

      <View className="min-w-0 flex-1 gap-0.5">
        <AppText
          weight="semibold"
          className={`text-sm leading-5 ${
            destructive ? "text-text-error" : "text-text-primary"
          }`}
        >
          {title}
        </AppText>

        {loading ? (
          <Skeleton className="h-3 w-2/3 rounded-md" />
        ) : description ? (
          <AppText className="text-xs leading-5 text-text-secondary">
            {description}
          </AppText>
        ) : null}
      </View>

      {showChevron && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={21}
          color={theme.extends.colors.text.tertiary}
          accessible={false}
        />
      )}
    </SafePressable>
  );
}

// Format estimated local storage size
function storageSize(bytes: number): string {
  if (bytes === 0) return "0 KB";

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Offline availability indicator
function OfflineAvailabilityStatus() {
  return (
    <View className="flex-row items-center gap-2 border-b border-border-primary/60 bg-surface px-5 py-4">
      <MaterialCommunityIcons
        name="check-circle-outline"
        size={17}
        color={theme.extends.colors.border.success}
        accessible={false}
      />

      <AppText className="min-w-0 flex-1 text-xs leading-5 text-text-secondary">
        Your downloads are available offline
      </AppText>
    </View>
  );
}

// Label and value within storage details
function StorageDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <AppText className="text-sm leading-5 text-text-secondary">
        {label}
      </AppText>

      <AppText
        weight="semibold"
        className="shrink text-right text-sm leading-5 text-text-primary"
      >
        {value}
      </AppText>
    </View>
  );
}

export default function OfflineStorageScreen() {
  const recentExplore = useOfflineAccessStore((state) => state.recentExplore);

  const saved = useOfflineStorageSummary();
  const journeys = useSavedJourneys();

  const authenticated = useAuthStore((state) => state.isAuthenticated);

  const generation = getAuthSessionGeneration();
  const network = useNetInfo();

  const online =
    network.isConnected === true && network.isInternetReachable !== false;

  const canDownload = authenticated && online && saved.ownerId !== null;

  const [selection, setSelection] = useState<OfflinePocketReadContext | null>(
    null,
  );

  const [busy, setBusy] = useState<{
    generation: number;
    kind: string;
  } | null>(null);

  const pending = useRef<number | null>(null);

  const [notice, setNotice] = useState<{
    generation: number;
    message: string;
    cleared?: boolean;
    cleanupPending?: boolean;
  } | null>(null);

  const currentNotice = notice?.generation === generation ? notice : null;

  const isBusy = busy?.generation === generation;
  const data = saved.data;

  const [now, setNow] = useState(() => Date.now());

  // Update retry availability when the next retry becomes due
  useEffect(() => {
    const future =
      data?.retries.map((row) => row.retryAt).filter((at) => at > now) ?? [];

    if (!future.length) return;

    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2_147_483_647, Math.max(0, Math.min(...future) - Date.now())),
    );

    return () => clearTimeout(timer);
  }, [data?.retries, now]);

  const due =
    data?.retries
      .filter((row) => row.retryAt <= now)
      .map((row) => row.operation) ?? [];

  const ready = saved.ownerId !== null && !!data && !saved.isError;

  const journeysMatchOwner = journeys.ownerId === saved.ownerId;
  // Keep existing items visible on same-owner refreshes.
  // The current journey hook does not distinguish a loaded empty list from its first read.
  const journeyCount =
    journeysMatchOwner &&
    !journeys.error &&
    (!journeys.isLoading || journeys.items.length > 0)
      ? journeys.items.filter((item) => !!item.snapshot).length
      : null;
  const journeyInitialLoading =
    journeysMatchOwner && journeys.isLoading && journeys.items.length === 0;

  const hasDownloadedContent =
    (ready && data.businessCount > 0) ||
    (journeyCount !== null && journeyCount > 0);

  // Ensure asynchronous results still belong to the active session
  function current(context: OfflinePocketReadContext) {
    return (
      isAuthSessionGenerationCurrent(context.sessionGeneration) &&
      (currentOfflineBusinessOwner() === context.ownerId ||
        currentOfflineBusinessOwner() === null)
    );
  }

  // Preserve existing clearing, retry, and cleanup operations
  async function perform(kind: "clear" | "retry" | "cleanup") {
    const context = kind === "clear" ? selection : data?.context;

    if (
      !context ||
      context.sessionGeneration !== generation ||
      context.ownerId !== saved.ownerId ||
      pending.current === generation
    ) {
      return;
    }

    pending.current = generation;

    setBusy({ generation, kind });
    setNotice(null);

    try {
      if (kind === "clear") {
        const result = await clearOfflineBusinessData(context);

        if (!current(context)) return;

        setSelection(null);

        setNotice({
          generation,
          message: result.cleanupPending
            ? "Business information was cleared, but some photos still need to be removed."
            : "Business information removed from this device.",
          cleared: true,
          cleanupPending: result.cleanupPending,
        });

        Toast.show({
          type: result.cleanupPending ? "info" : "success",
          text1: result.cleanupPending
            ? "Photo cleanup pending"
            : "Offline business data cleared",
          text2: result.cleanupPending
            ? "Some downloaded photos still need to be removed."
            : "My Pockets and saved journeys are unchanged.",
        });
      } else if (kind === "retry") {
        const queued = await retryOfflineBusinessDownloads(due);

        if (current(context)) {
          Toast.show({
            type: "success",
            text1: queued
              ? "Downloads requested"
              : "No downloads ready to retry",
            text2: queued
              ? "You can keep using SugboGo while they're prepared."
              : "Your available businesses are still ready to browse.",
          });
        }
      } else {
        await cleanupOfflinePocketCoverFiles(context);
      }

      if (current(context) && currentOfflineBusinessOwner() !== null) {
        await saved.refetch();
      }
    } catch {
      if (current(context)) {
        setNotice({
          generation,
          message:
            kind === "clear"
              ? "Unable to clear business data. Please try again."
              : kind === "cleanup"
                ? "Some photos couldn't be removed. Please try again."
                : "Unable to retry downloads. Check your connection and try again.",
        });
      }
    } finally {
      if (pending.current === context.sessionGeneration) {
        pending.current = null;
      }

      setBusy((previous) =>
        previous?.generation === context.sessionGeneration ? null : previous,
      );
    }
  }

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-background"
    >
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Offline Storage",
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        {recentExplore && !authenticated && (
          <View className="bg-surface px-5">
            <StorageLink
              icon="storefront-outline"
              title="Recent Explore"
              description="Browse previously loaded places. Read-only and temporary."
              onPress={() => router.push("/recent-explore")}
            />
          </View>
        )}

        {Platform.OS === "web" ? (
          <View className="bg-surface px-5 py-5">
            <ErrorState
              size="section"
              icon="cellphone"
              title="Available in the mobile app"
              description="Manage offline businesses and journeys on Android or iOS."
            />
          </View>
        ) : saved.ownerId === null ? (
          <MerchantContentSection
            title={
              currentNotice?.cleared
                ? "No businesses available offline"
                : "Sign in to access Offline Storage"
            }
            description={
              currentNotice?.cleared
                ? "Sign in online to choose businesses to download again."
                : "Sign in online to prepare businesses and journeys for this device."
            }
            flushTop
          >
            <Button
              title="Sign in"
              onPress={() => router.push("/(auth)/login")}
            />
          </MerchantContentSection>
        ) : (
          <>
            {/* Offline availability */}
            {hasDownloadedContent && <OfflineAvailabilityStatus />}

            {/* Downloaded content */}
            <MerchantContentSection title="Downloaded content" flushTop>
              <View>
                <StorageLink
                  icon="storefront-outline"
                  title="Saved businesses"
                  loading={saved.isPending && !saved.isError}
                  description={
                    ready
                      ? `${data.businessCount} ${
                          data.businessCount === 1 ? "business" : "businesses"
                        } downloaded`
                      : "View businesses stored on this device."
                  }
                  onPress={() => router.push("/offline-pockets")}
                />

                <StorageLink
                  icon="bus"
                  title="Saved journeys"
                  loading={journeyInitialLoading}
                  description={
                    journeyCount === null
                      ? "View saved jeepney guidance."
                      : `${journeyCount} ${
                          journeyCount === 1 ? "journey" : "journeys"
                        } available offline`
                  }
                  onPress={() => router.push("/offline-routes")}
                  divided
                />

                <StorageLink
                  icon="download-outline"
                  title="Manage offline downloads"
                  description="Choose businesses from My Pockets to download."
                  onPress={() => router.push("/(explorer)/profile/my-pockets")}
                  disabled={!authenticated || isBusy}
                  divided
                />
              </View>

              {!canDownload && (
                <AppText className="mt-2 text-xs leading-5 text-text-secondary">
                  {authenticated
                    ? "Connect to the internet to download businesses."
                    : "Sign in online to download businesses."}
                </AppText>
              )}

              {saved.isError && (
                <View className="mt-4">
                  <ErrorState
                    size="section"
                    icon="database-alert-outline"
                    title="Unable to read business storage"
                    description="Your device storage couldn't be read. Try this section again."
                    primaryActionTitle="Retry business storage"
                    onPrimaryAction={() => void saved.refetch()}
                  />
                </View>
              )}

              {journeys.error && (
                <View className="mt-4">
                  <ErrorState
                    size="section"
                    title="Unable to read saved journeys"
                    description="Business storage is still available."
                    primaryActionTitle="Retry journeys"
                    onPrimaryAction={() => void journeys.reload()}
                  />
                </View>
              )}

              {/* Download retries */}
              {ready && due.length > 0 && (
                <View className="mt-4 gap-3 border-t border-border-primary/60 pt-4">
                  <InfoBanner
                    variant="warning"
                    icon="cloud-alert-outline"
                    title="Some downloads need attention"
                  >
                    <AppText className="text-sm leading-5 text-text-secondary">
                      Some business downloads need another try. Your existing
                      offline content is still available.
                    </AppText>
                  </InfoBanner>

                  <Button
                    title="Retry downloads"
                    variant="outline"
                    rounded="full"
                    disabled={!canDownload || isBusy}
                    loading={isBusy && busy?.kind === "retry"}
                    onPress={() => void perform("retry")}
                  />
                </View>
              )}
            </MerchantContentSection>

            {/* Storage details */}
            <MerchantContentSection title="Storage details">
              {saved.isPending ? (
                <View className="gap-4">
                  <View className="flex-row items-center justify-between gap-4">
                    <AppText className="text-sm text-text-secondary">
                      Business storage used
                    </AppText>
                    <Skeleton className="h-3.5 w-20 rounded-md" />
                  </View>
                  <View className="flex-row items-center justify-between gap-4">
                    <AppText className="text-sm text-text-secondary">
                      Last updated
                    </AppText>
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                  </View>
                </View>
              ) : ready ? (
                <View className="gap-4">
                  <StorageDetailRow
                    label="Business storage used"
                    value={
                      data.storageBytes === null
                        ? "Size unavailable"
                        : `About ${storageSize(data.storageBytes)}`
                    }
                  />

                  <StorageDetailRow
                    label="Last updated"
                    value={
                      data.lastUpdated === null
                        ? "Not yet downloaded"
                        : new Date(data.lastUpdated).toLocaleDateString()
                    }
                  />

                  <AppText className="text-xs leading-5 text-text-tertiary">
                    Storage size includes estimated downloaded business
                    information and photos. Saved journeys are stored
                    separately.
                  </AppText>
                </View>
              ) : (
                <AppText className="text-sm leading-5 text-text-secondary">
                  Storage details are currently unavailable.
                </AppText>
              )}
            </MerchantContentSection>

            {/* Storage management */}
            {(data?.hasBusinessData ||
              data?.cleanupPending ||
              currentNotice?.cleanupPending) && (
              <MerchantContentSection title="Manage storage">
                {(data?.cleanupPending || currentNotice?.cleanupPending) && (
                  <View className="mb-4 gap-3">
                    <AppText className="text-sm leading-5 text-text-secondary">
                      Some photos are still being removed.
                    </AppText>

                    <Button
                      title="Finish removing photos"
                      variant="outline"
                      rounded="full"
                      disabled={!ready || isBusy}
                      loading={isBusy && busy?.kind === "cleanup"}
                      onPress={() => void perform("cleanup")}
                    />
                  </View>
                )}

                {ready && data.hasBusinessData && (
                  <StorageLink
                    icon="trash-can-outline"
                    title="Clear business downloads"
                    description="Saved journeys and My Pockets won't be deleted."
                    destructive
                    disabled={isBusy}
                    onPress={() => {
                      setNotice(null);
                      setSelection(data.context);
                    }}
                  />
                )}
              </MerchantContentSection>
            )}
          </>
        )}

        {/* Operation feedback */}
        {currentNotice && !selection && (
          <View className="mt-2 bg-surface px-5 py-4">
            <AppText
              accessibilityRole={currentNotice.cleared ? "text" : "alert"}
              className={`text-sm leading-5 ${
                currentNotice.cleared
                  ? "text-text-secondary"
                  : "text-text-error"
              }`}
            >
              {currentNotice.message}
            </AppText>
          </View>
        )}

        {currentNotice?.cleanupPending && saved.ownerId === null && (
          <InfoBanner
            variant="warning"
            icon="image-off-outline"
            title="Photo cleanup incomplete"
          >
            <AppText className="text-sm leading-5 text-text-secondary">
              Some downloaded photos still need to be removed from this device.
            </AppText>
          </InfoBanner>
        )}
      </ScrollView>

      {/* Clear confirmation */}
      <ConfirmModal
        visible={
          !!selection &&
          selection.ownerId === saved.ownerId &&
          selection.sessionGeneration === generation &&
          (selection.clearGeneration === data?.context.clearGeneration ||
            (isBusy && busy?.kind === "clear"))
        }
        title="Clear offline business data?"
        message={
          <View className="gap-3">
            <AppText className="text-sm leading-6 text-text-secondary">
              Downloaded business information and photos will be removed from
              this device. Businesses stay saved in My Pockets. Saved journeys
              are unaffected. You can download businesses again later.
            </AppText>

            {currentNotice && !currentNotice.cleared && (
              <AppText
                accessibilityRole="alert"
                className="text-sm text-text-error"
              >
                {currentNotice.message}
              </AppText>
            )}
          </View>
        }
        confirmText="Clear offline data"
        destructive
        isLoading={isBusy && busy?.kind === "clear"}
        onCancel={() => {
          if (!isBusy) setSelection(null);
        }}
        onConfirm={() => void perform("clear")}
      />
    </SafeAreaView>
  );
}
