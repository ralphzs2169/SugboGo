import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import { theme } from "@/constants/theme";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  hasPaidMerchantPlus,
  merchantPlusExpiry,
} from "../../utils/merchantPlusPayment";
import MerchantPlusFeatures from "./MerchantPlusFeatures";

/** Provides a shared discovery card or quiet Business row, reflecting authoritative access. */
export default function MerchantPlusEntry({
  discovery = false,
}: {
  discovery?: boolean;
}) {
  const access = useMerchantPlusAccess();
  const expiry = merchantPlusExpiry(access.status?.entitlement_expires_at);
  const openPlus = () => router.push("/(merchant)/merchant-plus");
  if (access.state === "loading") {
    return (
      <View className="bg-surface px-5 py-4">
        <Skeleton
          className={discovery ? "h-64 rounded-card" : "h-24 rounded-card"}
        />
      </View>
    );
  }
  const active = !access.error && hasPaidMerchantPlus(access.status);
  const preview = access.status?.access_source === "preview";
  const demo = access.status?.access_source === "mock";
  const unresolved = !!access.status?.unresolved_payment_id;

  if (discovery && !active && !access.error && !unresolved) {
    return (
      <View className="bg-surface px-5 pb-3 pt-4">
        <View className="gap-3 rounded-card border border-border-primary bg-background p-3">
          {/* Offer identity and included analytics */}
          <View className="gap-1.5">
            <View className="flex-row items-center gap-2">
              <View className="h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <MaterialCommunityIcons
                  name="plus-circle-outline"
                  size={18}
                  color={theme.extends.colors.brand}
                  accessible={false}
                />
              </View>
              <AppText
                accessibilityRole="header"
                weight="bold"
                className="min-w-0 flex-1 text-base text-text-primary"
              >
                Merchant Plus
              </AppText>
            </View>
            <AppText className="text-sm leading-5 text-text-secondary">
              Compare your business, spot trends, and get tailored
              recommendations.
            </AppText>
          </View>
          <MerchantPlusFeatures compact />

          {/* Purchase terms and navigation */}
          <View className="gap-2.5 border-t border-border-primary pt-2.5">
            <View className="border-l-2 border-brand pl-2">
              <AppText
                weight="extrabold"
                className="text-base text-text-primary"
              >
                ₱1.00 for 30 days
              </AppText>
              <AppText className="text-small text-text-secondary">
                One-time payment · No automatic renewal
              </AppText>
            </View>
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="Explore Merchant Plus"
              onPress={openPlus}
              className="min-h-12 cursor-pointer flex-row items-center justify-center gap-2 rounded-btn bg-brand px-3 py-2.5 active:opacity-80"
            >
              <AppText
                weight="extrabold"
                className="min-w-0 shrink text-center text-sm text-text-primary"
              >
                Explore Merchant Plus
              </AppText>
              <MaterialCommunityIcons
                name="arrow-right"
                size={17}
                color={theme.extends.colors.text.primary}
                accessible={false}
              />
            </SafePressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-surface px-5 py-4">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? "View Merchant Plus access" : "Explore Merchant Plus"
        }
        onPress={openPlus}
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
        <AppText className="mt-1 text-sm text-text-secondary">
          Advanced business analytics
        </AppText>
        <AppText weight="semibold" className="mt-2 text-xs text-text-primary">
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
      </SafePressable>
    </View>
  );
}
