import { useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";

import { useImagePicker } from "@/features/profile/hooks/useImagePicker";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { CoverPhotoUpdateAllowance } from "../../types/merchantBusinessProfile.types";

import MerchantCoverPhotoBottomSheet from "./MerchantCoverPhotoBottomSheet";

type MerchantProfileHeaderProps = {
  businessName: string;
  coverPhotoUrl?: string | null;
  onEditCover: (imageUri: string) => void;
  onEditBusiness: () => void;
  isUploading?: boolean;
  coverPhotoUpdate: CoverPhotoUpdateAllowance;
  onCheckCoverAllowance: () => Promise<CoverPhotoUpdateAllowance | null>;
};

/**
 * Displays the merchant's business identity and provides controls for
 * changing the cover photo and opening business profile editing.
 *
 * The cover photo can be replaced through the gallery or device camera.
 * A confirmation is required before consuming the merchant's cover-photo
 * update allowance, while uploads display a blocking loading state.
 */
export default function MerchantProfileHeader({
  businessName,
  coverPhotoUrl,
  onEditCover,
  onEditBusiness,
  isUploading = false,
  coverPhotoUpdate,
  onCheckCoverAllowance,
}: MerchantProfileHeaderProps) {
  const { pickFromGallery, takePhoto } = useImagePicker();

  const coverPhotoSheetRef = useRef<BottomSheetModal | null>(null);

  const [isImageLoading, setIsImageLoading] = useState(Boolean(coverPhotoUrl));
  const [pendingCoverUri, setPendingCoverUri] = useState<string | null>(null);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [checkedAllowance, setCheckedAllowance] = useState<
    CoverPhotoUpdateAllowance | null
  >(null);

  const isCoverActionDisabled = isUploading || isCheckingAllowance;

  async function handlePickCover() {
    if (isCoverActionDisabled) {
      return;
    }

    setIsCheckingAllowance(true);

    try {
      const allowance = await onCheckCoverAllowance();

      if (!allowance) {
        return;
      }

      setCheckedAllowance(allowance);

      if (allowance.remaining === 0) {
        const resetText = allowance.resets_at
          ? new Date(allowance.resets_at).toLocaleString("en-US", {
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : null;

        Toast.show({
          type: "error",
          text1: "Cover photo update limit reached",
          text2: resetText
            ? `You can update your cover photo again at ${resetText}.`
            : "Please try again later.",
        });

        return;
      }

      coverPhotoSheetRef.current?.present();
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to check cover photo updates",
        text2: "Please try again.",
      });
    } finally {
      setIsCheckingAllowance(false);
    }
  }

  function handleCoverSelected(imageUri: string) {
    setPendingCoverUri(imageUri);
    setIsConfirmVisible(true);
  }

  function handleCancelCoverUpdate() {
    setPendingCoverUri(null);
    setIsConfirmVisible(false);
  }

  function handleConfirmCoverUpdate() {
    if (!pendingCoverUri) {
      return;
    }

    setIsConfirmVisible(false);
    onEditCover(pendingCoverUri);
    setPendingCoverUri(null);
  }

  async function handleChooseCoverPhoto() {
    try {
      const imageUri = await pickFromGallery();

      if (!imageUri) {
        return;
      }

      handleCoverSelected(imageUri);
    } catch (error) {
      console.error("Gallery selection failed:", error);

      Toast.show({
        type: "error",
        text1: "Image Error",
        text2: "Unable to select this image. Please try another one.",
      });
    }
  }

  async function handleTakeCoverPhoto() {
    try {
      const imageUri = await takePhoto();

      if (!imageUri) {
        return;
      }

      handleCoverSelected(imageUri);
    } catch (error) {
      console.error("Camera capture failed:", error);

      Toast.show({
        type: "error",
        text1: "Image Error",
        text2: "Unable to capture this image. Please try again.",
      });
    }
  }

  return (
    <View className="bg-surface">
      {/* Business cover photo */}
      <View className="relative h-56 w-full overflow-hidden">
        {coverPhotoUrl ? (
          <Image
            source={{ uri: coverPhotoUrl }}
            contentFit="cover"
            style={{
              width: "100%",
              height: "100%",
            }}
            onLoadStart={() => setIsImageLoading(true)}
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-surface-secondary">
            <MaterialCommunityIcons
              name="image-outline"
              size={42}
              color="#8A9691"
            />

            <Text className="mt-2 text-sm font-medium text-text-secondary">
              No cover photo
            </Text>
          </View>
        )}

        {isImageLoading && coverPhotoUrl && (
          <View className="absolute inset-0 items-center justify-center bg-surface-secondary">
            <ActivityIndicator size="small" color="#8A9691" />
          </View>
        )}

        {/* Upload loading state */}
        {isUploading && (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <ActivityIndicator size="large" color="#FFFFFF" />

            <Text className="mt-2 text-sm font-semibold text-white">
              Updating cover photo...
            </Text>
          </View>
        )}

        {/* Cover photo action */}
        <View className="absolute right-4 top-4">
          {isUploading || isCheckingAllowance ? (
            <View className="flex-row items-center rounded-full bg-black/55 px-3 py-1.5">
              <ActivityIndicator size="small" color="#FFFFFF" />

              <Text className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {isUploading ? "Updating..." : "Checking..."}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => void handlePickCover()}
              activeOpacity={0.75}
              className="cursor-pointer flex-row items-center rounded-full bg-white/90 px-3 py-1.5"
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={13}
                color="#14251F"
              />

              <Text className="ml-1 text-[10px] font-bold uppercase tracking-wide text-text-primary">
                Edit Cover
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Business identity */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text
          className="mr-3 flex-1 text-lg font-bold text-text-primary"
          numberOfLines={1}
        >
          {businessName}
        </Text>

        {/* Edit business action */}
        <TouchableOpacity
          onPress={onEditBusiness}
          activeOpacity={0.7}
          className="cursor-pointer p-1"
        >
          <MaterialCommunityIcons
            name="square-edit-outline"
            size={19}
            color="#F27A24"
          />
        </TouchableOpacity>
      </View>

      {/* Cover photo picker */}
      <MerchantCoverPhotoBottomSheet
        sheetRef={coverPhotoSheetRef}
        onChoosePhoto={handleChooseCoverPhoto}
        onTakePhoto={handleTakeCoverPhoto}
      />

      {/* Cover photo confirmation */}
      <ConfirmModal
        visible={isConfirmVisible}
        title="Update cover photo?"
        message={
          <View>
            {pendingCoverUri && (
              <Image
                source={{ uri: pendingCoverUri }}
                contentFit="cover"
                className="mb-4 h-36 w-full rounded-xl"
              />
            )}
            <Text className="text-sm leading-5 text-text-secondary">
              Choose a clear photo that represents your business.
            </Text>
            <Text className="mt-3 text-sm font-semibold text-text-primary">
              {checkedAllowance?.remaining ?? coverPhotoUpdate.remaining} cover
              photo update
              {(checkedAllowance?.remaining ?? coverPhotoUpdate.remaining) === 1
                ? ""
                : "s"}{" "}
              remaining.
            </Text>
          </View>
        }
        confirmText="Update Cover Photo"
        cancelText="Cancel"
        onCancel={handleCancelCoverUpdate}
        onConfirm={handleConfirmCoverUpdate}
      />
    </View>
  );
}
