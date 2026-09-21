import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  businessName: string;
  businessCoverPhotoUrl?: string | null;
  onBack: () => void;
};

const BUSINESS_THUMBNAIL_SIZE = 34;

/**
 * Displays compact destination context above the road-route map.
 *
 * Keeps the selected business visually identifiable while providing an
 * integrated back action consistent with the Jeepney route-map experience.
 */
export default function RoadRouteContextCard({
  businessName,
  businessCoverPhotoUrl,
  onBack,
}: Props) {
  return (
    <View
      className="rounded-2xl border border-border-primary bg-surface"
      style={shadows.floating}
    >
      {/* Destination context */}
      <View className="flex-row items-center px-2.5 py-2">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-1.5 h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <View
          className="shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-primary bg-white"
          style={{
            width: BUSINESS_THUMBNAIL_SIZE,
            height: BUSINESS_THUMBNAIL_SIZE,
          }}
        >
          {businessCoverPhotoUrl ? (
            <Image
              source={{ uri: businessCoverPhotoUrl }}
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit="cover"
            />
          ) : (
            <MaterialCommunityIcons
              name="store-outline"
              size={18}
              color={theme.extends.colors.brand}
            />
          )}
        </View>

        <View className="ml-2 min-w-0 flex-1">
          <AppText
            weight="bold"
            className="text-[9px] uppercase tracking-wide text-brand"
          >
            Going to
          </AppText>

          <AppText
            weight="bold"
            className="text-sm leading-5 text-text-primary"
            numberOfLines={1}
          >
            {businessName}
          </AppText>
        </View>
      </View>
    </View>
  );
}
