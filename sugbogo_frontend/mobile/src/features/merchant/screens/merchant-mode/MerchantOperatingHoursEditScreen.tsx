import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { z } from "zod";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useMerchantEditorExit from "../../hooks/useMerchantEditorExit";
import MerchantBusinessEditSkeleton from "../../components/business-profile/MerchantBusinessEditSkeleton";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import OperatingHoursWeek from "../../components/operating-hours/OperatingHoursWeek";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateMerchantOperatingHours from "../../hooks/business-profile/useUpdateMerchantOperatingHours";
import { buildHoursPayload } from "../../utils/operatingHours.utils";
import { mapBusinessHoursToForm } from "../../utils/mapBusinessHoursToForm.utils";
import {
  editedOperatingDays,
  operatingHoursSnapshotKey,
} from "../../utils/operatingHoursEdit.utils";
import OperatingHoursSummary from "../../components/operating-hours/OperatingHoursSummary";
import type { MerchantBusinessOperatingHours } from "../../types/merchantBusinessProfile.types";
import {
  operatingHoursSchema,
  type OperatingHours,
  type OperatingHoursForm,
} from "../../validation/operatingHours.schema";

const editSchema = z.object({
  operatingHours: operatingHoursSchema,
});

/**
 * Allows merchants to edit their business's weekly operating hours.
 *
 * Refreshes pristine values, preserves dirty drafts, and reconciles concurrent
 * schedule changes explicitly before saving without administrator approval.
 * Suspended businesses cannot edit their operating hours.
 */
export default function MerchantOperatingHoursEditScreen() {
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const reconcilingRef = useRef(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliation, setReconciliation] = useState<{
    businessId: number;
    hours: MerchantBusinessOperatingHours[];
    values: OperatingHours;
    draft: OperatingHours;
    editedDays: ReturnType<typeof editedOperatingDays>;
  } | null>(null);

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();
  const [baseline, setBaseline] = useState(() => ({
    businessId: business?.id ?? null,
    hours: business?.operating_hours ?? [],
    values: mapBusinessHoursToForm(business?.operating_hours ?? []),
  }));

  const { updateOperatingHours, isSaving: isMutationPending } =
    useUpdateMerchantOperatingHours(business?.id);
  const isSaving = isMutationPending || isSubmittingSchedule;

  const form = useForm<OperatingHoursForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      operatingHours: baseline.values,
    },
    disabled: isSaving || isReconciling || reconciliation !== null,
  });

  const { reset } = form;
  const draft = useWatch({ control: form.control, name: "operatingHours" });
  const hasChanges = editedOperatingDays(baseline.values, draft).length > 0;
  const serverChanged = Boolean(
    business &&
    business.id === baseline.businessId &&
    operatingHoursSnapshotKey(business.operating_hours) !==
      operatingHoursSnapshotKey(baseline.hours),
  );
  const hasConflict = Boolean(conflictMessage || (hasChanges && serverChanged));
  const exit = useMerchantEditorExit(
    hasChanges,
    isSaving || form.formState.isSubmitting || isReconciling,
    () => savingRef.current || reconcilingRef.current,
  );

  useEffect(() => {
    if (
      !business ||
      (baseline.businessId === business.id &&
        (hasChanges ||
          !serverChanged ||
          savingRef.current ||
          reconcilingRef.current))
    ) {
      return;
    }

    const values = mapBusinessHoursToForm(business.operating_hours);
    setBaseline({
      businessId: business.id,
      hours: business.operating_hours,
      values,
    });
    reset({ operatingHours: values });
    setConflictMessage(null);
    setReconciliation(null);
  }, [baseline.businessId, business, hasChanges, reset, serverChanged]);

  async function reviewLatestHours() {
    if (!business || savingRef.current || reconcilingRef.current) {
      return;
    }
    reconcilingRef.current = true;
    setIsReconciling(true);
    try {
      const result = await refetch();
      if (
        result.error ||
        !result.data ||
        result.data.id !== baseline.businessId
      ) {
        setConflictMessage(
          "Unable to refresh operating hours. Your draft is kept. Try again when connected.",
        );
        return;
      }
      const currentDraft = form.getValues("operatingHours");
      setReconciliation({
        businessId: result.data.id,
        hours: result.data.operating_hours,
        values: mapBusinessHoursToForm(result.data.operating_hours),
        draft: currentDraft,
        editedDays: editedOperatingDays(baseline.values, currentDraft),
      });
    } finally {
      reconcilingRef.current = false;
      setIsReconciling(false);
    }
  }

  function reconcileHours() {
    if (!reconciliation || reconciliation.businessId !== business?.id) {
      return;
    }
    // Untouched days use the latest server values; edited days require this explicit choice.
    setBaseline({
      businessId: reconciliation.businessId,
      hours: reconciliation.hours,
      values: reconciliation.values,
    });
    reset({ operatingHours: reconciliation.values });
    for (const day of reconciliation.editedDays) {
      form.setValue(`operatingHours.${day}`, reconciliation.draft[day], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setReconciliation(null);
    setConflictMessage(null);
  }

  async function submitValues(values: OperatingHoursForm) {
    if (
      savingRef.current ||
      !hasChanges ||
      hasConflict ||
      isReconciling ||
      reconciliation ||
      !business ||
      business.status !== "active"
    ) {
      return;
    }

    savingRef.current = true;
    setIsSubmittingSchedule(true);

    let finishing = false;
    try {
      const proposed = buildHoursPayload(values.operatingHours);
      const editedDays = editedOperatingDays(
        baseline.values,
        values.operatingHours,
      );
      await updateOperatingHours({
        // Preserve exact server values for untouched days, including time precision.
        hours: proposed.hours.map((schedule) =>
          !editedDays.includes(schedule.day)
            ? (baseline.hours.find((item) => item.day === schedule.day) ??
              schedule)
            : schedule,
        ),
        expected_hours: baseline.hours,
      });

      Toast.show({
        type: "success",
        text1: "Operating hours updated",
      });

      finishing = exit.finish();
    } catch (caught) {
      const response = caught as ApiError;

      if (response.code === "BUSINESS_OPERATING_HOURS_EDIT_CONFLICT") {
        setConflictMessage(response.message);
        return;
      }

      if (response.code === "VALIDATION_ERROR") {
        form.setError("operatingHours", {
          type: "server",
          message: response.message || "Please review your operating hours.",
        });
        return;
      }

      if (!handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to save operating hours",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      if (!finishing) {
        savingRef.current = false;
        setIsSubmittingSchedule(false);
      }
    }
  }

  const discardDialog = (
    <ConfirmModal
      visible={exit.showDiscard}
      title="Discard operating hours changes?"
      message="Your unsaved schedule will be lost."
      confirmText="Discard"
      cancelText="Keep Editing"
      destructive
      onCancel={exit.keepEditing}
      onConfirm={exit.discard}
    />
  );

  if (
    (isLoading && !business) ||
    (business && baseline.businessId !== business.id)
  ) {
    return (
      <>
        <MerchantBusinessEditSkeleton variant="hours" />
        {discardDialog}
      </>
    );
  }

  if (!business) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load operating hours"
          description={
            error ? "Please try again." : "Operating hours are unavailable."
          }
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
        {discardDialog}
      </View>
    );
  }

  if (business.status !== "active") {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          title="Editing unavailable"
          description="Operating hours cannot be edited while your business is suspended."
          primaryActionTitle="Go Back"
          onPrimaryAction={() => router.back()}
        />
        {discardDialog}
      </View>
    );
  }

  return (
    <FormProvider {...form}>
      <View className="flex-1 bg-surface">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Full-width operating hours information banner */}
          <View className="bg-info px-4 py-4">
            <View className="flex-row items-start">
              <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={theme.extends.colors.text.info}
                />
              </View>

              <View className="ml-3 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  About operating hours
                </AppText>

                <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                  Changes to your operating hours do not require administrator
                  approval. Your updated schedule will appear on your business
                  listing after saving.
                </AppText>
              </View>
            </View>
          </View>

          {/* Conflict recovery preserves the draft until the merchant reviews a merge. */}
          {hasConflict && !reconciliation ? (
            <View className="mt-5">
              <ErrorState
                size="section"
                title="Operating hours changed"
                description={
                  conflictMessage ??
                  "Newer hours are available. Your draft is kept. Review the latest schedule before saving."
                }
                primaryActionTitle={
                  isReconciling ? undefined : "Review latest hours"
                }
                onPrimaryAction={
                  isReconciling ? undefined : () => void reviewLatestHours()
                }
              />
            </View>
          ) : null}
          {reconciliation ? (
            <View className="mx-5 mt-5 gap-4 rounded-xl border border-border-primary p-4">
              <AppText weight="bold" className="text-base text-text-primary">
                Review your edited days
              </AppText>
              <AppText className="text-sm leading-5 text-text-secondary">
                Untouched days will use the latest hours. Compare your edits
                below before keeping them. Nothing is saved yet.
              </AppText>
              {reconciliation.editedDays.map((day) => (
                <View
                  key={day}
                  className="gap-2 border-t border-border-primary pt-3"
                >
                  <AppText
                    weight="semibold"
                    className="capitalize text-text-primary"
                  >
                    {day}
                  </AppText>
                  <View>
                    <AppText className="text-xs text-text-secondary">
                      Latest saved hours
                    </AppText>
                    <OperatingHoursSummary
                      schedule={reconciliation.values[day]}
                    />
                  </View>
                  <View>
                    <AppText className="text-xs text-text-secondary">
                      Your draft
                    </AppText>
                    <OperatingHoursSummary
                      schedule={reconciliation.draft[day]}
                    />
                  </View>
                </View>
              ))}
              <Button
                title="Keep my edited days"
                onPress={reconcileHours}
                rounded="full"
              />
              <Button
                title="Keep draft without merging"
                variant="outline"
                onPress={() => setReconciliation(null)}
                rounded="full"
              />
            </View>
          ) : null}

          {/* Weekly operating hours editor */}
          <View className="px-5 pt-5">
            <OperatingHoursWeek showScheduleError />
          </View>
        </ScrollView>

        {/* Persistent save and cancel actions */}
        <View
          className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button
            title="Cancel"
            variant="outline"
            className="flex-1"
            onPress={exit.requestExit}
            disabled={isSaving || form.formState.isSubmitting}
            rounded="full"
          />

          <Button
            title="Save Changes"
            className="flex-1"
            onPress={() => void form.handleSubmit(submitValues)()}
            loading={isSaving || form.formState.isSubmitting}
            disabled={
              !hasChanges ||
              hasConflict ||
              isReconciling ||
              reconciliation !== null
            }
            rounded="full"
          />
        </View>
        {discardDialog}
      </View>
    </FormProvider>
  );
}
