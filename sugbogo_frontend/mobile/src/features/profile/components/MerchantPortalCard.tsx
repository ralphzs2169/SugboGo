import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import colors from "tailwindcss/colors";
import MerchantIllustration from "../../merchant/assets/illustrations/merchant-portal-no-shadow.svg";

import { theme } from "@/constants/theme";
import type { MerchantApplicationStatus } from "@/shared/types/userInformation.types";
import SafePressable from "@/shared/components/SafePressable";
import AppText from "@/shared/components/AppText";

type MerchantPortalCardProps = {
  status: MerchantApplicationStatus | null;
  onPress: () => void;
};

const STATUS_BADGE_CONFIG = {
  draft: {
    label: "Draft",
    icon: "pencil-outline" as const,
    color: colors.orange[700],
    background: colors.orange[50],
  },
  submitted: {
    label: "Under Review",
    icon: "clock-outline" as const,
    color: colors.amber[800],
    background: colors.amber[50],
  },
  rejected: {
    label: "Rejected",
    icon: "alert-circle-outline" as const,
    color: colors.red[700],
    background: colors.red[50],
  },
  approved: {
    label: "Approved",
    icon: "check-circle-outline" as const,
    color: colors.green[700],
    background: colors.green[50],
  },
};

/**
 * Displays the user's merchant entry point from the explorer profile.
 *
 * The card adapts its content according to the current
 * merchant registration status.
 */
export default function MerchantPortalCard({
  status,
  onPress,
}: MerchantPortalCardProps) {
  const contentByStatus = {
    draft: {
      title: "Continue Your Registration",
      description:
        "Your merchant registration is in progress. Continue where you left off.",
      buttonTitle: "Continue Registration",
      illustration: MerchantIllustration,
    },
    submitted: {
      title: "Application Under Review",
      description:
        "Your merchant application has been submitted and is being reviewed.",
    },
    rejected: {
      title: "Changes Required",
      description:
        "Review the feedback, make the required changes, and resubmit.",
    },
    approved: {
      title: "You're a Merchant!",
      description:
        "Your business has been approved and is ready to reach more explorers.",
    },
  };

  const content = status
    ? contentByStatus[status]
    : {
        title: "Become a Merchant",
        description: "Digitize your shop and reach more explorers in Cebu.",
      };

  const badge = status ? STATUS_BADGE_CONFIG[status] : null;

  return (
    <View className="relative mx-4 mb-1.5 mt-3 rounded-l-[40px] rounded-r-md bg-[#ff860e]/90 p-4">
      {badge && (
        <View
          className="absolute -right-1 -top-3 z-10 flex-row items-center gap-1 rounded-full px-2.5 py-1"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 2,
            elevation: 2,
            backgroundColor: badge.background,
            borderColor: badge.color,
            borderWidth: 1,
          }}
        >
          <MaterialCommunityIcons name={badge.icon} size={12} color={badge.color} />
          <AppText
            weight="bold"
            className="text-[10px] uppercase tracking-wide"
            style={{ color: badge.color }}
          >
            {badge.label}
          </AppText>
        </View>
      )}

      <View className="flex-row items-center">
        <View>
          <MerchantIllustration width={120} height={112} />
        </View>

        <View className="flex-1 pl-3">
          <AppText
            weight="extrabold"
            className="text-sm  uppercase tracking-wide text-white"
          >
            {content.title}
          </AppText>

          <AppText className="mt-1 text-xs font-semibold text-white">
            {content.description}
          </AppText>

          <SafePressable
            className="mt-3 flex-row items-center justify-center bg-white px-3 py-2 rounded-full active:opacity-70 "
            onPress={onPress}
          >
            <AppText weight="bold" className="text-xs mr-2 text-brand">
              Open Merchant Portal
            </AppText>
            <MaterialCommunityIcons
              name="arrow-right"
              size={16}
              color={theme.extends.colors.brand}
            />
          </SafePressable>
        </View>
      </View>
    </View>
  );
}
