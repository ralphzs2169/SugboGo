import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessNameChangeStatus } from "../../types/businessNameChange.types";

const STATUS: Record<
  BusinessNameChangeStatus,
  {
    label: string;
    color: string;
    text: string;
    iconColor: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  pending: {
    label: "Pending review",
    color: "bg-info",
    text: "text-text-info",
    iconColor: theme.extends.colors.text.info,
    icon: "clock-outline",
  },
  approved: {
    label: "Approved",
    color: "bg-success/10",
    text: "text-green-700",
    iconColor: theme.extends.colors.border.success,
    icon: "check-circle-outline",
  },
  rejected: {
    label: "Rejected",
    color: "bg-error",
    text: "text-text-error",
    iconColor: theme.extends.colors.error,
    icon: "close-circle-outline",
  },
  withdrawn: {
    label: "Withdrawn",
    color: "bg-surface-muted",
    text: "text-text-secondary",
    iconColor: theme.extends.colors.text.secondary,
    icon: "undo-variant",
  },
};

/** Identifies each request state with text, icon, and the existing status palette. */
export default function BusinessNameChangeStatusBadge({
  status,
}: {
  status: BusinessNameChangeStatus;
}) {
  const style = STATUS[status];

  return (
    <View
      className={`self-start flex-row items-center rounded-full px-3 py-1.5 ${style.color}`}
      accessibilityLabel={`Request status: ${style.label}`}
    >
      <MaterialCommunityIcons
        name={style.icon}
        size={15}
        color={style.iconColor}
        accessible={false}
      />
      <AppText weight="bold" className={`ml-1.5 text-xs ${style.text}`}>
        {style.label}
      </AppText>
    </View>
  );
}
