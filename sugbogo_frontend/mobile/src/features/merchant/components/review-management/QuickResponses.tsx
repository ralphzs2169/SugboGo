import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ReplyTemplate } from "@/features/merchant/types/reply-templates/replyTemplate.types";

type Props = {
  templates: ReplyTemplate[];
  disabled?: boolean;
  onSelect: (template: ReplyTemplate) => void;
  onViewMore: () => void;
};

/**
 * Displays the merchant's saved quick responses as compact selectable pills.
 *
 * Shows up to three responses in the composer and provides access to the
 * complete template list. When no responses exist, it displays a compact
 * empty state instead.
 */
export default function QuickResponses({
  templates,
  disabled = false,
  onSelect,
  onViewMore,
}: Props) {
  const previewTemplates = templates.slice(0, 3);

  return (
    <View className="mt-5">
      {/* Section header */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-text-primary">
          Quick responses
        </Text>

        {templates.length > 0 && (
          <Pressable
            onPress={onViewMore}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="View all response templates"
            className="cursor-pointer flex-row items-center active:opacity-60"
          >
            <Text className="text-xs font-semibold text-brand">View More</Text>

            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={theme.extends.colors.brand}
            />
          </Pressable>
        )}
      </View>

      {templates.length === 0 ? (
        /* Empty state */
        <View className="rounded-md border border-border-primary bg-surface px-4 py-4">
          <View className="flex-row items-center">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary">
              <MaterialCommunityIcons
                name="text-box-multiple-outline"
                size={19}
                color={theme.extends.colors.text.tertiary}
              />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-text-primary">
                No quick responses yet
              </Text>

              <Text className="mt-0.5 text-xs leading-4 text-text-secondary">
                Create saved responses to reply to reviews faster.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* Response pills */
        <View className="flex-row flex-wrap gap-2">
          {previewTemplates.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => onSelect(template)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Use ${template.title} template`}
              className="cursor-pointer rounded-full border border-border-primary bg-surface px-4 py-2.5 active:opacity-70"
            >
              <Text
                className="max-w-40 text-xs font-semibold text-text-primary"
                numberOfLines={1}
              >
                {template.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
