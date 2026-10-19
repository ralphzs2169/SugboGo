import { useState } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type { MerchantBusinessSpecialty } from "../../types/merchantBusinessProfile.types";
import type { PlusSpecialtyReport } from "../../types/merchantPlusAnalytics.types";
import { formatAnalyticsTimestamp } from "../../utils/merchantAnalytics.utils";
import AnalyticsSeriesChart from "./AnalyticsSeriesChart";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsDetailContext from "./AnalyticsDetailContext";

/** Adds per-specialty creation cohorts without replacing current Standard rankings. */
export default function AnalyticsSpecialtyTrends({
  report,
  tags,
}: {
  report: PlusSpecialtyReport;
  tags: MerchantBusinessSpecialty[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected =
    report.specialties.find(
      (specialty) => specialty.specialty_id === selectedId,
    ) ?? report.specialties[0];
  const selectedTag = tags.find((tag) => tag.id === selected?.specialty_id);
  const selectedColor = selectedTag
    ? getSpecialtyTagColor(selectedTag.color).softIcon
    : theme.extends.colors.brand;

  return (
    <View className="gap-4">
      {/* Specialty controls reuse the real profile's icon/color identity. */}
      <View className="gap-2">
        {report.specialties.map((specialty) => {
          const tag = tags.find((item) => item.id === specialty.specialty_id);
          const colors = tag ? getSpecialtyTagColor(tag.color) : null;
          const active = selected?.specialty_id === specialty.specialty_id;
          return (
            <Pressable
              key={specialty.specialty_id}
              accessibilityRole="button"
              accessibilityLabel={`Specialty: ${specialty.specialty_name}`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedId(specialty.specialty_id)}
              className={`min-h-12 flex-row items-center gap-3 rounded-xl border px-3 py-3 active:opacity-70 ${active ? "border-brand bg-brand/10" : "border-border-primary bg-surface"}`}
            >
              <MaterialCommunityIcons
                accessible={false}
                name={getSpecialtyTagIcon(tag?.icon)}
                size={22}
                color={colors?.softIcon ?? theme.extends.colors.text.secondary}
              />
              <AppText
                weight={active ? "bold" : "medium"}
                className="min-w-0 flex-1 text-sm text-text-primary"
              >
                {specialty.specialty_name}
              </AppText>
              {active && (
                <MaterialCommunityIcons
                  accessible={false}
                  name="check-circle"
                  size={20}
                  color={theme.extends.colors.brand}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      {selected ? (
        <View className="gap-3">
          <AppText weight="bold" className="text-lg text-text-primary">
            {selected.specialty_name}
          </AppText>
          <AppText
            accessibilityLabel={`${selected.specialty_name}: ${selected.added_and_still_valid} vouches added in this period that still count, ${selected.distinct_supporters} supporting accounts`}
            className="text-sm leading-5 text-text-secondary"
          >
            {selected.added_and_still_valid.toLocaleString("en-PH")} vouches
            added during these dates that still count ·{" "}
            {selected.distinct_supporters.toLocaleString("en-PH")} supporting
            accounts
          </AppText>
          <AnalyticsSeriesChart
            key={selected.specialty_id}
            label={`${selected.specialty_name} vouches added that still count`}
            interval="weekly"
            range={report.meta.period}
            color={selectedColor}
            total={selected.added_and_still_valid}
            emptyTitle="No vouches from these dates still count"
            emptyDescription="No vouches added during these dates still qualify for this specialty. Current support is shown separately in Analytics."
            points={selected.series.map((bucket) => ({
              ...bucket,
              value: bucket.added_and_still_valid,
            }))}
          />
        </View>
      ) : (
        <AnalyticsChartEmptyState
          title="No active specialties to report"
          description="Specialty trends will appear here when your business has active specialties."
          icon="tag-outline"
        />
      )}
      <AnalyticsDetailContext
        title="About specialty trends"
        meta={report.meta}
        note={`Counts include vouches added during the selected dates that still qualify as of ${formatAnalyticsTimestamp(report.snapshot_as_of)} · Manila time. They do not show net growth or past support totals. Removed vouches and inactive specialties can change earlier counts.`}
      />
    </View>
  );
}
