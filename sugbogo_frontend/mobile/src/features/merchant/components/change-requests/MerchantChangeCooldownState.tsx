import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type Props = {
  description: string;
  cooldownDurationHours: number;
  cooldownUntil: string;
  onViewApprovedRequest: () => void;
  onGoBack: () => void;
};

function formatCooldownDuration(hours: number) {
  if (hours >= 168 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function formatAvailability(value: string) {
  const date = new Date(value);

  return {
    date: date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

/**
 * Presents an expected merchant request cooldown with clear eligibility timing.
 *
 * The state remains scrollable on short devices and keeps navigation actions
 * near the bottom without exposing the underlying editable request form.
 */
export default function MerchantChangeCooldownState({
  description,
  cooldownDurationHours,
  cooldownUntil,
  onViewApprovedRequest,
  onGoBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const availability = formatAvailability(cooldownUntil);

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-8"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Math.max(insets.bottom, 32),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          {/* Cooldown status */}
          <View className="items-center px-3">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-background">
              <MaterialCommunityIcons
                name="clock-outline"
                size={42}
                color={theme.extends.colors.text.secondary}
              />
            </View>
            <AppText
              weight="bold"
              className="mt-6 text-center text-xl text-text-primary"
            >
              Change temporarily unavailable
            </AppText>
            <AppText className="mt-3 text-center text-sm leading-6 text-text-secondary">
              {description}
            </AppText>
          </View>

          {/* Request availability */}
          <View className="mt-8 rounded-2xl border border-border-primary/70 bg-surface p-4">
            <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Request availability
              </AppText>
              <MaterialCommunityIcons
                name="clock-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </View>
            <View className="pt-4">
              <AppText className="text-xs text-text-secondary">
                Cooldown period
              </AppText>
              <AppText
                weight="semibold"
                className="mt-1 text-base text-text-primary"
              >
                {formatCooldownDuration(cooldownDurationHours)}
              </AppText>

              <AppText className="mt-5 text-xs text-text-secondary">
                Next available
              </AppText>
              <AppText weight="bold" className="mt-1 text-lg text-text-primary">
                {availability.date}
              </AppText>
              <AppText className="mt-0.5 text-sm text-text-secondary">
                {availability.time}
              </AppText>
            </View>
          </View>

          {/* Navigation actions */}
          <View className="mt-auto gap-3 pt-10">
            <Button
              title="View Approved Request"
              onPress={onViewApprovedRequest}
              rounded="full"
            />
            <Button
              title="Go Back"
              variant="outline"
              onPress={onGoBack}
              rounded="full"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
