import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { MerchantApplicationStatus } from "@/shared/types/userInformation.types";

const MERCHANT_PORTAL_HERO = require("../../merchant/assets/illustrations/merchant-portal-hero2.webp");

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
 * Adapts its messaging to the current merchant application status while
 * keeping the merchant portal action and branded illustration consistent.
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
      {/* Application status */}
      {badge && (
        <View
          className={`absolute -right-1 -top-3 z-10 max-w-full rounded-full px-2 py-0.5 ${badge.backgroundClassName}`}
        >
          <AppText weight="medium" className="shrink text-xs text-white">
            {badge.label}
          </AppText>
        </View>
      )}

      <View className="flex-row items-center">
        {/* Merchant illustration */}
        <View className="h-28 w-[120px] items-center justify-center">
          <Image
            source={MERCHANT_PORTAL_HERO}
            style={{
              width: 120,
              height: 130,
            }}
            contentFit="contain"
          />
        </View>

        {/* Merchant portal content */}
        <View className="min-w-0 flex-1 pl-3">
          <AppText
            weight="extrabold"
            className="text-sm uppercase tracking-wide text-white"
          >
            {content.title}
          </AppText>

          <AppText className="mt-1 text-xs font-semibold text-white">
            {content.description}
          </AppText>

          <SafePressable
            onPress={onPress}
            className="mt-3 cursor-pointer flex-row items-center justify-center rounded-full bg-white px-3 py-2 active:opacity-70"
          >
            <AppText weight="bold" className="mr-2 text-xs text-brand">
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
