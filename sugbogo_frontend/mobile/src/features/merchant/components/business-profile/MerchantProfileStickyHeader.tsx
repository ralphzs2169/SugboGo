import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { ClusterIcon } from "@/shared/types/cluster.types";

type Props = {
  businessName: string;
  classification: string;
  coverPhotoUrl?: string | null;
  clusterIcon?: ClusterIcon;
  visible: boolean;
  opacity: Animated.Value;
  translateY: Animated.Value;
  onManageBusiness: () => void;
};

/**
 * Reveals business identity, management, and notifications together after
 * the cover scrolls away.
 */
export default function MerchantProfileStickyHeader({
  businessName,
  classification,
  coverPhotoUrl,
  clusterIcon,
  visible,
  opacity,
  translateY,
  onManageBusiness,
}: Props) {
  const insets = useSafeAreaInsets();
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const visibleCoverUrl =
    coverPhotoUrl && failedCoverUrl !== coverPhotoUrl ? coverPhotoUrl : null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute z-50"
      style={{ top: insets.top, left: insets.left, right: insets.right }}
    >
      <Animated.View
        testID="merchant-profile-sticky-header"
        pointerEvents={visible ? "auto" : "none"}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        className="border-b border-border-primary bg-surface"
        style={{
          opacity,
          transform: [{ translateY }],
        }}
      >
        {/* Collapsed merchant identity */}
        <View className="min-h-16 flex-row items-center gap-3 pl-4 pr-32 py-2">
          <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-background">
            {visibleCoverUrl ? (
              <Image
                source={{ uri: visibleCoverUrl }}
                contentFit="cover"
                style={{ width: 40, height: 40 }}
                accessibilityLabel={`${businessName} cover photo`}
                onError={() => setFailedCoverUrl(visibleCoverUrl)}
              />
            ) : (
              <MaterialCommunityIcons
                name="storefront-outline"
                size={23}
                color={theme.extends.colors.text.secondary}
              />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <AppText
              weight="bold"
              className="text-sm text-text-primary"
              numberOfLines={1}
            >
              {businessName}
            </AppText>
            <View className="mt-0.5 flex-row items-center gap-1">
              {clusterIcon ? (
                <MaterialCommunityIcons
                  name={CLUSTER_ICONS[clusterIcon]}
                  size={14}
                  color={theme.extends.colors.text.secondary}
                />
              ) : null}
              <AppText
                className="min-w-0 flex-1 text-xs text-text-secondary"
                numberOfLines={1}
              >
                {classification}
              </AppText>
            </View>
          </View>
        </View>
        <View className="absolute right-4 top-2 flex-row items-center gap-1">
          <SafePressable
            onPress={onManageBusiness}
            accessibilityRole="button"
            accessibilityLabel="Manage business"
            className="h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-surface active:bg-background"
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={23}
              color={theme.extends.colors.text.primary}
              accessible={false}
            />
          </SafePressable>
          <NotificationBellButton />
        </View>
      </Animated.View>
    </View>
  );
}
