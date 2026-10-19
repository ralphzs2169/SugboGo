import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
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

/**
 * Displays current valid specialty support as a ranked comparison.
 *
 * Preserves specialty identities, real vouch and supporter counts,
 * and a shared zero baseline without treating bar lengths as percentages.
 */
export default function AnalyticsSpecialtySupport({
  report,
  onRetry,
  specialtyTags,
}: Props) {
  if (report.sources.domain.availability === "unavailable") {
    return (
      <ErrorState
        variant="analytics"
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

  const hasNoVouches = specialties.length > 0 && maximumVouches === 0;

  const tagsById = new Map(specialtyTags.map((tag) => [tag.id, tag]));

  if (specialties.length === 0 || hasNoVouches) {
    return (
      <AnalyticsChartEmptyState
        icon="thumb-up-outline"
        title={
          specialties.length === 0
            ? "No active specialties"
            : "No specialty vouches yet"
        }
        description={
          specialties.length === 0
            ? "Your active business specialties and their support will appear here."
            : "Valid vouches for your specialties will appear here."
        }
      />
    );
  }

  return (
    <View className="gap-4">
      {/* Ranked current specialty support */}
      {specialties.map((specialty, index) => {
        const tag = tagsById.get(specialty.specialty_id);

        const colors = tag ? getSpecialtyTagColor(tag.color) : null;

        const barWidth =
          maximumVouches > 0
            ? (specialty.valid_vouches / maximumVouches) * 100
            : 0;

        const vouchLabel = specialty.valid_vouches === 1 ? "vouch" : "vouches";

        const supporterLabel =
          specialty.distinct_supporters === 1
            ? "supporting account"
            : "supporting accounts";

        return (
          <View
            key={specialty.specialty_id}
            accessible
            accessibilityLabel={`${index + 1}. ${
              specialty.specialty_name
            }: ${formatAnalyticsCount(
              specialty.valid_vouches,
            )} valid ${vouchLabel}, ${formatAnalyticsCount(
              specialty.distinct_supporters,
            )} ${supporterLabel}`}
            className="gap-3"
          >
            {/* Specialty identity, supporter context, and vouch total */}
            <View className="flex-row items-center gap-3">
              <View
                className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  colors?.softBackground ?? "bg-surface-muted"
                }`}
              >
                <MaterialCommunityIcons
                  accessible={false}
                  name={getSpecialtyTagIcon(tag?.icon)}
                  size={21}
                  color={
                    colors?.softIcon ?? theme.extends.colors.text.secondary
                  }
                />
              </View>

              <View className="min-w-0 flex-1 gap-0.5">
                <AppText
                  weight="semibold"
                  className="text-sm leading-5 text-text-primary"
                >
                  {specialty.specialty_name}
                </AppText>

                <AppText className="text-xs leading-5 text-text-secondary">
                  {formatAnalyticsCount(specialty.distinct_supporters)}{" "}
                  {supporterLabel}
                </AppText>
              </View>

              <View className="shrink-0 items-end gap-0.5">
                <AppText weight="bold" className="text-xl text-text-primary">
                  {formatAnalyticsCount(specialty.valid_vouches)}
                </AppText>

                <AppText className="text-xs text-text-secondary">
                  {vouchLabel}
                </AppText>
              </View>
            </View>

            {/* Shared-scale bar comparing this specialty with the highest count */}
            <View
              testID={`specialty-support-bar-${specialty.specialty_id}`}
              accessible={false}
              className="h-2 overflow-hidden rounded-full bg-surface-muted"
            >
              <View
                className={`h-full rounded-full ${
                  colors?.background ?? "bg-text-secondary"
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
