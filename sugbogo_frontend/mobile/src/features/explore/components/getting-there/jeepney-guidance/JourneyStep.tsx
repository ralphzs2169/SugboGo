import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";

type JourneyStepVariant = "origin" | "step" | "destination";

type Props = {
  number: number;
  title: string;
  detail: string;
  supportingLabel?: string;
  supportingText?: string;
  supportingDetail?: string;
  supportingIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  variant?: JourneyStepVariant;
  isLast?: boolean;
};

const BOARDING_BACKGROUND = "#3B82F6";
const BOARDING_COLOR = "#EFF6FF";

const ALIGHTING_BACKGROUND = "#22C55E";
const ALIGHTING_COLOR = "#F0FDF4";

/**
 * Renders one stage in a direct Jeepney journey timeline.
 *
 * Uses blue for boarding, the SugboGo brand color for the ride, and green for
 * alighting while keeping contextual guidance subordinate to each main step.
 */
export default function JourneyStep({
  number,
  title,
  detail,
  supportingLabel,
  supportingText,
  supportingDetail,
  supportingIcon,
  icon,
  variant = "step",
  isLast = false,
}: Props) {
  const isOrigin = variant === "origin";
  const isDestination = variant === "destination";

  const semanticColor = isOrigin
    ? BOARDING_BACKGROUND
    : isDestination
      ? ALIGHTING_BACKGROUND
      : theme.extends.colors.brand;

  return (
    <View className="flex-row">
      {/* Timeline marker and connector */}
      <View className="items-center">
        {isOrigin ? (
          <View
            className="h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: BOARDING_BACKGROUND,
            }}
          >
            <MaterialCommunityIcons
              name={icon ?? "map-marker-radius-outline"}
              size={15}
              color={BOARDING_COLOR}
            />
          </View>
        ) : isDestination ? (
          <View
            className="h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: ALIGHTING_BACKGROUND,
            }}
          >
            <MaterialCommunityIcons
              name="exit-run"
              size={16}
              color={ALIGHTING_COLOR}
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
          <DottedTimelineConnector className="my-1 min-h-10 flex-1" />
        )}
      </View>

      {/* Primary journey guidance */}
      <View className={`ml-3 flex-1 ${isLast ? "" : "pb-4"}`}>
        {(isOrigin || isDestination) && (
          <AppText
            weight="bold"
            className="mb-0.5 text-[10px] uppercase tracking-wide"
            style={{
              color: semanticColor,
            }}
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

        {/* Optional contextual guidance */}
        {supportingText && (
          <View className="mt-2 flex-row items-start rounded-lg bg-brand/5 px-2.5 py-2">
            <MaterialCommunityIcons
              name={supportingIcon ?? "map-marker-radius-outline"}
              size={14}
              color={theme.extends.colors.brand}
              style={{
                marginTop: 1,
              }}
            />

            <View className="ml-2 flex-1">
              {supportingLabel && (
                <AppText
                  weight="semibold"
                  className="text-[11px] text-text-secondary"
                >
                  {supportingLabel}
                </AppText>
              )}

              <AppText
                weight="medium"
                className="mt-0.5 text-xs leading-4 text-text-primary"
                numberOfLines={2}
              >
                {supportingText}
              </AppText>

              {supportingDetail && (
                <AppText className="mt-0.5 text-[11px] leading-4 text-text-secondary">
                  {supportingDetail}
                </AppText>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
