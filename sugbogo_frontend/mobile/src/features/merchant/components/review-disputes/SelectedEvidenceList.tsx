import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

import type { LocalReviewDisputeEvidence } from "../../types/review-disputes/reviewDispute.types";

type Props = {
  evidence: LocalReviewDisputeEvidence[];
  onRemove: (index: number) => void;
  disabled?: boolean;
};

/** Previews evidence selected locally before a dispute or upload is submitted. */
export default function SelectedEvidenceList({
  evidence,
  onRemove,
  disabled = false,
}: Props) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <View className="mt-3 gap-2">
      {/* Selected evidence */}
      {evidence.map((item, index) => (
        <View
          key={`${item.uri}-${index}`}
          className="flex-row items-center rounded-xl border border-border-primary bg-surface p-2"
        >
          {item.type === "image" ? (
            <Image
              source={{ uri: item.uri }}
              className="h-14 w-14 rounded-lg bg-surface-secondary"
              contentFit="cover"
            />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-lg bg-brand/10">
              <MaterialCommunityIcons
                name="file-document-outline"
                size={27}
                color={theme.extends.colors.brand}
              />
            </View>
          )}

          <View className="ml-3 min-w-0 flex-1">
            <Text
              className="text-sm font-semibold text-text-primary"
              numberOfLines={1}
            >
              {item.fileName}
            </Text>

            <Text className="mt-0.5 text-xs capitalize text-text-secondary">
              {item.type}
            </Text>
          </View>

          <Pressable
            onPress={() => onRemove(index)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.fileName}`}
            hitSlop={8}
            className="ml-2 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-secondary"
          >
            <MaterialCommunityIcons
              name="close"
              size={21}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
