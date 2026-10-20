import { useRef, useState } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, View } from "react-native";
import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import SafePressable from "@/shared/components/SafePressable";
import ErrorState from "@/shared/components/ErrorState";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import useMerchantAnalyticsExport from "../../hooks/analytics/useMerchantAnalyticsExport";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

/** Offers one explicit report-period choice before downloading and sharing a private PDF. */
export default function AnalyticsExport({ enabled }: { enabled: boolean }) {
  const sheet = useRef<BottomSheetModal>(null);
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  const exportReport = useMerchantAnalyticsExport(enabled);
  const error = exportReport.error as { message?: string } | null;
  return (
    <>
      {/* Export owns its selection because dashboard sections have independent periods. */}
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          exportReport.isPending ? "Preparing PDF…" : "Export PDF"
        }
        accessibilityHint="Choose a reporting period, then save or share your PDF"
        accessibilityState={{
          disabled: !enabled || exportReport.isPending,
          busy: exportReport.isPending,
        }}
        disabled={!enabled || exportReport.isPending}
        hitSlop={4}
        className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-background"
        onPress={() => sheet.current?.present()}
      >
        {exportReport.isPending ? (
          <ActivityIndicator
            size="small"
            color={theme.extends.colors.text.secondary}
          />
        ) : (
          <MaterialCommunityIcons
            name="download-outline"
            size={24}
            color={theme.extends.colors.text.primary}
            accessible={false}
          />
        )}
      </SafePressable>
      <Modal
        visible={!!error && enabled}
        transparent
        animationType="fade"
        onRequestClose={() => exportReport.reset()}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full rounded-2xl bg-surface p-5">
            <ErrorState
              variant="analytics"
              title="Unable to export PDF"
              description={error?.message ?? "Please try exporting again."}
              primaryActionTitle="Try again"
              onPrimaryAction={() => {
                exportReport.reset();
                sheet.current?.present();
              }}
            />
            <Button
              title="Close"
              variant="outline"
              onPress={() => exportReport.reset()}
            />
          </View>
        </View>
      </Modal>
      <SelectionBottomSheet
        sheetRef={sheet}
        title="Export PDF"
        description="Choose one period for all activity reports. Snapshots and stored review summaries keep their own dates."
        options={[
          { label: "Last 7 days", value: "7" },
          { label: "Last 30 days", value: "30" },
          { label: "Last 90 days", value: "90" },
        ]}
        selectedValue={period}
        onSelect={(value) => {
          if (value !== "7" && value !== "30" && value !== "90") return;
          setPeriod(value);
          exportReport.exportPdf(value);
        }}
      />
    </>
  );
}
