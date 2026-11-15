import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import { theme } from "@/constants/theme";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import { hasPaidMerchantPlus, merchantPlusExpiry } from "../../utils/merchantPlusPayment";
import MerchantPlusFeatures from "./MerchantPlusFeatures";

/** Provides a shared discovery card or quiet Business row, reflecting authoritative access. */
export default function MerchantPlusEntry({
  discovery = false,
}: {
  discovery?: boolean;
}) {
  const access = useMerchantPlusAccess();
  const expiry = merchantPlusExpiry(access.status?.entitlement_expires_at);
  if (access.state === "loading") {
    return (
      <View className="bg-surface px-5 py-4">
        <Skeleton
          className={discovery ? "h-80 rounded-card" : "h-24 rounded-card"}
        />
      </View>
    );
  }
  const active = !access.error && hasPaidMerchantPlus(access.status);
  const preview = access.status?.access_source === "preview";
  const demo = access.status?.access_source === "mock";
  const unresolved = !!access.status?.unresolved_payment_id;
  return (
    <View className="bg-surface px-5 py-4">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? "View Merchant Plus access" : "Explore Merchant Plus"
        }
        onPress={() => router.push("/(merchant)/merchant-plus")}
        className="min-h-16 cursor-pointer rounded-card border border-border-primary bg-background p-4 active:opacity-80"
      >
        {/* Identity and current access */}
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={20}
            color={theme.extends.colors.brand}
            accessible={false}
          />
          <AppText
            weight="bold"
            className="min-w-0 flex-1 text-base text-text-primary"
          >
            Merchant Plus
          </AppText>
          {(!discovery || active) && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          )}
        </View>
        {discovery && !active && !access.error && !unresolved ? (
          <>
            <AppText className="mt-2 text-sm leading-5 text-text-secondary">
              Compare your business, uncover deeper trends, and get tailored
              recommendations.
            </AppText>
            <View className="my-4">
              <MerchantPlusFeatures compact />
            </View>
            <View className="border-t border-border-primary pt-3">
              <AppText weight="bold" className="text-base text-text-primary">
                ₱1.00 for 30 days
              </AppText>
              <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                One-time payment · No automatic renewal
              </AppText>
              <View className="mt-3 min-h-11 flex-row items-center justify-between">
                <AppText weight="bold" className="text-sm text-text-primary">
                  Explore Merchant Plus
                </AppText>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color={theme.extends.colors.brand}
                  accessible={false}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <AppText className="mt-1 text-sm text-text-secondary">
              Advanced business analytics
            </AppText>
            <AppText
              weight="semibold"
              className="mt-2 text-xs text-text-primary"
            >
              {access.error
                ? "Check access status"
                : active
                  ? expiry
                    ? `Active until ${expiry}`
                    : "Access enabled"
                  : unresolved
                    ? "Purchase in progress · Check status"
                    : preview
                      ? "Not active · Analytics preview"
                      : demo
                        ? "Not active · Demo access"
                        : "Not active"}
            </AppText>
          </>
        )}
      </SafePressable>
    </View>
  );
}
