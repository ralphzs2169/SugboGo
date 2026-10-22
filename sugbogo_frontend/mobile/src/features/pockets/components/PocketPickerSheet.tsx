import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onlineManager } from "@tanstack/react-query";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
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
  isCurrent?: () => boolean;
};

/** Edits a complete local selection while paginating visible collection choices. */
export default function PocketPickerSheet({
  businessId,
  ownerId,
  generation,
  onDismiss,
  isCurrent,
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
      onlineManager.isOnline() &&
      (isCurrent?.() ?? true) &&
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

  // POST results remain selectable before their list page is loaded.
  const choices = [
    ...collections.collections,
    ...createdCollections.filter(
      (created) =>
        !collections.collections.some((item) => item.id === created.id),
    ),
  ];

  const selectedCount = draft?.length ?? 0;

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
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.tertiary,
      }}
      footerComponent={
        creating
          ? undefined
          : (props) => (
              <BottomSheetFooter {...props}>
                {/* Sticky confirmation footer */}
                <View
                  className="border-t border-border-primary bg-surface px-5 pt-4"
                  style={{
                    paddingBottom: Math.max(insets.bottom, 24),
                  }}
                >
                  {saveError && (
                    <AppText
                      accessibilityRole="alert"
                      className="mb-3 text-body text-text-error"
                    >
                      {saveError}
                    </AppText>
                  )}

                  {draft !== null &&
                    draft.length === 0 &&
                    memberships.memberships?.is_pocketed && (
                      <View className="mb-3 flex-row items-center gap-2">
                        <MaterialCommunityIcons
                          name="information-outline"
                          size={17}
                          color={theme.extends.colors.text.secondary}
                        />

                        <AppText className="flex-1 text-small text-text-secondary">
                          Saving will remove this business from all your
                          Pockets.
                        </AppText>
                      </View>
                    )}

                  <View className="flex-row gap-3">
                    <Button
                      title="Cancel"
                      variant="outline"
                      rounded="full"
                      className="flex-1"
                      disabled={mutation.isPending}
                      onPress={dismiss}
                    />

                    <Button
                      title="Save changes"
                      rounded="full"
                      className="flex-1"
                      loading={mutation.isPending}
                      disabled={!canSave}
                      onPress={() => {
                        void save();
                      }}
                    />
                  </View>
                </View>
              </BottomSheetFooter>
            )
      }
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
      <View className="flex-1 bg-surface">
        {creating ? (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 32),
            }}
          >
            <PocketNameForm
              canSubmit={currentSession}
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
            {/* Header */}
            <View className="px-5 pb-5 pt-1">
              <AppText weight="bold" className="text-xl text-text-primary">
                Save to Pockets
              </AppText>

              <AppText className="mt-1 text-body text-text-secondary">
                Organize this business into your collections.
              </AppText>
            </View>

            <BottomSheetFlatList
              testID="pocket-picker-list"
              enableFooterMarginAdjustment
              data={ready ? choices : []}
              keyExtractor={(collection) => String(collection.id)}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 20,
                flexGrow: 1,
              }}
              ListHeaderComponent={
                <View>
                  {/* Create Pocket action */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create Pocket"
                    accessibilityState={{
                      disabled: !canSave,
                    }}
                    disabled={!canSave}
                    onPress={() => {
                      if (!canSave || submitting.current || !currentSession())
                        return;

                      setDraftEdits(draft);
                      setCreating(true);
                    }}
                    className="mb-6 flex-row items-center gap-3 rounded-card border border-border-primary bg-surface p-3.5 active:opacity-80"
                  >
                    <View
                      className="h-11 w-11 items-center justify-center rounded-card bg-brand/10"
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
                        Create a new Pocket
                      </AppText>

                      <AppText className="mt-0.5 text-small text-text-secondary">
                        Make a collection for your favorites
                      </AppText>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color={theme.extends.colors.text.tertiary}
                    />
                  </Pressable>

                  {/* Section heading */}
                  <View className="mb-3 flex-row items-center justify-between">
                    <AppText
                      weight="semibold"
                      className="text-small tracking-wider text-text-secondary"
                    >
                      YOUR POCKETS
                    </AppText>

                    {draft !== null && (
                      <AppText
                        accessibilityLiveRegion="polite"
                        className="text-small text-text-secondary"
                      >
                        {selectedCount} selected
                      </AppText>
                    )}
                  </View>

                  {memberships.error && draft !== null && (
                    <View className="mb-3">
                      <ErrorState
                        size="section"
                        title="Unable to refresh your selection"
                        description="Retry before saving your changes."
                        primaryActionTitle="Retry selection"
                        onPrimaryAction={() => {
                          void memberships.refetch();
                        }}
                      />
                    </View>
                  )}
                </View>
              }
              renderItem={({ item, index }) => {
                const selected = draft?.includes(item.id) ?? false;
                const isFirst = index === 0;
                const isLast = index === choices.length - 1;

                return (
                  <View
                    className={`overflow-hidden border-x border-border-primary bg-surface ${
                      isFirst ? "rounded-t-card border-t" : ""
                    } ${isLast ? "rounded-b-card border-b" : ""}`}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={item.name}
                      accessibilityValue={{
                        text: `${item.business_count} available ${
                          item.business_count === 1 ? "business" : "businesses"
                        }`,
                      }}
                      accessibilityState={{
                        checked: selected,
                        disabled: mutation.isPending,
                      }}
                      disabled={mutation.isPending}
                      onPress={() => toggle(item.id)}
                      className="min-h-16 cursor-pointer flex-row items-center gap-3 bg-surface px-3.5 py-3 active:opacity-80"
                    >
                      {/* Collection icon */}
                      <View
                        className="h-10 w-10 items-center justify-center"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <MaterialCommunityIcons
                          name={
                            item.is_default ? "heart-outline" : "folder-outline"
                          }
                          size={21}
                          color={theme.extends.colors.text.secondary}
                        />
                      </View>

                      {/* Collection information */}
                      <View className="min-w-0 flex-1">
                        <AppText
                          weight="semibold"
                          className="text-body text-text-primary"
                        >
                          {item.name}
                        </AppText>

                        <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                          <AppText className="text-small text-text-secondary">
                            {item.business_count}{" "}
                            {item.business_count === 1
                              ? "business"
                              : "businesses"}
                          </AppText>

                          {item.is_default && (
                            <>
                              <AppText className="text-small text-text-tertiary">
                                ·
                              </AppText>

                              <AppText className="text-small text-text-secondary">
                                Default
                              </AppText>
                            </>
                          )}
                        </View>
                      </View>

                      {/* Selection indicator */}
                      <MaterialCommunityIcons
                        name={
                          selected
                            ? "checkbox-marked"
                            : "checkbox-blank-outline"
                        }
                        size={25}
                        color={
                          selected
                            ? theme.extends.colors.brand
                            : theme.extends.colors.text.tertiary
                        }
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                    </Pressable>

                    {/* Divider between collection rows */}
                    {!isLast && (
                      <View className="ml-16 mr-3.5 h-px bg-border-primary" />
                    )}
                  </View>
                );
              }}
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
                    className="gap-2 py-2"
                  >
                    {[0, 1, 2].map((id) => (
                      <Skeleton key={id} className="h-16 rounded-card" />
                    ))}
                  </View>
                ) : (
                  <View className="items-center px-5 py-10">
                    <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-surface">
                      <MaterialCommunityIcons
                        name="folder-outline"
                        size={28}
                        color={theme.extends.colors.text.tertiary}
                      />
                    </View>

                    <AppText
                      weight="semibold"
                      className="text-body text-text-primary"
                    >
                      No Pockets yet
                    </AppText>

                    <AppText className="mt-1 text-center text-small text-text-secondary">
                      Create your first Pocket to organize saved businesses.
                    </AppText>
                  </View>
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
                    <View className="mt-4">
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
                    </View>
                  ) : collections.hasNextPage ? (
                    <View className="mt-4">
                      <Button
                        title="Load more Pockets"
                        rounded="full"
                        variant="outline"
                        size="sm"
                        onPress={() => loadMore(true)}
                      />
                    </View>
                  ) : null
                ) : null
              }
              onScrollBeginDrag={() => {
                armed.current = true;
              }}
              onEndReached={() => loadMore()}
              onEndReachedThreshold={0.35}
            />
          </>
        )}
      </View>
    </BottomSheetModal>
  );
}
