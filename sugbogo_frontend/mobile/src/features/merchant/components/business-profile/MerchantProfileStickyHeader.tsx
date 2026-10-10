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
 * Reveals a compact, actionable business identity after the cover scrolls away.
 * Displays the business display cover with a storefront fallback.
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
    <Animated.View
      testID="merchant-profile-sticky-header"
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      className="absolute z-50 border-b border-border-primary bg-surface"
      style={{
        top: insets.top,
        left: insets.left,
        right: insets.right,
        opacity,
        transform: [{ translateY }],
      }}
    >
      {/* Collapsed merchant identity */}
      <SafePressable
        onPress={onManageBusiness}
        accessibilityRole="button"
        accessibilityLabel="Manage business"
        className="min-h-16 cursor-pointer flex-row items-center gap-3 px-4 py-2 active:bg-background"
      >
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
        <MaterialCommunityIcons
          name="chevron-right"
          size={21}
          color={theme.extends.colors.text.secondary}
        />
      </SafePressable>
    </Animated.View>
  );
}
