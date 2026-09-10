import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable } from "react-native";
import type { NativeStackNavigationOptions } from "expo-router";

import { theme } from "@/constants/theme";

/**
 * Shared navigation options used across feature stack layouts.
 *
 * These options provide a consistent header appearance throughout the app,
 * reducing duplicated configuration in individual stack layouts.
 */
export const defaultStackScreenOptions: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerTitleAlign: "center",
  headerTitleStyle: {
    fontSize: 16,
    fontFamily: "NunitoSans_700Bold",
  },
  headerLeft: ({ canGoBack }) =>
    canGoBack ? (
      <Pressable
        onPress={() => router.back()}
        className="cursor-pointer p-2"
        hitSlop={8}
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={26}
          color={theme.extends.colors.text.primary}
        />
      </Pressable>
    ) : null,
};

export const slideFromRight = {
  animation: "slide_from_right" as const,
};
