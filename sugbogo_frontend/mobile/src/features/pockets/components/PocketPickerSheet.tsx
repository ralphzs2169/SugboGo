import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import useBusinessPocketMemberships from "../hooks/useBusinessPocketMemberships";
import usePocketCollections from "../hooks/usePocketCollections";
import useReplacePocketMemberships from "../hooks/useReplacePocketMemberships";
import type { PocketCollection } from "../types/pockets.types";
import PocketNameForm from "./PocketNameForm";

type Props = {
  businessId: number;
  ownerId: number;
  generation: number;
  onDismiss: () => void;
};

/** Edits a complete local selection while paginating only the visible collection choices. */
export default function PocketPickerSheet({
  businessId,
  ownerId,
  generation,
  onDismiss,
}: Props) {
  const ref = useRef<BottomSheetModal | null>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const paging = useRef(false);
  const armed = useRef(false);
  const creationBusy = useRef(false);
  const [creating, setCreating] = useState(false);
  const [creationPending, setCreationPending] = useState(false);
  const [createdCollections, setCreatedCollections] = useState<
    PocketCollection[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [draftEdits, setDraftEdits] = useState<number[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const collections = usePocketCollections();
  const memberships = useBusinessPocketMemberships(businessId);
  const mutation = useReplacePocketMemberships(businessId);
  const insets = useSafeAreaInsets();
  const active =
    memberships.isEnabled &&
    memberships.userId === ownerId &&
    getAuthSessionGeneration() === generation;
  const draft =
    draftEdits ??
    (active && !memberships.isFetching && !memberships.error
      ? (memberships.memberships?.pocket_ids ?? null)
      : null);
  const canSave =
    active &&
    collections.hasData &&
    draft !== null &&
    !memberships.isFetching &&
    !memberships.error &&
    !mutation.isPending;

  useEffect(() => {
    mounted.current = true;
    presentBottomSheet(ref);
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!submitting.current && !creationBusy.current) {
        if (creating) setCreating(false);
        else ref.current?.dismiss();
      }
      return true;
    });
    return () => listener.remove();
  }, [isOpen, creating]);
  useQueryErrorNotification({
    error: active ? (memberships.error ?? collections.error) : null,
    toastId: "pocket-picker-error",
    title: "Unable to load your Pockets",
    fallbackMessage: "Please try again.",
  });

  function currentSession() {
    const session = useAuthStore.getState();
    return (
      mounted.current &&
      session.isAuthenticated &&
      !session.isLoading &&
      session.user?.id === ownerId &&
      getAuthSessionGeneration() === generation
    );
  }
  function dismiss() {
    if (!submitting.current) ref.current?.dismiss();
  }
  function toggle(id: number) {
    if (!active || submitting.current || draft === null) return;
    setSaveError(null);
    const selection = draft;
    setDraftEdits((current) => {
      const ids = current ?? selection;
      return ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id];
    });
  }
  async function save() {
    if (!canSave || submitting.current || draft === null || !currentSession())
      return;
    submitting.current = true;
    setSaveError(null);
    try {
      await mutation.replaceMemberships(
        [...new Set(draft)].sort((a, b) => a - b),
      );
      if (!currentSession()) return;
      Toast.show({
        type: "info",
        text1: "Pocket selection updated",
        visibilityTime: 1500,
      });
      ref.current?.dismiss();
    } catch (error) {
      if (!currentSession()) return;
      const response = error as Partial<ApiError>;
      setSaveError(
        response?.message ||
          "Your changes could not be saved. Please try again.",
      );
      if (
        response?.success === false &&
        !handleSystemError(response as ApiError)
      ) {
        Toast.show({
          type: "error",
          text1: "Unable to update Pockets",
          text2: response.message,
        });
      }
    } finally {
      submitting.current = false;
    }
  }
  function loadMore(explicit = false) {
    if (
      !active ||
      paging.current ||
      submitting.current ||
      collections.isFetching ||
      !collections.hasNextPage ||
      (!explicit && (!armed.current || collections.isFetchNextPageError))
    )
      return;
    paging.current = true;
    armed.current = false;
    void collections.fetchNextPage().finally(() => {
      paging.current = false;
    });
  }

  const readError =
    memberships.error || (!collections.hasData && collections.error);
  const ready = active && draft !== null && collections.hasData;
  // POST results remain selectable even when their list page has not been loaded.
  const choices = [
    ...collections.collections,
    ...createdCollections.filter(
      (created) =>
        !collections.collections.some((item) => item.id === created.id),
    ),
  ];
  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["70%", "90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!mutation.isPending && !creationPending}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(index) => setIsOpen(index >= 0)}
      onDismiss={onDismiss}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.background,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.tertiary,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior={
            mutation.isPending || creationPending ? "none" : "close"
          }
        />
      )}
    >
      <View className="flex-1">
        {creating ? (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 32),
            }}
          >
            <PocketNameForm
              InputComponent={BottomSheetTextInput}
              onBusyChange={(busy) => {
                creationBusy.current = busy;
                if (mounted.current) setCreationPending(busy);
              }}
              onCancel={() => setCreating(false)}
              onSuccess={(collection) => {
                if (!currentSession()) return;
                setCreatedCollections((current) => [...current, collection]);
                setDraftEdits((current) => [
                  ...new Set([...(current ?? []), collection.id]),
                ]);
                setCreating(false);
              }}
            />
          </BottomSheetScrollView>
        ) : (
          <>
            {/* Selection identity */}
            <View className="px-5 pb-3">
              <AppText weight="bold" className="text-lg text-text-primary">
                Save to My Pockets
              </AppText>
              <AppText className="mt-1 text-body text-text-secondary">
                Choose one or more collections for this business.
              </AppText>
            </View>
            {/* Paginated collection choices; the draft retains off-page memberships */}
            <BottomSheetFlatList
              testID="pocket-picker-list"
              data={ready ? choices : []}
              keyExtractor={(collection) => String(collection.id)}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 16,
                flexGrow: 1,
              }}
              ListHeaderComponent={
                <View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create Pocket"
                    accessibilityState={{ disabled: !canSave }}
                    className="mb-4 min-h-16 cursor-pointer flex-row items-center gap-3 rounded-card border border-dashed border-border-primary bg-surface p-4 active:opacity-80"
                    disabled={!canSave}
                    onPress={() => {
                      if (!canSave || submitting.current || !currentSession())
                        return;
                      setDraftEdits(draft);
                      setCreating(true);
                    }}
                  >
                    <View
                      className="h-10 w-10 items-center justify-center rounded-card bg-brand/10"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={24}
                        color={theme.extends.colors.brand}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <AppText
                        weight="semibold"
                        className="text-body text-text-primary"
                      >
                        Create Pocket
                      </AppText>
                      <AppText className="mt-1 text-small text-text-secondary">
                        Start a new collection
                      </AppText>
                    </View>
                  </Pressable>
                  {memberships.error && draft !== null ? (
                    <ErrorState
                      size="section"
                      title="Unable to refresh your selection"
                      description="Retry before saving your changes."
                      primaryActionTitle="Retry selection"
                      onPrimaryAction={() => {
                        void memberships.refetch();
                      }}
                    />
                  ) : null}
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.name}
                  accessibilityValue={{
                    text: `${item.business_count} available ${item.business_count === 1 ? "business" : "businesses"}`,
                  }}
                  accessibilityState={{
                    checked: draft?.includes(item.id) ?? false,
                    disabled: mutation.isPending,
                  }}
                  disabled={mutation.isPending}
                  className={`mb-2 min-h-16 cursor-pointer flex-row items-center gap-3 rounded-card border bg-surface p-4 active:opacity-80 ${draft?.includes(item.id) ? "border-brand" : "border-border-primary"}`}
                  onPress={() => toggle(item.id)}
                >
                  <View
                    className="h-10 w-10 items-center justify-center rounded-card bg-brand/10"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <MaterialCommunityIcons
                      name={
                        item.is_default ? "heart-outline" : "folder-outline"
                      }
                      size={22}
                      color={theme.extends.colors.brand}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <AppText
                      weight="semibold"
                      className="text-body text-text-primary"
                    >
                      {item.name}
                    </AppText>
                    <View className="mt-1 flex-row flex-wrap gap-2">
                      <AppText className="text-small text-text-secondary">
                        {item.business_count}{" "}
                        {item.business_count === 1 ? "business" : "businesses"}
                      </AppText>
                      {item.is_default && (
                        <AppText className="text-small text-text-secondary">
                          · Default
                        </AppText>
                      )}
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name={
                      draft?.includes(item.id)
                        ? "checkbox-marked"
                        : "checkbox-blank-outline"
                    }
                    size={26}
                    color={
                      draft?.includes(item.id)
                        ? theme.extends.colors.brand
                        : theme.extends.colors.text.secondary
                    }
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </Pressable>
              )}
              ListEmptyComponent={
                readError ? (
                  <ErrorState
                    size="section"
                    title="Unable to load your Pockets"
                    description="Try again before changing your selection."
                    primaryActionTitle="Retry"
                    onPrimaryAction={() => {
                      if (memberships.error) void memberships.refetch();
                      if (collections.error) void collections.refetch();
                    }}
                  />
                ) : !ready ? (
                  <View
                    testID="pocket-picker-loading"
                    accessibilityLabel="Loading Pocket selection"
                    accessibilityState={{ busy: true }}
                    className="gap-3 py-3"
                  >
                    {[0, 1, 2].map((id) => (
                      <Skeleton key={id} className="h-14 rounded-card" />
                    ))}
                  </View>
                ) : (
                  <AppText className="py-6 text-center text-body text-text-secondary">
                    No Pockets available yet.
                  </AppText>
                )
              }
              ListFooterComponent={
                ready ? (
                  collections.isFetchingNextPage ? (
                    <View
                      className="items-center py-3"
                      testID="pocket-picker-page-loading"
                    >
                      <LottieView
                        source={loadingAnimation}
                        autoPlay
                        loop
                        style={{ width: 50, height: 50 }}
                      />
                    </View>
                  ) : collections.error ? (
                    <ErrorState
                      size="section"
                      title="Unable to load more Pockets"
                      description="Your selection is still available."
                      primaryActionTitle="Retry"
                      onPrimaryAction={() =>
                        collections.isFetchNextPageError
                          ? loadMore(true)
                          : void collections.refetch()
                      }
                    />
                  ) : collections.hasNextPage ? (
                    <Button
                      title="Load more Pockets"
                      variant="outline"
                      size="sm"
                      onPress={() => loadMore(true)}
                    />
                  ) : null
                ) : null
              }
              onScrollBeginDrag={() => {
                armed.current = true;
              }}
              onEndReached={() => loadMore()}
              onEndReachedThreshold={0.35}
            />
            {/* Explicit confirmation; dismissal never writes */}
            <View
              className="border-t border-border-primary bg-surface px-5 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 32) }}
            >
              {saveError && (
                <AppText
                  accessibilityRole="alert"
                  className="mb-3 text-body text-text-error"
                >
                  {saveError}
                </AppText>
              )}
              {draft !== null && (
                <AppText
                  accessibilityLiveRegion="polite"
                  className="mb-3 text-small text-text-secondary"
                >
                  {draft.length === 0 && memberships.memberships?.is_pocketed
                    ? "Done will remove this business from all your Pockets."
                    : `${draft.length} selected`}
                </AppText>
              )}
              <View className="flex-row gap-3">
                <Button
                  title="Cancel"
                  variant="outline"
                  className="flex-1"
                  disabled={mutation.isPending}
                  onPress={dismiss}
                />
                <Button
                  title="Done"
                  className="flex-1"
                  loading={mutation.isPending}
                  disabled={!canSave}
                  onPress={() => {
                    void save();
                  }}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </BottomSheetModal>
  );
}
