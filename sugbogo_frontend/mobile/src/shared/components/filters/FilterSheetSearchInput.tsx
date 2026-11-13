import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  background?: "surface" | "muted";
};

/** Renders the rounded search input used inside filter and selection sheets. */
export default function FilterSheetSearchInput({
  query,
  onQueryChange,
  placeholder,
  accessibilityLabel,
  background = "muted",
}: Props) {
  return (
    <View
      className={`h-11 flex-row items-center rounded-full border border-border-primary px-4 ${
        background === "surface" ? "bg-surface" : "bg-surface-muted"
      }`}
    >
      <MaterialCommunityIcons
        name="magnify"
        size={20}
        color={theme.extends.colors.text.tertiary}
        accessible={false}
      />
      <BottomSheetTextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder={placeholder}
        placeholderTextColor={theme.extends.colors.text.tertiary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={accessibilityLabel}
        style={{
          flex: 1,
          marginLeft: 8,
          paddingVertical: 0,
          fontSize: 14,
          color: theme.extends.colors.text.primary,
        }}
      />
      {query.length > 0 && (
        <Pressable
          onPress={() => onQueryChange("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={18}
            color={theme.extends.colors.text.tertiary}
            accessible={false}
          />
        </Pressable>
      )}
    </View>
  );
}
