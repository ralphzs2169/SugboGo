import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useImagePicker } from "@/features/profile/hooks/useImagePicker";
import AppText from "@/shared/components/AppText";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { ClusterIcon } from "@/shared/types/cluster.types";
import Avatar from "@/shared/components/Avatar";

import type { CoverPhotoUpdateAllowance } from "../../types/merchantBusinessProfile.types";

type MerchantProfileHeaderProps = {
  businessName: string;
  classification: string;
  clusterIcon?: ClusterIcon;
  status: "active" | "suspended";
  coverPhotoUrl?: string | null;
  onEditCover: (imageUri: string) => void;
  isUploading?: boolean;
  coverPhotoUpdate: CoverPhotoUpdateAllowance;
  onCheckCoverAllowance: () => Promise<CoverPhotoUpdateAllowance | null>;
  avatarUrl?: string | null;
  avatarKey?: string | null;
};

/**
 * Displays the merchant's cover and live business identity in a compact
 * overlapping hero. Preserves gallery/camera selection,
 * cover-update allowance, confirmation, and uploading states.
 */
export default function MerchantProfileHeader({
  businessName,
  classification,
  clusterIcon,
  status,
  coverPhotoUrl,
  onEditCover,
  isUploading = false,
  coverPhotoUpdate,
  onCheckCoverAllowance,
  avatarUrl,
  avatarKey,
}: MerchantProfileHeaderProps) {
  const { pickFromGallery, takePhoto } = useImagePicker();
  const [isImageLoading, setIsImageLoading] = useState(Boolean(coverPhotoUrl));
  const [pendingCoverUri, setPendingCoverUri] = useState<string | null>(null);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [checkedAllowance, setCheckedAllowance] =
    useState<CoverPhotoUpdateAllowance | null>(null);

  const isCoverActionDisabled = isUploading || isCheckingAllowance;
  const canEditCover = status === "active";

  async function handlePickCover(source: "gallery" | "camera") {
    if (isCoverActionDisabled || !canEditCover) return;
    setIsCheckingAllowance(true);

    try {
      const allowance = await onCheckCoverAllowance();
      if (!allowance) return;

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

      if (source === "gallery") {
        await handleChooseCoverPhoto();
      } else {
        await handleTakeCoverPhoto();
      }
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

  async function handleChooseCoverPhoto() {
    try {
      const imageUri = await pickFromGallery();
      if (imageUri) handleCoverSelected(imageUri);
    } catch {
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
      if (imageUri) handleCoverSelected(imageUri);
    } catch {
      Toast.show({
        type: "error",
        text1: "Image Error",
        text2: "Unable to capture this image. Please try again.",
      });
    }
  }

  function handleCancelCoverUpdate() {
    setPendingCoverUri(null);
    setIsConfirmVisible(false);
  }

  function handleConfirmCoverUpdate() {
    if (!pendingCoverUri) return;
    setIsConfirmVisible(false);
    onEditCover(pendingCoverUri);
    setPendingCoverUri(null);
  }

  return (
    <View className="bg-surface">
      {/* Cover photo and editing action */}
      <View
        testID="merchant-cover-hero"
        className="relative h-56 w-full overflow-hidden bg-surface-secondary"
      >
        {coverPhotoUrl ? (
          <Image
            source={{ uri: coverPhotoUrl }}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
            onLoadStart={() => setIsImageLoading(true)}
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
            accessibilityLabel={`${businessName} cover photo`}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <MaterialCommunityIcons
              name="image-outline"
              size={44}
              color={theme.extends.colors.text.tertiary}
            />
            <AppText className="mt-2 text-sm text-text-secondary">
              No cover photo
            </AppText>
          </View>
        )}

        {isImageLoading && coverPhotoUrl ? (
          <View className="absolute inset-0 items-center justify-center bg-surface-secondary">
            <ActivityIndicator color={theme.extends.colors.brand} />
          </View>
        ) : null}

        {canEditCover ? (
          <View className="absolute right-4 top-4 flex-row items-center gap-2">
            {/* Gallery cover selection */}
            <Pressable
              onPress={() => void handlePickCover("gallery")}
              disabled={isCoverActionDisabled}
              accessibilityRole="button"
              accessibilityLabel="Choose business cover photo from gallery"
              accessibilityState={{ disabled: isCoverActionDisabled }}
              className="h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/65 active:opacity-80 disabled:opacity-60"
            >
              {isCheckingAllowance ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons
                  name="image-multiple-outline"
                  size={20}
                  color="#FFFFFF"
                />
              )}
            </Pressable>

            {/* Camera cover selection */}
            <Pressable
              onPress={() => void handlePickCover("camera")}
              disabled={isCoverActionDisabled}
              accessibilityRole="button"
              accessibilityLabel="Take business cover photo"
              accessibilityState={{ disabled: isCoverActionDisabled }}
              className="h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/65 active:opacity-80 disabled:opacity-60"
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        ) : null}

        {isUploading ? (
          <View className="absolute inset-0 items-center justify-center bg-black/55">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <AppText weight="semibold" className="mt-2 text-sm text-white">
              Updating cover photo...
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Business identity overlapping the cover */}
      <View className="-mt-7 rounded-t-[28px] bg-surface px-5 pb-3">
        <View className="flex-row items-end gap-3">
          {/* Merchant avatar overlapping the business cover */}
          <View className="-mt-9 h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-background">
            {avatarUrl || avatarKey ? (
              <Avatar imageUrl={avatarUrl} avatarKey={avatarKey} size={72} />
            ) : (
              <MaterialCommunityIcons
                name="storefront-outline"
                size={34}
                color={theme.extends.colors.text.secondary}
              />
            )}
          </View>
        </View>

        {/* Business name and status */}
        <View className="mt-2 flex-row items-start gap-3">
          <AppText
            weight="superbold"
            className="min-w-0 flex-1 text-xl leading-7 text-text-primary"
            numberOfLines={2}
          >
            {businessName}
          </AppText>

          {/* Business status badge */}
          <View
            className={`mt-1 shrink-0 flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
              status === "active" ? "bg-success" : "bg-text-error"
            }`}
          >
            <MaterialCommunityIcons
              name={status === "active" ? "check-circle" : "alert-circle"}
              size={14}
              color="#FFFFFF"
            />

            <AppText weight="semibold" className="text-xs text-white">
              {status === "active" ? "Active" : "Suspended"}
            </AppText>
          </View>
        </View>

        <View className="mt-1.5 flex-row items-center gap-2">
          {clusterIcon ? (
            <MaterialCommunityIcons
              name={CLUSTER_ICONS[clusterIcon]}
              size={17}
              color={theme.extends.colors.text.secondary}
            />
          ) : null}
          <AppText
            className="min-w-0 flex-1 text-sm text-text-secondary"
            numberOfLines={2}
          >
            {classification}
          </AppText>
        </View>
      </View>

      {/* Cover update confirmation */}
      <ConfirmModal
        visible={isConfirmVisible}
        title="Update cover photo?"
        message={
          <View>
            {pendingCoverUri ? (
              <Image
                source={{ uri: pendingCoverUri }}
                contentFit="cover"
                style={{
                  width: "100%",
                  height: 144,
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              />
            ) : null}
            <AppText className="text-sm leading-5 text-text-secondary">
              Choose a clear photo that represents your business.
            </AppText>
            <AppText
              weight="semibold"
              className="mt-3 text-sm text-text-primary"
            >
              {checkedAllowance?.remaining ?? coverPhotoUpdate.remaining} cover
              photo update
              {(checkedAllowance?.remaining ?? coverPhotoUpdate.remaining) === 1
                ? ""
                : "s"}{" "}
              remaining.
            </AppText>
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
