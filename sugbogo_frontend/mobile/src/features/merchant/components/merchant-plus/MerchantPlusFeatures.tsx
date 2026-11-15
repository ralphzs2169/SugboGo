import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWindowDimensions, View } from "react-native";
import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";

/**
 * Brand orange (#F27F0D) shades used for icon tiles. The icon shade is the
 * same hue darkened for contrast, and the tile is a light tint of the brand.
 * Set through `style` because `bg-brand/10` style opacity classes do not
 * render in this app's NativeWind setup.
 */
const ICON_COLOR = "#B85F08";
const ICON_TILE = "#FEF1E2";

const PLUS_FEATURES = [
  {
    title: "Peer comparisons",
    icon: "store-outline",
    discoveryIcon: "account-group-outline",
    detail: "Compare with similar businesses",
  },
  {
    title: "Specialty trends",
    icon: "heart-outline",
    discoveryIcon: "trending-up",
    detail: "Track how specialty support changes",
  },
  {
    title: "Visit timing",
    icon: "clock-outline",
    detail: "See when explorers are most interested",
  },
  {
    title: "Business recommendations",
    compactTitle: "Recommendations",
    shortTitle: "Business tips",
    icon: "lightbulb-outline",
    detail: "Get suggestions based on your activity",
  },
] as const;

/** Presents the same benefits as a discovery grid or a grouped offer section. */
export default function MerchantPlusFeatures({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const useShortLabel = width < 375 || width / fontScale < 370;
  const stackTileContents = width / fontScale < 280;

  if (compact) {
    return (
      <View className="gap-2">
        {[PLUS_FEATURES.slice(0, 2), PLUS_FEATURES.slice(2)].map((row) => (
          <View key={row[0].title} className="flex-row items-stretch gap-2">
            {row.map((feature) => (
              <View
                key={feature.title}
                accessibilityLabel={
                  "shortTitle" in feature ? feature.title : undefined
                }
                className={`min-h-12 min-w-0 flex-1 gap-1.5 rounded-card bg-background px-2 py-1.5 ${stackTileContents ? "items-start" : "flex-row items-center"}`}
              >
                <View
                  className="h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: ICON_TILE }}
                >
                  <MaterialCommunityIcons
                    name={
                      "discoveryIcon" in feature
                        ? feature.discoveryIcon
                        : feature.icon
                    }
                    size={16}
                    color={ICON_COLOR}
                    accessible={false}
                  />
                </View>
                <AppText
                  weight="semibold"
                  className={`min-w-0 text-small text-text-primary ${stackTileContents ? "self-stretch" : "flex-1"}`}
                >
                  {"compactTitle" in feature
                    ? useShortLabel
                      ? feature.shortTitle
                      : feature.compactTitle
                    : feature.title}
                </AppText>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-border-primary bg-surface px-4">
      {PLUS_FEATURES.map((feature, index) => (
        <View
          key={feature.title}
          className={`flex-row items-center gap-3 py-3 ${index > 0 ? "border-t border-border-primary" : ""}`}
        >
          <View
            className="h-10 w-10 shrink-0 items-center justify-center rounded-btn"
            style={{ backgroundColor: ICON_TILE }}
          >
            <MaterialCommunityIcons
              name={
                "discoveryIcon" in feature
                  ? feature.discoveryIcon
                  : feature.icon
              }
              size={22}
              color={ICON_COLOR}
              accessible={false}
            />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <AppText weight="extrabold" className="text-sm text-text-primary">
              {feature.title}
            </AppText>
            <AppText className="text-small leading-4 text-text-secondary">
              {feature.detail}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
