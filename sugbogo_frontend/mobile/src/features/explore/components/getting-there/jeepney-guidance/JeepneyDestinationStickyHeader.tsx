import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Animated, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  businessName: string;
  address: string | null;
  coverPhotoUrl: string | null;
  opacity: Animated.Value;
  translateY: Animated.Value;
};

/**
 * Displays the full-width sticky destination identity for Jeepney guidance.
 *
 * Appears as the original destination card reaches the top of the screen and
 * keeps the current business destination visible while route results scroll.
 */
export default function JeepneyDestinationStickyHeader({
  businessName,
  address,
  coverPhotoUrl,
  opacity,
  translateY,
}: Props) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        // elevation: 6,
        opacity,
        transform: [{ translateY }],
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: theme.extends.colors.border.primary,
      }}
    >
      {/* Sticky destination identity */}
      <View className="flex-row items-center px-screen-x pt-0 pb-3 ">
        {coverPhotoUrl ? (
          <Image
            source={{ uri: coverPhotoUrl }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
            }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
            <MaterialCommunityIcons
              name="store-outline"
              size={21}
              color={theme.extends.colors.brand}
            />
          </View>
        )}

        <View className="ml-3 min-w-0 flex-1">
          <AppText
            weight="bold"
            className="text-[9px] uppercase tracking-wide text-text-secondary"
          >
            Going to
          </AppText>

          <AppText
            weight="bold"
            className="mt-0.5 text-sm leading-5 text-text-primary"
            numberOfLines={1}
          >
            {businessName}
          </AppText>

          <View className="mt-0.5 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={12}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              className="ml-1 min-w-0 flex-1 text-[11px] text-text-secondary"
              numberOfLines={1}
            >
              {address ?? "Destination"}
            </AppText>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
