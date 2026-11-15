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
import { hasPaidMerchantPlus } from "../../utils/merchantPlusPayment";

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
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={access.isFetching}
            onRefresh={() => void access.refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      >
        {/* Offer identity */}
        <View className="gap-3 bg-surface px-5 py-6">
          <View className="flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={21}
              color={theme.extends.colors.brand}
              accessible={false}
            />
            <AppText weight="bold" className="text-sm text-text-primary">
              Merchant Plus
            </AppText>
          </View>
          <AppText
            weight="bold"
            className="text-2xl leading-8 text-text-primary"
          >
            {paidActive
              ? "Your Merchant Plus access"
              : "More insight into your business."}
          </AppText>
          <AppText className="text-sm leading-6 text-text-secondary">
            {paidActive
              ? "Explore your unlocked analytics and view your access period."
              : "Make more informed decisions with deeper business analytics."}
          </AppText>
        </View>
        {!access.error && status?.access_source === "preview" && (
          <View className="bg-surface px-5 pb-4">
            <AppText className="text-sm text-text-secondary">
              Analytics preview is enabled for testing. Merchant Plus has not
              been purchased.
            </AppText>
          </View>
        )}
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
        ) : paidActive || unresolved ? (
          <View className="px-5 py-5">
            <MerchantPlusPaymentState
              status={status}
              onCheck={() => router.push("/(merchant)/merchant-plus/return")}
              onContinue={() => router.replace("/(merchant)/(tabs)/analytics")}
            />
          </View>
        ) : null}
        {/* Feature rows follow existing merchant information sections. */}
        {access.state !== "loading" && (
          <View className="mt-2 gap-6 bg-surface px-5 py-6">
            <AppText weight="bold" className="text-base text-text-primary">
              {paidActive
                ? "Included with your access"
                : "A closer look at your business"}
            </AppText>
            <MerchantPlusFeatures />
          </View>
        )}
        {!paidActive &&
          !canPurchase &&
          access.state !== "loading" &&
          !access.error &&
          !unresolved && (
            <View className="mt-2 gap-2 bg-surface px-5 py-6">
              <AppText weight="bold" className="text-xl text-text-primary">
                ₱1.00 for 30 days
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                One-time payment · No automatic renewal
              </AppText>
              <AppText className="text-xs leading-5 text-text-secondary">
                Sandbox payment for capstone testing
              </AppText>
            </View>
          )}
      </ScrollView>
      {/* Safe-area-aware checkout action */}
      {canPurchase && (
        <View className="gap-2 border-t border-border-primary bg-surface px-5 py-4">
          {!resume && (
            <View className="mb-2 gap-1">
              <AppText weight="bold" className="text-base text-text-primary">
                ₱1.00 for 30 days
              </AppText>
              <AppText className="text-xs leading-5 text-text-secondary">
                One-time payment · No automatic renewal
              </AppText>
              <AppText className="text-xs leading-5 text-text-secondary">
                Sandbox payment for capstone testing
              </AppText>
            </View>
          )}
          <Button
            title={
              checkout.phase === "preparing"
                ? "Preparing secure checkout…"
                : checkout.phase === "opening"
                  ? "Opening Maya Checkout…"
                  : resume
                    ? "Continue checkout"
                    : "Pay ₱1.00"
            }
            loading={checkout.busy}
            disabled={checkout.busy}
            onPress={checkout.startCheckout}
          />
          <AppText className="text-center text-xs leading-5 text-text-secondary">
            {checkout.phase === "preparing" ? "Preparing secure checkout…" : checkout.phase === "opening" ? "Opening Maya Checkout…" : "Secure checkout powered by Maya"}
          </AppText>
        </View>
      )}
      {!canPurchase &&
        !paidActive &&
        !unresolved &&
        access.state !== "loading" && !access.error && (
          <View className="border-t border-border-primary bg-surface px-5 py-4">
            <AppText className="text-sm text-text-secondary">
              Checkout is currently unavailable. Please check again later.
            </AppText>
          </View>
        )}
    </SafeAreaView>
  );
}
