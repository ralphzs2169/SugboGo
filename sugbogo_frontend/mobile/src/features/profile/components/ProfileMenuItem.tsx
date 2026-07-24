import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { theme } from "@/constants/theme";
type BadgeVariant = "default" | "success" | "warning" | "error";

type ProfileMenuItemProps = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;

  badge?: string | number;
  badgeVariant?: BadgeVariant;

  variant?: "default" | "danger";
  showChevron?: boolean;
};

const badgeColors: Record<BadgeVariant, string> = {
  default: "bg-brand",
  success: "bg-success",
  warning: "bg-yellow-500",
  error: "bg-error",
};

/**
 * ProfileMenuItem component represents a single item in the profile menu.
 * It displays an icon, title, optional badge, and a chevron indicating navigation.
 * @param {title} title - The title of the menu item.
 * @param {icon} icon - The name of the MaterialCommunityIcons icon to display.
 * @param {onPress} onPress - Function to call when the item is pressed.
 * @param {badge} badge - Optional badge text or number to display.
 * @param {badgeVariant} badgeVariant - Optional variant for the badge color.
 * @param {variant} variant - Optional variant for the menu item style (default or danger).
 * @param {showChevron} showChevron - Optional boolean to show or hide the chevron.
 *
 * @returns {JSX.Element} The rendered ProfileMenuItem component.
 */
export default function ProfileMenuItem({
  title,
  icon,
  onPress,
  badge,
  badgeVariant = "default",
  variant = "default",
  showChevron = true,
}: ProfileMenuItemProps) {
  const isDanger = variant === "danger";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-4 active:opacity-70"
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={
          isDanger
            ? theme.extends.colors.error
            : theme.extends.colors.text.secondary
        }
      />

      <Text
        className={`ml-4 flex-1 text-base font-medium ${
          isDanger ? "text-error" : "text-text-primary"
        }`}
      >
        {title}
      </Text>

      {badge !== undefined && badge !== null && (
        <View
          className={`mr-3 min-w-[22px] rounded-full px-2 py-1 ${badgeColors[badgeVariant]}`}
        >
          <Text className="text-center text-xs font-semibold text-white">
            {badge}
          </Text>
        </View>
      )}

      {showChevron && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={theme.extends.colors.text.tertiary}
        />
      )}
    </Pressable>
  );
}
