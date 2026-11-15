import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { Pressable } from "react-native";
import { theme } from "@/constants/theme";

export default function MerchantPlusBackButton({
  fallback,
}: {
  fallback: "/(merchant)/merchant-plus" | "/(merchant)/(tabs)/analytics";
}) {
  const navigation = useNavigation();

  function goBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace(fallback);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={goBack}
      className="cursor-pointer p-2"
      hitSlop={8}
    >
      <MaterialCommunityIcons
        name="chevron-left"
        size={26}
        color={theme.extends.colors.text.primary}
      />
    </Pressable>
  );
}
