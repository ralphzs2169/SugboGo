import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  businessName: string;
  address: string | null;
  coverPhotoUrl: string | null;
  isLoading: boolean;
};

/**
 * Displays the destination business for Jeepney guidance.
 *
 * Keeps the destination full-width within the screen's standard horizontal
 * padding so it aligns consistently with the other route-planning sections.
 */
export default function JeepneyGuidanceHeader({
  businessName,
  address,
  coverPhotoUrl,
  isLoading,
}: Props) {
  return (
    <View className="px-screen-x py-5">
      {/* Destination label */}
      <AppText
        weight="bold"
        className="mb-2.5 text-[11px] uppercase tracking-wide text-text-primary"
      >
        Going to
      </AppText>

      {/* Destination card */}
      <View className="w-full rounded-xl border border-border-primary bg-surface px-3.5 py-3.5">
        {isLoading ? (
          <View className="flex-row items-center">
            <Skeleton className="h-14 w-14 rounded-xl" />

            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="mt-2 h-3 w-1/3 rounded-md" />
            </View>
          </View>
        ) : (
          <View className="flex-row items-center">
            {/* Business image */}
            {coverPhotoUrl ? (
              <Image
                source={{ uri: coverPhotoUrl }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                }}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-xl bg-brand/10">
                <MaterialCommunityIcons
                  name="store-outline"
                  size={25}
                  color={theme.extends.colors.brand}
                />
              </View>
            )}

            {/* Business identity */}
            <View className="ml-3 min-w-0 flex-1">
              <AppText
                weight="bold"
                className="text-base leading-5 text-text-primary"
                numberOfLines={2}
              >
                {businessName}
              </AppText>

              <View className="mt-1 flex-row items-start">
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={14}
                  color={theme.extends.colors.text.secondary}
                  style={{ marginTop: 1 }}
                />

                <AppText
                  className="ml-1 min-w-0 flex-1 text-xs leading-4 text-text-secondary"
                  numberOfLines={2}
                >
                  {address ?? "Destination"}
                </AppText>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
