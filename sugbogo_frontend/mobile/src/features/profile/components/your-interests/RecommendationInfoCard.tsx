import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  View,
} from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/**
 * Explains the signals behind interest recommendations in an expandable card.
 * Expansion state and the chevron animation remain local to this UI component.
 */
export default function RecommendationInfoCard() {
  const [showInterestInfo, setShowInterestInfo] = useState(false);
  const interestInfoChevron = useRef(new Animated.Value(0)).current;

  const toggleInterestInfo = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const nextValue = !showInterestInfo;

    setShowInterestInfo(nextValue);

    Animated.timing(interestInfoChevron, {
      toValue: nextValue ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const interestInfoChevronRotation = interestInfoChevron.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <Pressable
      onPress={toggleInterestInfo}
      accessibilityRole="button"
      accessibilityLabel="How recommendations work"
      accessibilityState={{ expanded: showInterestInfo }}
      className="mt-4 cursor-pointer rounded-xl border border-border-primary bg-surface px-4 py-4 active:opacity-75"
    >
      {/* Explanation header */}
      <View className="flex-row items-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/10">
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={20}
            color={theme.extends.colors.brand}
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <AppText weight="semibold" className="text-sm text-text-primary">
            How recommendations work
          </AppText>

          {!showInterestInfo && (
            <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
              See what helps shape your Based on Your Interests recommendations.
            </AppText>
          )}
        </View>

        <Animated.View
          style={{ transform: [{ rotate: interestInfoChevronRotation }] }}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={22}
            color={theme.extends.colors.text.tertiary}
          />
        </Animated.View>
      </View>

      {/* Expanded recommendation explanation */}
      {showInterestInfo && (
        <View className="mt-4 border-t border-border-primary pt-4">
          <AppText className="text-sm leading-5 text-text-secondary">
            SugboGo combines the interests you choose here with signals from how
            you explore to find businesses that better match what you enjoy.
          </AppText>

          <View className="mt-4 gap-4">
            {/* Explicit interests */}
            <View className="flex-row items-start">
              <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full ">
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={17}
                  color={theme.extends.colors.brand}
                />
              </View>

              <View className="ml-3 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Your choices
                </AppText>

                <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
                  Categories and specialties you select here directly shape your
                  interests.
                </AppText>
              </View>
            </View>

            {/* Profile visits */}
            <View className="flex-row items-start">
              <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full ">
                <MaterialCommunityIcons
                  name="store-search-outline"
                  size={17}
                  color={theme.extends.colors.brand}
                />
              </View>

              <View className="ml-3 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Places you explore
                </AppText>

                <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
                  Visiting business profiles helps SugboGo learn what catches
                  your attention.
                </AppText>
              </View>
            </View>

            {/* Pocket saves */}
            <View className="flex-row items-start">
              <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full ">
                <MaterialCommunityIcons
                  name="bookmark-outline"
                  size={17}
                  color={theme.extends.colors.brand}
                />
              </View>

              <View className="ml-3 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Places you save
                </AppText>

                <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
                  Businesses you keep in your Pockets are treated as a stronger
                  sign of interest.
                </AppText>
              </View>
            </View>

            {/* Specialty vouches */}
            <View className="flex-row items-start">
              <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full ">
                <MaterialCommunityIcons
                  name="heart-outline"
                  size={17}
                  color={theme.extends.colors.brand}
                />
              </View>

              <View className="ml-3 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Specialties you vouch for
                </AppText>

                <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
                  Valid specialty vouches show stronger interest in that kind of
                  experience.
                </AppText>
              </View>
            </View>
          </View>

          {/* Recommendation scope */}
          <View className="mt-4 flex-row items-start rounded-xl bg-background px-3 py-3">
            <MaterialCommunityIcons
              name="information-outline"
              size={17}
              color={theme.extends.colors.text.secondary}
            />

            <AppText className="ml-2 flex-1 text-xs leading-5 text-text-secondary">
              These signals personalize the{" "}
              <AppText weight="semibold" className="text-xs text-text-primary">
                Based on Your Interests
              </AppText>{" "}
              section in Explore Page.
            </AppText>
          </View>
        </View>
      )}
    </Pressable>
  );
}
