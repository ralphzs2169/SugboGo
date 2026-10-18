import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";

type MerchantScreenHeaderProps = {
  title: string;
  actionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onActionPress?: () => void;
  rightAccessory?: ReactNode;
  subtitle?: string;
  leadingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  compact?: boolean;
  coverPhotoUrl?: string | null;
};

/**
 * Provides a consistent header for merchant tab screens.
 *
 * Displays the current screen title and an optional contextual action,
 * while keeping the header visually consistent across merchant screens.
 */
export default function MerchantScreenHeader({
  title,
  actionIcon,
  onActionPress,
  rightAccessory,
  subtitle,
  leadingIcon,
  compact = false,
  coverPhotoUrl,
}: MerchantScreenHeaderProps) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const visibleCoverUrl =
    coverPhotoUrl && failedCoverUrl !== coverPhotoUrl ? coverPhotoUrl : null;

  return (
    <View
      className={`flex-row items-center justify-between bg-background ${compact ? "gap-3 border-b border-border-primary px-4 py-3" : "px-6 py-4"}`}
    >
      {/* Screen title */}
      {(visibleCoverUrl || leadingIcon) && (
        <View className="h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted">
          {visibleCoverUrl ? (
            <Image
              source={{ uri: visibleCoverUrl }}
              contentFit="cover"
              style={{ width: 40, height: 40 }}
              accessibilityLabel={`${subtitle ?? title} cover photo`}
              onError={() => setFailedCoverUrl(visibleCoverUrl)}
            />
          ) : leadingIcon ? (
            <MaterialCommunityIcons
              name={leadingIcon}
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          ) : null}
        </View>
      )}
      <View className="min-w-0 flex-1">
        <AppText
          weight="bold"
          numberOfLines={1}
          className={`min-w-0 text-text-primary ${compact ? "text-xl" : "text-2xl"}`}
        >
          {title}
        </AppText>
        {subtitle && (
          <AppText className="text-xs text-text-secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>

      {/* Optional screen action */}
      {rightAccessory ??
        (actionIcon && onActionPress ? (
          <TouchableOpacity
            onPress={onActionPress}
            activeOpacity={0.7}
            className="cursor-pointer rounded-full p-2"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={actionIcon}
              size={22}
              color="#14251F"
            />
          </TouchableOpacity>
        ) : null)}
    </View>
  );
}
