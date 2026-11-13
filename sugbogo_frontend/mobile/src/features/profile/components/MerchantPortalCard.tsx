import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
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
    backgroundClassName: "bg-slate-600",
  },
  submitted: {
    label: "Pending Review",
    backgroundClassName: "bg-blue-700",
  },
  rejected: {
    label: "Rejected",
    backgroundClassName: "bg-red-700",
  },
  approved: {
    label: "Approved",
    backgroundClassName: "bg-green-700",
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
          className={`absolute -right-1 -top-3 z-10 max-w-full rounded-full px-2 py-0.5 ${badge.backgroundClassName}`}
        >
          <AppText
            weight="medium"
            className="shrink text-xs text-white"
          >
            {badge.label}
          </AppText>
        </View>
      )}

      <View className="flex-row items-center">
        <View>
          <MerchantIllustration width={120} height={112} />
        </View>

        <View className="min-w-0 flex-1 pl-3">
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
