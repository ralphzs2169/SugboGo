import { useState } from "react";
import { Pressable, Text, View } from "react-native";

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

  if (!description) {
    return null;
  }

  const shouldTruncate = description.length > DESCRIPTION_LIMIT;

  const displayedDescription =
    shouldTruncate && !isExpanded
      ? `${description.slice(0, DESCRIPTION_LIMIT).trimEnd()}...`
      : description;

  return (
    <View className="  bg-surface ">
      {/* Business description */}
      <Text className="text-sm leading-6 text-text-secondary">
        {displayedDescription}
      </Text>

      {/* Description expansion */}
      {shouldTruncate && (
        <Pressable
          onPress={() => setIsExpanded((current) => !current)}
          className="mt-2 self-start"
        >
          <Text className="text-sm font-semibold text-brand">
            {isExpanded ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
