import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  coverPhotoUrl: string | null;
  clusterIcon?: ClusterIcon;
  visible: boolean;
  opacity: Animated.Value;
  translateY: Animated.Value;
  onManageBusiness: () => void;
};

/**
 * Keeps a compact merchant business identity and management shortcut visible
 * after the cover hero scrolls away.
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
      {/* Compact business identity */}
      <View className="h-16 flex-row items-center gap-3 px-4">
        {coverPhotoUrl ? (
          <Image
            source={{ uri: coverPhotoUrl }}
            contentFit="cover"
            style={{ width: 40, height: 40, borderRadius: 8 }}
            accessibilityLabel={`${businessName} cover photo`}
          />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
            <MaterialCommunityIcons
              name="store-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </View>
        )}
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
        <SafePressable
          onPress={onManageBusiness}
          accessibilityRole="button"
          accessibilityLabel="Manage business"
          className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-background"
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={22}
            color={theme.extends.colors.brand}
          />
        </SafePressable>
      </View>
    </Animated.View>
  );
}
