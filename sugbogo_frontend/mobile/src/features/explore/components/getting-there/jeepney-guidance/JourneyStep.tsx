import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type JourneyStepVariant = "origin" | "step" | "destination";

type Props = {
  number: number;
  title: string;
  detail: string;
  supportingText?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  variant?: JourneyStepVariant;
  isLast?: boolean;
};

/**
 * Renders one stage in a direct jeepney journey timeline.
 *
 * Uses semantic travel icons for journey actions while preserving distinct
 * origin and destination markers for quick route scanning.
 */
export default function JourneyStep({
  number,
  title,
  detail,
  supportingText,
  icon,
  variant = "step",
  isLast = false,
}: Props) {
  const isOrigin = variant === "origin";
  const isDestination = variant === "destination";

  return (
    <View className="flex-row">
      {/* Timeline marker and connector */}
      <View className="items-center">
        {isDestination ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-brand">
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color="#FFFFFF"
            />
          </View>
        ) : isOrigin ? (
          <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-brand bg-surface">
            <MaterialCommunityIcons
              name={icon ?? "walk"}
              size={15}
              color={theme.extends.colors.brand}
            />
          </View>
        ) : (
          <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-brand bg-surface">
            {icon ? (
              <MaterialCommunityIcons
                name={icon}
                size={16}
                color={theme.extends.colors.brand}
              />
            ) : (
              <AppText weight="extrabold" className="text-[12px] text-brand">
                {number}
              </AppText>
            )}
          </View>
        )}

        {!isLast && (
          <View className="my-1 min-h-10 w-px flex-1 bg-border-primary" />
        )}
      </View>

      {/* Step guidance */}
      <View className={`ml-3 flex-1 ${isLast ? "" : "pb-4"}`}>
        {(isOrigin || isDestination) && (
          <AppText
            weight="bold"
            className="mb-0.5 text-[10px] uppercase tracking-wide text-brand"
          >
            {isOrigin ? "Start" : "Destination"}
          </AppText>
        )}

        <AppText
          weight="semibold"
          className="text-sm leading-5 text-text-primary"
        >
          {title}
        </AppText>

        <AppText className="mt-0.5 text-xs leading-4 text-text-secondary">
          {detail}
        </AppText>

        {supportingText && (
          <AppText
            weight="semibold"
            className="mt-1.5 text-xs leading-4 text-brand"
          >
            {supportingText}
          </AppText>
        )}
      </View>
    </View>
  );
}
