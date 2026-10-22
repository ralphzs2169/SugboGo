import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNetInfo } from "@react-native-community/netinfo";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import useSavedJourneys from "@/features/offline-routes/hooks/useSavedJourneys";
import MerchantMetricCard from "@/features/merchant/components/MerchantMetricCard";
import MerchantContentSection from "@/features/merchant/layout/MerchantContentSection";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import OfflineStorageHeader from "../components/OfflineStorageHeader";
import useOfflineStorageSummary from "../hooks/useOfflineStorageSummary";
import {
  clearOfflineBusinessData,
  cleanupOfflinePocketCoverFiles,
  currentOfflineBusinessOwner,
} from "../services/offlinePockets.service";
import { retryOfflineBusinessDownloads } from "../services/offlineStorageActions.service";
import type { OfflinePocketReadContext } from "../types/offlinePockets.types";

/** Uses Analytics' neutral icon, text and chevron treatment within a full-width section. */
function StorageLink({
  icon,
  title,
  description,
  onPress,
  divided = false,
}: {
  icon: "storefront-outline" | "bus";
  title: string;
  description: string;
  onPress: () => void;
  divided?: boolean;
}) {
  return (
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      className={`min-h-16 cursor-pointer flex-row items-center gap-3 py-3.5 active:bg-surface-muted ${divided ? "border-t border-border-primary/60" : ""}`}
    >
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
        <MaterialCommunityIcons
          name={icon}
          size={19}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText
          weight="semibold"
          className="text-sm leading-5 text-text-primary"
        >
          {title}
        </AppText>
        <AppText className="text-xs leading-5 text-text-secondary">
          {description}
        </AppText>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={theme.extends.colors.text.tertiary}
        accessible={false}
      />
    </SafePressable>
  );
}

function storageSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Manages device copies separately from cloud Pockets, retaining local browsing without internet. */
export default function OfflineStorageScreen() {
  const saved = useOfflineStorageSummary();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 340 || fontScale >= 1.5;
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
  const [busy, setBusy] = useState<{ generation: number; kind: string } | null>(
    null,
  );
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
  const journeyCount =
    journeys.ownerId === saved.ownerId && !journeys.isLoading && !journeys.error
      ? journeys.items.filter((item) => !!item.snapshot).length
      : null;
  function current(context: OfflinePocketReadContext) {
    return (
      isAuthSessionGenerationCurrent(context.sessionGeneration) &&
      (currentOfflineBusinessOwner() === context.ownerId ||
        currentOfflineBusinessOwner() === null)
    );
  }
  async function perform(kind: "clear" | "retry" | "cleanup") {
    const context = kind === "clear" ? selection : data?.context;
    if (
      !context ||
      context.sessionGeneration !== generation ||
      context.ownerId !== saved.ownerId ||
      pending.current === generation
    )
      return;
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
          message: "Business information removed from this device.",
          cleared: true,
          cleanupPending: result.cleanupPending,
        });
        Toast.show({
          type: "success",
          text1: "Offline business data cleared",
          text2: "Your Pockets and saved journeys are unchanged.",
        });
      } else if (kind === "retry") {
        const queued = await retryOfflineBusinessDownloads(due);
        if (current(context))
          Toast.show({
            type: "success",
            text1: queued
              ? "Downloads requested"
              : "No downloads ready to retry",
            text2: queued
              ? "You can keep using SugboGo while they're prepared."
              : "Your available businesses are still ready to browse.",
          });
      } else await cleanupOfflinePocketCoverFiles(context);
      if (current(context) && currentOfflineBusinessOwner() !== null)
        await saved.refetch();
    } catch {
      if (current(context))
        setNotice({
          generation,
          message:
            kind === "clear"
              ? "Unable to clear business data. Please try again."
              : kind === "cleanup"
                ? "Some photos couldn't be removed. Please try again."
                : "Unable to retry downloads. Check your connection and try again.",
        });
    } finally {
      if (pending.current === context.sessionGeneration) pending.current = null;
      setBusy((previous) =>
        previous?.generation === context.sessionGeneration ? null : previous,
      );
    }
  }
  return (
    <SafeAreaView className="flex-1 bg-background">
      <OfflineStorageHeader
        title="Offline Storage"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/(auth)/login")
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
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
            {/* Dashboard overview: muted metrics within a full-width section. */}
            <MerchantContentSection
              title="On this device"
              description="Business information and journeys ready to use without internet."
              flushTop
            >
              <View className={stacked ? "gap-3" : "flex-row gap-3"}>
                <MerchantMetricCard
                  icon="storefront-outline"
                  label="Saved businesses"
                  value={ready ? String(data.businessCount) : "—"}
                  detail="Available offline"
                  stacked={stacked}
                  loading={saved.isPending}
                  unavailable={!saved.isPending && !ready}
                />
                <MerchantMetricCard
                  icon="bus"
                  label="Saved journeys"
                  value={journeyCount === null ? "—" : String(journeyCount)}
                  detail="Available offline"
                  stacked={stacked}
                  loading={journeys.isLoading}
                  unavailable={!journeys.isLoading && journeyCount === null}
                />
              </View>
              {saved.isError ? (
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
              ) : ready ? (
                <View className="mt-4 gap-3">
                  {/* Storage estimates stay secondary to the content counts. */}
                  <View className="flex-row flex-wrap items-baseline justify-between gap-2">
                    <AppText className="text-sm text-text-secondary">
                      Business files
                    </AppText>
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      {data.storageBytes === null
                        ? "Size unavailable"
                        : "About " + storageSize(data.storageBytes)}
                    </AppText>
                  </View>
                  <View className="flex-row flex-wrap items-baseline justify-between gap-2">
                    <AppText className="text-sm text-text-secondary">
                      Last updated
                    </AppText>
                    <AppText className="shrink text-sm text-text-primary">
                      {data.lastUpdated === null
                        ? "No businesses downloaded yet"
                        : new Date(data.lastUpdated).toLocaleString()}
                    </AppText>
                  </View>
                  <AppText className="text-xs leading-5 text-text-tertiary">
                    Estimated business information and photos. Journeys are
                    stored separately.
                  </AppText>
                </View>
              ) : null}
            </MerchantContentSection>

            {/* Analytics-style destination rows share a section rather than separate cards. */}
            <MerchantContentSection title="Browse offline">
              <StorageLink
                icon="storefront-outline"
                title="Saved businesses"
                description={
                  ready
                    ? data.businessCount +
                      " available offline · View business information."
                    : "Browse business information stored on this device."
                }
                onPress={() => router.push("/offline-pockets")}
              />
              <StorageLink
                icon="bus"
                title="Saved journeys"
                description={
                  journeyCount === null
                    ? "View saved jeepney guidance."
                    : journeyCount +
                      " available offline · View jeepney guidance."
                }
                onPress={() => router.push("/offline-routes")}
                divided
              />
              {journeys.error && (
                <ErrorState
                  size="section"
                  title="Unable to read saved journeys"
                  description="Business storage is still available."
                  primaryActionTitle="Retry journeys"
                  onPrimaryAction={() => void journeys.reload()}
                />
              )}
            </MerchantContentSection>

            {/* Explicit downloads stay separate from the locally available content. */}
            {ready && (
              <MerchantContentSection
                title={
                  data.businessCount === 0
                    ? "No businesses available offline"
                    : "Download businesses"
                }
                description={
                  data.businessCount === 0
                    ? "Prepare businesses from My Pockets to use them on this device."
                    : "Choose more businesses to make available on this device."
                }
              >
                <View className="gap-4">
                  <AppText className="text-sm leading-5 text-text-secondary">
                    Select Make available offline in a business’s options.
                  </AppText>
                  <Button
                    title="View My Pockets"
                    variant={data.businessCount === 0 ? "primary" : "outline"}
                    rounded="full"
                    disabled={!canDownload}
                    onPress={() =>
                      router.push("/(explorer)/profile/my-pockets")
                    }
                  />
                  {!canDownload && (
                    <AppText className="text-xs leading-5 text-text-secondary">
                      Connect to the internet and sign in to download businesses
                      again.
                    </AppText>
                  )}
                  {due.length > 0 && (
                    <View className="gap-3 border-t border-border-primary/60 pt-4">
                      <AppText className="text-sm leading-5 text-text-secondary">
                        Some downloads need another try. Businesses already
                        available offline can still be opened.
                      </AppText>
                      <Button
                        title="Retry downloads"
                        variant="outline"
                        rounded="full"
                        disabled={!canDownload || isBusy}
                        loading={isBusy && busy.kind === "retry"}
                        onPress={() => void perform("retry")}
                      />
                    </View>
                  )}
                </View>
              </MerchantContentSection>
            )}

            {/* Quiet management section uses the same surface and spacing as analytics. */}
            {(data?.hasBusinessData ||
              data?.cleanupPending ||
              currentNotice?.cleanupPending) && (
              <MerchantContentSection
                title="Free up storage"
                description="Remove downloaded business information and photos. My Pockets and saved journeys stay unchanged."
              >
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
                      onPress={() => void perform("cleanup")}
                    />
                  </View>
                )}
                {ready && data.hasBusinessData && (
                  <SafePressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear offline business data"
                    disabled={isBusy}
                    accessibilityState={{ disabled: isBusy }}
                    onPress={() => {
                      setNotice(null);
                      setSelection(data.context);
                    }}
                    className="min-h-12 cursor-pointer flex-row items-center gap-3 py-3 active:opacity-70"
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={20}
                      color={theme.extends.colors.error}
                      accessible={false}
                    />
                    <AppText
                      weight="semibold"
                      className="min-w-0 flex-1 text-sm leading-5 text-text-error"
                    >
                      Clear offline business data
                    </AppText>
                  </SafePressable>
                )}
              </MerchantContentSection>
            )}
          </>
        )}
        {/* Operation feedback remains outside the affected section or confirmation. */}
        {currentNotice && !selection && (
          <View className="mt-2 bg-surface px-5 py-4">
            <AppText
              accessibilityRole={currentNotice.cleared ? "text" : "alert"}
              className={
                currentNotice.cleared
                  ? "text-sm leading-5 text-text-secondary"
                  : "text-sm leading-5 text-text-error"
              }
            >
              {currentNotice.message}
            </AppText>
          </View>
        )}
        {currentNotice?.cleanupPending && saved.ownerId === null && (
          <AppText className="px-5 py-4 text-sm leading-5 text-text-secondary">
            Some photos could not be removed yet. Sign in to finish removing
            them.
          </AppText>
        )}
      </ScrollView>
      {/* Clear confirmation keeps cloud memberships and journeys explicitly separate. */}
      <ConfirmModal
        visible={
          !!selection &&
          selection.ownerId === saved.ownerId &&
          selection.sessionGeneration === generation &&
          (selection.clearGeneration === data?.context.clearGeneration ||
            (isBusy && busy.kind === "clear"))
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
        isLoading={isBusy && busy.kind === "clear"}
        onCancel={() => {
          if (!isBusy) setSelection(null);
        }}
        onConfirm={() => void perform("clear")}
      />
    </SafeAreaView>
  );
}
