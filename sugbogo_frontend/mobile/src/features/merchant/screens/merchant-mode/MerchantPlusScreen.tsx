import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import Skeleton from "@/shared/components/Skeleton";
import ErrorState from "@/shared/components/ErrorState";
import { theme } from "@/constants/theme";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import useMerchantPlusCheckout from "../../hooks/payments/useMerchantPlusCheckout";
import MerchantPlusFeatures from "../../components/merchant-plus/MerchantPlusFeatures";
import MerchantPlusPaymentState from "../../components/merchant-plus/MerchantPlusPaymentState";
import {
  hasPaidMerchantPlus,
  merchantPlusExpiry,
} from "../../utils/merchantPlusPayment";

/** Groups the fixed offer's price, length, and payment terms. */
function OfferPrice() {
  return (
    <View className="gap-1 rounded-card bg-background p-3">
      <View className="gap-0.5 border-l-2 border-brand pl-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <AppText weight="extrabold" className="text-2xl text-text-primary">
            ₱1.00
          </AppText>
          <AppText className="rounded-tag bg-surface-muted px-2 py-1 text-small text-text-secondary">
            Sandbox
          </AppText>
        </View>
        <AppText weight="bold" className="text-sm text-text-primary">
          30 days of Merchant Plus
        </AppText>
      </View>
      <AppText className="text-small leading-5 text-text-secondary">
        One-time payment · No automatic renewal
      </AppText>
    </View>
  );
}

/** Presents the fixed one-time offer and existing-purchase management from backend status. */
export default function MerchantPlusScreen() {
  const access = useMerchantPlusAccess();
  const checkout = useMerchantPlusCheckout();
  const status = access.status;
  const paidActive = !access.error && hasPaidMerchantPlus(status);
  const unresolved = !!status?.unresolved_payment_id;
  const resume =
    unresolved &&
    status?.unresolved_payment_provider === "maya" &&
    status?.unresolved_checkout_status === "ready" &&
    status?.checkout_outcome === "pending";
  const product = status?.product;
  const offerValid =
    product?.code === "merchant_plus" &&
    product?.currency === "PHP" &&
    product?.amount_centavos === 100 &&
    product?.access_duration_days === 30 &&
    product?.payment_type === "one-time";
  const canPurchase =
    !paidActive &&
    !access.error &&
    offerValid &&
    status?.checkout_enabled === true &&
    ((!unresolved && status.purchase_eligible === true) || resume);
  const showOffer =
    access.state !== "loading" && !access.error && !paidActive && !unresolved;
  const checkoutProgress =
    checkout.phase === "preparing"
      ? "Preparing secure checkout…"
      : checkout.phase === "opening"
        ? "Opening Maya Checkout…"
        : null;

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-surface"
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={access.isFetching}
            onRefresh={() => void access.refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      >
        {/* Access and purchase recovery */}
        {checkout.error ? (
          <View className="px-5 pt-5">
            <ErrorState
              size="section"
              title="Unable to open checkout"
              description="Your existing purchase is safe. Check its status before trying again."
              primaryActionTitle="Check payment status"
              onPrimaryAction={() =>
                router.push("/(merchant)/merchant-plus/return")
              }
            />
          </View>
        ) : null}
        {access.state === "loading" ? (
          <View className="gap-4 px-5 py-6">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </View>
        ) : access.error ? (
          <View className="px-5 py-5">
            <ErrorState
              size="section"
              title="Unable to check Merchant Plus"
              description="Please check your connection and try again."
              primaryActionTitle="Try again"
              onPrimaryAction={() => void access.refetch()}
            />
          </View>
        ) : paidActive ? (
          <View className="px-5 py-5">
            <View className="gap-4 rounded-card border border-border-primary bg-background p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={22}
                    color={theme.extends.colors.border.success}
                    accessible={false}
                  />
                </View>
                <AppText
                  accessibilityRole="header"
                  weight="extrabold"
                  className="min-w-0 flex-1 text-lg text-text-primary"
                >
                  Merchant Plus active
                </AppText>
              </View>
              <View className="gap-1 border-t border-border-primary pt-3">
                <AppText className="text-small text-text-secondary">
                  Active until
                </AppText>
                <AppText weight="bold" className="text-lg text-text-primary">
                  {merchantPlusExpiry(status?.entitlement_expires_at)}
                </AppText>
                <AppText className="text-sm text-text-secondary">
                  Your Plus analytics are unlocked.
                </AppText>
              </View>
              <Button
                title="View Analytics"
                textTone="primary"
                onPress={() => router.replace("/(merchant)/(tabs)/analytics")}
              />
            </View>
          </View>
        ) : unresolved ? (
          <View className="px-5 py-5">
            <MerchantPlusPaymentState
              status={status}
              onCheck={() => router.push("/(merchant)/merchant-plus/return")}
              onContinue={() => router.replace("/(merchant)/(tabs)/analytics")}
            />
          </View>
        ) : null}
        {/* Offer introduction and benefits */}
        {showOffer && (
          <View className="gap-4 px-5 pt-5">
            <View className="gap-1.5">
              <AppText
                accessibilityRole="header"
                weight="extrabold"
                className="text-2xl text-text-primary"
              >
                See more of what’s working.
              </AppText>
              <AppText className="text-sm leading-5 text-text-secondary">
                See how people find, visit, and support your business with
                deeper analytics.
              </AppText>
            </View>
            <MerchantPlusFeatures />
            {status?.access_source === "preview" && (
              <View className="flex-row items-start gap-2">
                <View className="mt-0.5 shrink-0">
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={15}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </View>
                <AppText className="min-w-0 flex-1 text-small leading-4 text-text-secondary">
                  <AppText weight="bold">Preview mode</AppText>
                  {" · Some Plus analytics are available in this test build."}
                </AppText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {/* Safe-area-aware checkout action */}
      {canPurchase && (
        <View className="gap-2 border-t border-border-primary bg-surface px-5 pb-3 pt-2.5">
          {!resume && <OfferPrice />}
          <Button
            title={
              checkoutProgress ?? (resume ? "Continue checkout" : "Pay ₱1.00")
            }
            textTone="primary"
            loading={checkout.busy}
            disabled={checkout.busy}
            onPress={checkout.startCheckout}
          />
          <AppText className="text-center text-xs leading-5 text-text-secondary">
            {checkoutProgress ?? "Secure checkout powered by Maya"}
          </AppText>
        </View>
      )}
      {!canPurchase && showOffer && (
        <View className="gap-2 border-t border-border-primary bg-surface px-5 pb-3 pt-2.5">
          <OfferPrice />
          <AppText className="text-sm text-text-secondary">
            Checkout is currently unavailable. Please check again later.
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}
