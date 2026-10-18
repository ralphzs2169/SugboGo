import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import type { MerchantBusinessSpecialty } from "../../types/merchantBusinessProfile.types";
import {
  formatAnalyticsCount,
  rankSpecialtySupport,
} from "../../utils/merchantAnalytics.utils";

type Props = {
  report: MerchantStandardAnalytics;
  onRetry: () => void;
  specialtyTags: MerchantBusinessSpecialty[];
};

/** Compares valid vouch counts using each specialty's real identity and a shared zero baseline. */
export default function AnalyticsSpecialtySupport({
  report,
  onRetry,
  specialtyTags,
}: Props) {
  if (report.sources.domain.availability === "unavailable") {
    return (
      <ErrorState
        size="section"
        title="Specialty support unavailable"
        description="Your current specialty counts couldn't be loaded."
        primaryActionTitle="Retry"
        onPrimaryAction={onRetry}
      />
    );
  }

  const specialties = rankSpecialtySupport(report.specialty_support);
  const maximumVouches = Math.max(
    0,
    ...specialties.map((specialty) => specialty.valid_vouches),
  );
  const tagsById = new Map(specialtyTags.map((tag) => [tag.id, tag]));

  return (
    <View>
      {/* Complete current specialty ranking */}
      {specialties.length === 0 ? (
        <View className="py-4">
          <AppText weight="semibold" className="text-sm text-text-primary">
            No active specialties
          </AppText>
          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            Your active business specialties and their support will appear here.
          </AppText>
        </View>
      ) : (
        specialties.map((specialty, index) => {
          const tag = tagsById.get(specialty.specialty_id);
          const colors = tag ? getSpecialtyTagColor(tag.color) : null;
          const barWidth =
            maximumVouches > 0
              ? (specialty.valid_vouches / maximumVouches) * 100
              : 0;

          return (
            <View
              key={specialty.specialty_id}
              accessible
              accessibilityLabel={`${index + 1}. ${specialty.specialty_name}: ${formatAnalyticsCount(specialty.valid_vouches)} vouches that still count, ${formatAnalyticsCount(specialty.distinct_supporters)} supporting accounts`}
              className="pb-5"
            >
              {/* Specialty identity comes from the owned profile, counts from analytics */}
              <View className="flex-row items-center gap-3">
                <View
                  className={`h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors?.softBackground ?? "bg-surface-muted"}`}
                >
                  <MaterialCommunityIcons
                    accessible={false}
                    name={getSpecialtyTagIcon(tag?.icon)}
                    size={20}
                    color={
                      colors?.softIcon ?? theme.extends.colors.text.secondary
                    }
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <AppText
                    weight="semibold"
                    className="text-sm leading-5 text-text-primary"
                  >
                    {specialty.specialty_name}
                  </AppText>
                  <AppText className="mt-0.5 text-xs leading-5 text-text-secondary">
                    {formatAnalyticsCount(specialty.distinct_supporters)}{" "}
                    supporting{" "}
                    {specialty.distinct_supporters === 1
                      ? "account"
                      : "accounts"}
                  </AppText>
                </View>
                <View className="items-end">
                  <AppText weight="bold" className="text-xl text-text-primary">
                    {formatAnalyticsCount(specialty.valid_vouches)}
                  </AppText>
                  <AppText className="text-xs text-text-secondary">
                    {specialty.valid_vouches === 1 ? "vouch" : "vouches"}
                  </AppText>
                </View>
              </View>

              {/* Length compares counts with the highest specialty; it is not a customer percentage */}
              <View
                testID={`specialty-support-bar-${specialty.specialty_id}`}
                accessible={false}
                className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <View
                  className={`h-full rounded-full ${colors?.background ?? "bg-text-secondary"}`}
                  style={{ width: `${barWidth}%` }}
                />
              </View>
            </View>
          );
        })
      )}
      <AppText className="border-t border-border-primary pt-3 text-xs leading-5 text-text-secondary">
        Current vouches, unaffected by the selected dates. The longest bar has
        the most vouches. One account can support more than one specialty.
      </AppText>
    </View>
  );
}
