import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import BusinessSpecialtyVouchCard from "@/features/explore/components/business-profile/BusinessSpecialtyVouchCard";
import useExploreBusinessProfile from "@/features/explore/hooks/useExploreBusinessProfile";
import type { ExploreBusinessSpecialtyTag } from "@/features/explore/types/exploreBusiness.types";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import type { VouchHistoryBusiness } from "../../types/vouchHistory.types";

type Props = {
  selectedBusiness: VouchHistoryBusiness;
  onToggleSpecialty: (
    tag: ExploreBusinessSpecialtyTag,
    onAccepted?: () => void,
  ) => Promise<unknown>;
  onDismiss: () => void;
};

/**
 * Manages independent specialty reactions for a screen-owned business selection.
 * Detail data survives removal of the last history entry; mutations never close the sheet.
 * Mutation ownership and pending protection stay with the screen when this sheet unmounts.
 */
export default function ManageVouchBottomSheet({
  selectedBusiness,
  onToggleSpecialty,
  onDismiss,
}: Props) {
  const sheetRef = useRef<BottomSheetModal | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const detail = useExploreBusinessProfile(selectedBusiness.business_id);
  const business = detail.business;
  const photo = business
    ? business.cover_photo_url
    : selectedBusiness.cover_photo_url;
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  useQueryErrorNotification({
    error: detail.error,
    toastId: "manage-vouch-detail-error",
    title: "Unable to load specialties",
    fallbackMessage: "Please try again.",
  });

  useEffect(() => {
    presentBottomSheet(sheetRef);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        sheetRef.current?.dismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [isOpen]);

  function toggleSpecialty(
    tag: ExploreBusinessSpecialtyTag,
    onAccepted?: () => void,
  ) {
    if (!business || business.is_own_business || detail.error) return;
    return onToggleSpecialty(tag, onAccepted);
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      onChange={(index) => setIsOpen(index >= 0)}
      onAnimate={(_fromIndex, toIndex) => {
        if (toIndex < 0) setIsOpen(false);
      }}
      onDismiss={onDismiss}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.tertiary,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}
      >
        {/* Sheet title and dismissal */}
        <View className="flex-row items-center justify-between px-5">
          <AppText weight="bold" className="text-lg text-text-primary">
            Manage Vouch
          </AppText>
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close Manage Vouch"
            className="cursor-pointer rounded-full p-3 active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Persistent selected business */}
        <View className="mt-3 flex-row items-center px-5">
          <View className="h-16 w-16 overflow-hidden rounded-xl bg-surface-muted">
            {photo?.trim() && photo !== failedPhoto ? (
              <Image
                source={{ uri: photo }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                onError={() => setFailedPhoto(photo)}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={28}
                  color={theme.extends.colors.text.tertiary}
                />
              </View>
            )}
          </View>
          <View className="min-w-0 flex-1 pl-3">
            <AppText weight="bold" className="text-md text-text-primary">
              {business?.business_name ?? selectedBusiness.business_name}
            </AppText>
            <AppText className="mt-1 text-xs text-text-secondary">
              {business?.category.name ?? selectedBusiness.category.name}
            </AppText>
          </View>
        </View>

        {/* Authoritative current reactions */}
        <View className="mt-5 px-5">
          {detail.isLoading ? (
            <View
              testID="manage-vouch-loading"
              className="flex-row justify-between"
            >
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 w-20 rounded-xl" />
              ))}
            </View>
          ) : detail.error ? (
            <ErrorState
              size="section"
              title="Unable to load specialties"
              description="Refresh the business before changing its vouches."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void detail.refetch()}
            />
          ) : business ? (
            <>
              <AppText className="mb-3 text-xs text-text-secondary">
                {business.is_own_business
                  ? "You cannot vouch for your own business."
                  : "Tap each specialty to add or remove your vouch."}
              </AppText>
              <View className="flex-row flex-wrap items-start">
                {business.specialty_tags.map((tag) => (
                  <BusinessSpecialtyVouchCard
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    icon={tag.icon}
                    vouchCount={tag.vouch_count}
                    isVouched={tag.is_vouched}
                    celebrationEnabled={isOpen}
                    disabled={business.is_own_business}
                    onPress={(onAccepted) => toggleSpecialty(tag, onAccepted)}
                  />
                ))}
              </View>
              {business.specialty_tags.length === 0 && (
                <AppText className="text-sm text-text-secondary">
                  No active specialties are available.
                </AppText>
              )}
            </>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
