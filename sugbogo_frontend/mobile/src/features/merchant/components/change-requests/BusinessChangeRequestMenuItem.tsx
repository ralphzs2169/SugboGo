import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  totalRequests?: number;
  pending?: boolean;
  onPress: () => void;
  showDivider?: boolean;
};

/** Presents one accessible business-change destination with optional server status. */
export default function BusinessChangeRequestMenuItem({
  title,
  description,
  icon,
  totalRequests,
  pending = false,
  onPress,
  showDivider = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${title.toLowerCase()} requests${pending ? ", pending request" : ""}`}
      className="cursor-pointer px-4 active:bg-background"
    >
      <View
        className={`flex-row items-center gap-3 py-4 ${showDivider ? "border-b border-border-primary/60" : ""}`}
      >
        {/* Request type and description */}
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name={icon}
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-baseline gap-x-1.5">
            <AppText weight="semibold" className="text-sm text-text-primary">
              {title}
            </AppText>
            {typeof totalRequests === "number" && totalRequests > 0 ? (
              <AppText className="text-xs text-text-secondary">
                ({totalRequests})
              </AppText>
            ) : null}
          </View>
          <AppText className="mt-1 text-xs leading-5 text-text-secondary">
            {description}
          </AppText>
        </View>

        {/* Pending status and navigation direction */}
        <View className="shrink-0 flex-row items-center gap-1.5">
          {pending ? (
            <View className="rounded-full bg-blue-500 px-2 py-1">
              <AppText weight="bold" className="text-[10px] text-white">
                Pending
              </AppText>
            </View>
          ) : null}
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.extends.colors.text.tertiary}
          />
        </View>
      </View>
    </Pressable>
  );
}
