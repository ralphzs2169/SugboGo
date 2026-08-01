import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { theme } from "@/constants/theme";

type SearchBarProps = {
  value: string;
  isLoading: boolean;
  onChangeText: (text: string) => void;
  onClear: () => void;
};

/**
 * Search input used for looking up business locations
 * through Google Places.
 *
 * Displays a loading indicator while search suggestions
 * are being fetched and allows the current query to be cleared.
 */
export default function SearchBar({
  value,
  isLoading,
  onChangeText,
  onClear,
}: SearchBarProps) {
  return (
    <View className="h-[46px] flex-row items-center rounded-md border border-gray-300 bg-white px-4">
      <MaterialCommunityIcons name="magnify" size={22} color="#6B7280" />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search your business location"
        placeholderTextColor="#9CA3AF"
        returnKeyType="search"
        className="ml-2 flex-1 text-[12px] text-gray-800"
      />

      {isLoading && (
        <ActivityIndicator size="small" color={theme.extends.colors.brand} />
      )}

      {!isLoading && value.length > 0 && (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          className="ml-1 h-6 w-6 items-center justify-center rounded-full bg-gray-100"
        >
          <MaterialCommunityIcons name="close" size={14} color="#6B7280" />
        </Pressable>
      )}
    </View>
  );
}
