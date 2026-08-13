import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import approvedApplicationAnimation from "../../assets/animations/approved-application.json";
import LottieView from "lottie-react-native";
import { theme } from "@/constants/theme";

type ApprovedApplicationSectionProps = {
  businessName: string;
  approvedAt: string;
  onOpenDashboard: () => void;
};

/**
 * Welcomes a newly approved merchant and summarizes the
 * active merchant account information.
 *
 * Provides a clear approval state, business identity,
 * approval date, and entry point to the merchant dashboard.
 */
export default function ApprovedApplicationSection({
  businessName,
  approvedAt,
  onOpenDashboard,
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
          <Text className="text-xs font-bold uppercase tracking-wide text-success">
            Merchant Approved
          </Text>
        </View>

        <Text className="mt-3 text-center text-2xl font-bold text-text-primary">
          Welcome to SugboGo
        </Text>

        <Text className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Your merchant account is now active and ready to help you grow your
          business.
        </Text>
      </View>

      {/* Approval details */}
      <View className="mt-4 rounded-2xl border border-border-primary bg-surface px-5 py-1">
        {/* Business */}
        <View className="flex-row items-center border-b border-border-primary/60 py-4">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand">
            <MaterialCommunityIcons
              name="storefront-outline"
              size={21}
              color="white"
            />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Business
            </Text>

            <Text
              className="mt-0.5 text-base font-bold text-text-primary"
              numberOfLines={1}
            >
              {businessName}
            </Text>
          </View>
        </View>

        {/* Approval date */}
        <View className="flex-row items-center py-4">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-success">
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={21}
              color="white"
            />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Approved On
            </Text>

            <Text className="mt-0.5 text-base font-bold text-text-primary">
              {approvedAt}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
