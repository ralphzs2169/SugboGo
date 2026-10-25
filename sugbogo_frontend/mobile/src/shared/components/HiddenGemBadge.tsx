import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { GEM_ACCENT } from "@/shared/styles/hiddenGems";
// IGNORE THIS COMPONENT FOR NOW, THIS IS INTENTIONAL
/** Identifies measured Hidden Gems using the same symbol and accent as map markers. */
export default function HiddenGemBadge() {
  return (
    <View
      accessible
      accessibilityLabel="Hidden Gem"
      pointerEvents="none"
      className="absolute -left-2 -top-2 h-6 w-6 items-center justify-center rounded-full  "
      // style={{ borderColor: GEM_ACCENT, zIndex: 2, elevation: 8 }}
    >
      {/* <MaterialCommunityIcons
        name="diamond-stone"
        size={13}
        color={GEM_ACCENT}
        accessibilityElementsHidden
        importantForAccessibility="no"
      /> */}
    </View>
  );
}
