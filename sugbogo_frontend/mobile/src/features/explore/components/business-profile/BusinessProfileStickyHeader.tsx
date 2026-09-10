import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import BusinessPocketButton from "./BusinessPocketButton";

type Props = {
  businessId: number;
  isPocketed: boolean;
  businessName: string;
  coverPhotoUrl: string | null;
  clusterIconName: keyof typeof MaterialCommunityIcons.glyphMap;
  clusterName: string;
  categoryName: string;
  isOwnBusiness: boolean;
  navOpacity: Animated.Value;
  identityOpacity: Animated.Value;
  translateY: Animated.Value;
};

/**
 * Displays the sticky header for the Explorer business profile.
 *
 * The navigation controls appear first as the business hero scrolls away.
 * The business identity appears at a later scroll threshold and includes
 * the business cover photo, name, cluster, and category.
 *
 * The header respects the device safe area and remains fixed above the
 * profile content while scrolling.
 */
export default function BusinessProfileStickyHeader({
  businessId,
  isPocketed,
  businessName,
  coverPhotoUrl,
  clusterIconName,
  clusterName,
  categoryName,
  navOpacity,
  identityOpacity,
  translateY,
  isOwnBusiness,
}: Props) {
  const insets = useSafeAreaInsets();

  const navHeight = insets.top + 40;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        transform: [{ translateY }],
        zIndex: 999,
        elevation: 1,
      }}
    >
      {/* Navigation */}
      <Animated.View
        style={{
          height: navHeight,
          opacity: navOpacity,
          paddingTop: insets.top,
          backgroundColor: "#ffffff",
        }}
      >
        <View className="h-10 flex-row items-center justify-between px-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 cursor-pointer items-center justify-center rounded-full active:opacity-80"
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.extends.colors.text.primary}
            />
          </Pressable>

          <BusinessPocketButton
            businessId={businessId}
            isPocketed={isPocketed}
          />
        </View>
      </Animated.View>

      {/* Business identity */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: navHeight,
          left: 0,
          right: 0,
          opacity: identityOpacity,
          backgroundColor: "#ffffff",
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
        }}
      >
        <View className="flex-row items-center px-4">
          {coverPhotoUrl ? (
            <Image
              source={{ uri: coverPhotoUrl }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
              }}
              contentFit="cover"
            />
          ) : (
            <View className="h-8 w-8 items-center justify-center rounded-md bg-surface-secondary">
              <MaterialCommunityIcons
                name="store-outline"
                size={18}
                color={theme.extends.colors.text.secondary}
              />
            </View>
          )}

          <View className="ml-2 flex-1">
            <View className="flex-row items-center">
              <AppText
                weight="bold"
                className="flex-shrink text-base text-text-primary"
                numberOfLines={1}
              >
                {businessName}
              </AppText>

              {isOwnBusiness && (
                <View className="ml-1.5 flex-row items-center rounded-full bg-brand px-1.5 py-0.5">
                  <MaterialCommunityIcons
                    name="store-check-outline"
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </View>

            <View className="mt-0.5 flex-row items-center">
              <MaterialCommunityIcons
                name={clusterIconName}
                size={14}
                color={theme.extends.colors.text.secondary}
              />

              <AppText
                weight="medium"
                className="ml-1 flex-1 text-xs text-text-secondary"
                numberOfLines={1}
              >
                {clusterName} · {categoryName}
              </AppText>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
