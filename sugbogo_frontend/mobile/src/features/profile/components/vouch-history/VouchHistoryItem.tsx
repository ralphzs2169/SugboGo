import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { shadows } from "@/shared/styles/shadows";
import { formatDate } from "@/shared/utils/date.utils";

import type { VouchHistoryBusiness } from "../../types/vouchHistory.types";

type Props = {
  business: VouchHistoryBusiness;
  onOpenBusiness: () => void;
  onManage: () => void;
};

/** Displays every current endorsement for one business and its manage action. */
export default function VouchHistoryItem({
  business,
  onOpenBusiness,
  onManage,
}: Props) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photo = business.cover_photo_url?.trim();

  return (
    <View
      className="mx-4 mb-3 rounded-card border border-border-primary bg-surface p-4"
      style={shadows.subtle}
    >
      {/* Business identity and actions */}
      <View className="flex-row items-start">
        <SafePressable
          onPress={onOpenBusiness}
          accessibilityRole="button"
          accessibilityLabel={
            "Open " + business.business_name + " business profile"
          }
          className="min-w-0 flex-1 cursor-pointer flex-row items-center active:opacity-75"
        >
          <View className="h-20 w-20 overflow-hidden rounded-xl bg-surface-muted">
            {photo && photo !== failedPhoto ? (
              <Image
                source={{ uri: photo }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={150}
                onError={() => setFailedPhoto(photo)}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={32}
                  color={theme.extends.colors.text.tertiary}
                />
              </View>
            )}
          </View>
          <View className="min-w-0 flex-1 pl-3">
            <AppText
              weight="bold"
              className="text-md text-text-primary"
              numberOfLines={2}
            >
              {business.business_name}
            </AppText>
            <AppText className="mt-1 text-xs text-text-secondary">
              {business.category.name}
            </AppText>
          </View>
        </SafePressable>
        <Pressable
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel={"Manage vouches for " + business.business_name}
          className="ml-1 cursor-pointer rounded-full p-3 active:bg-surface-muted"
          hitSlop={4}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={22}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </View>

      {/* All original endorsements */}
      <View className="mt-3 flex-row flex-wrap">
        {business.vouches.map((vouch) => (
          <SpecialtyTagChip
            key={vouch.id}
            tag={vouch.specialty}
            size="small"
            showIcon
            showVouchIndicator
            isSelected
          />
        ))}
      </View>

      {/* Latest eligible endorsement */}
      <AppText className="text-xs text-text-tertiary">
        Latest vouch: {formatDate(business.last_vouched_at)}
      </AppText>
    </View>
  );
}
