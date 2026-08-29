import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type Props = {
  description: string | null;
};

const DESCRIPTION_LIMIT = 180;

/**
 * Displays the business description with a compact preview and optional
 * expansion for longer descriptions.
 */
export default function BusinessAboutContent({ description }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const chevronRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chevronRotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, chevronRotation]);

  if (!description) {
    return null;
  }

  const shouldTruncate = description.length > DESCRIPTION_LIMIT;

  const displayedDescription =
    shouldTruncate && !isExpanded
      ? `${description.slice(0, DESCRIPTION_LIMIT).trimEnd()}...`
      : description;

  const rotation = chevronRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View className="bg-surface">
      {/* Business description */}
      <Text className="text-sm leading-6 text-text-secondary font-medium">
        {displayedDescription}
      </Text>

      {/* Description expansion */}
      {shouldTruncate && (
        <Pressable
          onPress={() => setIsExpanded((current) => !current)}
          className="mt-2 flex-row items-center self-start cursor-pointer active:opacity-70"
        >
          <Text className="text-sm font-semibold text-brand">
            {isExpanded ? "Show less" : "Read more"}
          </Text>

          <Animated.View
            className="ml-1"
            style={{
              transform: [{ rotate: rotation }],
            }}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color={theme.extends.colors.brand}
            />
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}
