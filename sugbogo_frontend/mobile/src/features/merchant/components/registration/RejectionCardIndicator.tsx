import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

/** Marks rejection feedback at the card corner without tinting the card surface. */
export default function RejectionCardIndicator() {
  return (
    <MaterialCommunityIcons
      name="alert-circle"
      accessible={false}
      size={22}
      color={theme.extends.colors.error}
      style={{
        position: "absolute",
        top: -9,
        right: -11,
        zIndex: 10,
        backgroundColor: theme.extends.colors.background,
        borderRadius: 9999,
      }}
    />
  );
}
