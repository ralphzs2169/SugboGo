import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type Role = "explorer" | "merchant";

type RoleBadgeProps = {
  role: Role;
};

const ROLE_CONFIG = {
  explorer: {
    label: "Explorer",
    icon: "compass-outline",
    background: "bg-blue-100",
    text: "text-blue-600",
  },
  merchant: {
    label: "Merchant",
    icon: "storefront-outline",
    background: "bg-green-100",
    text: "text-green-600",
  },
} as const;

export default function RoleBadge({ role }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];

  return (
    <View
      className={`mt-2 flex-row items-center self-start rounded-full px-2.5 py-1 ${config.background}`}
    >
      <MaterialCommunityIcons
        name={config.icon}
        size={14}
        color={role === "explorer" ? "#2563EB" : "#16A34A"}
      />

      <Text className={`ml-1 text-xs font-semibold ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
}
