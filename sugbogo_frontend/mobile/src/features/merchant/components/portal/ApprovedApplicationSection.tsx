import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import approvedApplicationAnimation from "../../assets/animations/approved-application.json";

type ApprovedApplicationSectionProps = {
  businessName: string;
  approvedAt: string;
};

/**
 * Welcomes a newly approved merchant and summarizes the
 * active merchant account information.
 *
 * Displays the approval state, business identity, and
 * approval date without owning the Merchant Mode transition.
 */
export default function ApprovedApplicationSection({
  businessName,
  approvedAt,
}: ApprovedApplicationSectionProps) {
  return (
    <View className="bg-surface px-6 pb-6">
      {/* Approval status hero */}
      <View className="items-center rounded-3xl bg-surface px-6 py-7">
        <LottieView
          source={approvedApplicationAnimation}
          autoPlay
          loop={false}
          style={{ width: 100, height: 100 }}
        />

        <View className="mt-4 rounded-full bg-success/10 px-3.5 py-1.5">
          <AppText
            weight="bold"
            className="text-xs uppercase tracking-wide text-success"
          >
            Merchant Approved
          </AppText>
        </View>

        <AppText
          weight="bold"
          className="mt-3 text-center text-2xl text-text-primary"
        >
          Welcome to SugboGo
        </AppText>

        <AppText className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Your merchant account is now active and ready to help you grow your
          business.
        </AppText>
      </View>

      {/* Approval details */}
      <View className="mt-4 rounded-md border border-border-primary bg-surface px-5 py-1">
        {/* Business */}
        <View className="flex-row items-center border-b border-border-primary/60 py-4">
          <MaterialCommunityIcons
            name="storefront-outline"
            size={25}
            color={theme.extends.colors.text.secondary}
          />

          <View className="ml-3 flex-1">
            <AppText
              weight="semibold"
              className="text-xs uppercase tracking-wide text-text-secondary"
            >
              Business
            </AppText>

            <AppText
              weight="bold"
              className="mt-0.5 text-base text-text-primary"
              numberOfLines={1}
            >
              {businessName}
            </AppText>
          </View>
        </View>

        {/* Approval date */}
        <View className="flex-row items-center py-4">
          <MaterialCommunityIcons
            name="calendar-check-outline"
            size={25}
            color={theme.extends.colors.text.secondary}
          />

          <View className="ml-3 flex-1">
            <AppText
              weight="semibold"
              className="text-xs uppercase tracking-wide text-text-secondary"
            >
              Approved On
            </AppText>

            <AppText
              weight="bold"
              className="mt-0.5 text-base text-text-primary"
            >
              {approvedAt}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
