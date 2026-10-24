import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Keyboard, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  queries: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => Promise<void>;
  onClear: () => Promise<void>;
};

/** Displays bounded text history with separate replay and removal actions. */
export default function RecentSearches({
  queries,
  onSelect,
  onRemove,
  onClear,
}: Props) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const clearHistory = async () => {
    if (isClearing) {
      return;
    }

    setIsClearing(true);

    try {
      await onClear();
      setShowConfirmation(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <View>
      {/* History heading and list-wide action */}
      <View className="flex-row items-center justify-between gap-3">
        <AppText
          weight="bold"
          accessibilityRole="header"
          className="flex-1 text-base text-text-primary"
        >
          Recent searches
        </AppText>
        <SafePressable
          onPress={() => {
            Keyboard.dismiss();
            setShowConfirmation(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear all recent searches"
          className="min-h-12 cursor-pointer justify-center px-2 active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            Clear all
          </AppText>
        </SafePressable>
      </View>

      {/* Sibling controls prevent removal from triggering replay. */}
      {queries.map((query) => (
        <View key={query.toLowerCase()} className="flex-row items-center">
          <SafePressable
            onPress={() => onSelect(query)}
            accessibilityRole="button"
            accessibilityLabel={`Search again for ${query}`}
            className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center gap-3 rounded-xl py-3 pr-3 active:bg-background"
          >
            <MaterialCommunityIcons
              name="history"
              size={20}
              color={theme.extends.colors.text.tertiary}
              accessible={false}
            />
            <AppText
              numberOfLines={2}
              className="flex-1 text-sm text-text-primary"
            >
              {query}
            </AppText>
          </SafePressable>
          <SafePressable
            onPress={() => void onRemove(query)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${query} from recent searches`}
            className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-background"
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </SafePressable>
        </View>
      ))}

      {/* Existing confirmation pattern for clearing the complete history. */}
      <ConfirmModal
        visible={showConfirmation}
        title="Clear recent searches?"
        message="This removes your recent searches from this device."
        confirmText="Clear all"
        destructive
        isLoading={isClearing}
        onCancel={() => setShowConfirmation(false)}
        onConfirm={() => void clearHistory()}
      />
    </View>
  );
}
