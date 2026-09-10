import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";

import { theme } from "@/constants/theme";
import SafePressable from "@/shared/components/SafePressable";

import QuickRepliesIcon from "../../assets/icons/quick-replies.svg";
import ReviewDisputesIcon from "../../assets/icons/review-disputes.svg";

type Props = {
  pendingDisputeCount?: number;
  quickResponseCount?: number;
};

/**
 * Provides merchant-facing shortcuts to review management workflows.
 *
 * Keeps dispute moderation and reusable reply management separate from the
 * controls that operate directly on the review feed.
 */
export default function MerchantReviewManagement({
  pendingDisputeCount,
  quickResponseCount,
}: Props) {
  return (
    <View className="mt-6">
      {/* Section heading */}
      <AppText
        weight="bold"
        className="mb-3 text-xs  uppercase tracking-wide text-text-secondary"
      >
        Management
      </AppText>

      {/* Management shortcuts */}
      <View className="flex-row gap-3">
        <SafePressable
          onPress={() => router.push("../review-disputes")}
          accessibilityRole="button"
          accessibilityLabel="Open review disputes"
          className="min-h-36 flex-1 cursor-pointer rounded-card border border-border-primary bg-surface p-4 active:opacity-80"
        >
          <View className="flex-1">
            <View className="flex-row items-start justify-between">
              <View className="h-10 w-10 items-center justify-center">
                <ReviewDisputesIcon width={40} height={40} />
              </View>

              <MaterialCommunityIcons
                name="arrow-top-right"
                size={19}
                color={theme.extends.colors.text.tertiary}
              />
            </View>

            <AppText weight="bold" className="mt-4 text-sm  text-text-primary">
              Review disputes
            </AppText>

            <AppText className="mt-1 text-xs leading-4 text-text-secondary">
              {pendingDisputeCount !== undefined
                ? pendingDisputeCount === 1
                  ? "1 pending case"
                  : `${pendingDisputeCount} pending cases`
                : "View moderation cases"}
            </AppText>
          </View>
        </SafePressable>

        <SafePressable
          onPress={() => router.push("../reply-templates")}
          accessibilityRole="button"
          accessibilityLabel="Open quick responses"
          className="min-h-36 flex-1 cursor-pointer rounded-card border border-border-primary bg-surface p-4 active:opacity-80"
        >
          <View className="flex-1">
            <View className="flex-row items-start justify-between">
              <View className="h-10 w-10 items-center justify-center">
                <QuickRepliesIcon width={40} height={40} />
              </View>

              <MaterialCommunityIcons
                name="arrow-top-right"
                size={19}
                color={theme.extends.colors.text.tertiary}
              />
            </View>

            <AppText weight="bold" className="mt-4 text-sm  text-text-primary">
              Quick responses
            </AppText>

            <AppText className="mt-1 text-xs leading-4 text-text-secondary">
              {quickResponseCount !== undefined
                ? quickResponseCount === 1
                  ? "1 saved response"
                  : `${quickResponseCount} saved responses`
                : "Manage saved replies"}
            </AppText>
          </View>
        </SafePressable>
      </View>
    </View>
  );
}
