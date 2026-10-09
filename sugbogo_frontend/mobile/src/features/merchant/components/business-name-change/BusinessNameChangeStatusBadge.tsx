import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { BusinessNameChangeStatus } from "../../types/businessNameChange.types";

const STATUS: Record<
  BusinessNameChangeStatus,
  {
    label: string;
    color: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  pending: {
    label: "Pending review",
    color: "bg-blue-500",
    icon: "clock-outline",
  },
  approved: {
    label: "Approved",
    color: "bg-emerald-500",
    icon: "check-circle-outline",
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-500",
    icon: "close-circle-outline",
  },
  withdrawn: { label: "Withdrawn", color: "bg-gray-500", icon: "undo-variant" },
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
      <MaterialCommunityIcons name={style.icon} size={15} color="#FFFFFF" />
      <AppText weight="bold" className="ml-1.5 text-xs text-white">
        {style.label}
      </AppText>
    </View>
  );
}
