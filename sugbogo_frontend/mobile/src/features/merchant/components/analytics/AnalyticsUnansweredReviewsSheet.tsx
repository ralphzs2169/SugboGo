import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, type RefObject } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import { formatAnalyticsTimestamp } from "../../utils/merchantAnalytics.utils";

type AgeColors = {
  recent: string;
  waiting: string;
  overdue: string;
};

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  snapshotAsOf?: string | null;
  ageColors: AgeColors;
};

const SNAP_POINTS = ["62%", "85%"];

/**
 * Explains unanswered-review eligibility, age groups, and
 * current snapshot behavior using concise informational sections.
 *
 * Provides accessible dismissal, scrollable content, and
 * bottom safe-area protection within the modal sheet.
 */
export default function AnalyticsUnansweredReviewsSheet({
  sheetRef,
  snapshotAsOf,
  ageColors,
}: Props) {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const ageGroups = [
    {
      key: "recent",
      label: "Under 3 days",
      description: "Waiting less than 72 hours",
      color: ageColors.recent,
    },
    {
      key: "waiting",
      label: "3–6 days",
      description: "Waiting 72 hours to under 7 days",
      color: ageColors.waiting,
    },
    {
      key: "overdue",
      label: "7+ days",
      description: "Waiting 7 days or longer",
      color: ageColors.overdue,
    },
  ];

  const secondaryColor = theme.extends.colors.text.secondary;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
      }}
      handleIndicatorStyle={{
        backgroundColor: secondaryColor,
        opacity: 0.4,
      }}
    >
      {/* Scrollable content with bottom safe-area protection */}
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: 24,
          }}
        >
          <View className="gap-5 px-5 pt-2">
            {/* Sheet header and close action */}
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <AppText weight="bold" className="text-lg text-text-primary">
                  Reviews needing replies
                </AppText>

                <AppText className="text-sm leading-5 text-text-secondary">
                  Understand your unanswered review backlog.
                </AppText>
              </View>

              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Close review information"
                onPress={() => sheetRef.current?.dismiss()}
                className="h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color={secondaryColor}
                  accessible={false}
                />
              </SafePressable>
            </View>

            {/* Eligibility explanation */}
            <View className="gap-2.5">
              <View className="flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={18}
                    color={secondaryColor}
                    accessible={false}
                  />
                </View>

                <AppText weight="bold" className="text-sm text-text-primary">
                  What counts?
                </AppText>
              </View>

              <AppText className="text-sm leading-6 text-text-secondary">
                Published reviews that can receive a merchant reply but haven't
                received one yet.
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Reviews that are not published or cannot receive another reply
                are excluded.
              </AppText>
            </View>

            <View className="h-px bg-border-primary/60" />

            {/* Review-age definitions and matching chart colors */}
            <View className="gap-3">
              <View className="flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={19}
                    color={secondaryColor}
                    accessible={false}
                  />
                </View>

                <AppText weight="bold" className="text-sm text-text-primary">
                  How reviews are grouped
                </AppText>
              </View>

              <AppText className="text-sm leading-5 text-text-secondary">
                Based on how long each review has been waiting since it was
                created.
              </AppText>

              <View className="gap-3 pt-1">
                {ageGroups.map((group) => (
                  <View
                    key={group.key}
                    accessible
                    accessibilityLabel={`${group.label}. ${group.description}.`}
                    className="flex-row items-center gap-3"
                  >
                    <View
                      accessible={false}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 4,
                        backgroundColor: group.color,
                      }}
                    />

                    <View className="min-w-0 flex-1 gap-0.5">
                      <AppText
                        weight="semibold"
                        className="text-sm text-text-primary"
                      >
                        {group.label}
                      </AppText>

                      <AppText className="text-xs leading-5 text-text-secondary">
                        {group.description}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View className="h-px bg-border-primary/60" />

            {/* Current snapshot and reporting-period explanation */}
            <View className="gap-2.5">
              <View className="flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={19}
                    color={secondaryColor}
                    accessible={false}
                  />
                </View>

                <AppText weight="bold" className="text-sm text-text-primary">
                  Current review backlog
                </AppText>
              </View>

              <AppText className="text-sm leading-6 text-text-secondary">
                This is a snapshot of reviews waiting for your reply, regardless
                of when they were submitted.
              </AppText>

              <AppText className="text-sm leading-6 text-text-secondary">
                Changing the 7-, 30-, or 90-day analytics period won't affect
                these counts.
              </AppText>

              {snapshotAsOf ? (
                <View className="flex-row items-center gap-2 pt-1">
                  <MaterialCommunityIcons
                    name="update"
                    size={15}
                    color={secondaryColor}
                    accessible={false}
                  />

                  <AppText className="min-w-0 flex-1 text-xs text-text-secondary">
                    Updated {formatAnalyticsTimestamp(snapshotAsOf)} Manila time
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </BottomSheetScrollView>
      </SafeAreaView>
    </BottomSheetModal>
  );
}
