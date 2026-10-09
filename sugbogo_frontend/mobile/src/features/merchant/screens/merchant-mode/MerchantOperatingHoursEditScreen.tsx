import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { z } from "zod";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import OperatingHoursWeek from "../../components/operating-hours/OperatingHoursWeek";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateMerchantOperatingHours from "../../hooks/business-profile/useUpdateMerchantOperatingHours";
import { buildHoursPayload } from "../../utils/operatingHours.utils";
import { mapBusinessHoursToForm } from "../../utils/mapBusinessHoursToForm.utils";
import {
  operatingHoursSchema,
  type OperatingHoursForm,
} from "../../validation/operatingHours.schema";

const editSchema = z.object({
  operatingHours: operatingHoursSchema,
});

/**
 * Allows merchants to edit their business's weekly operating hours.
 *
 * Displays full-width update guidance, initializes the existing schedule,
 * validates changes, and saves updates without administrator approval.
 * Suspended businesses cannot edit their operating hours.
 */
export default function MerchantOperatingHoursEditScreen() {
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const initializedBusinessId = useRef<number | null>(null);

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();

  const { updateOperatingHours, isSaving } = useUpdateMerchantOperatingHours(
    business?.id,
  );

  const form = useForm<OperatingHoursForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      operatingHours: mapBusinessHoursToForm([]),
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (!business || initializedBusinessId.current === business.id) {
      return;
    }

    initializedBusinessId.current = business.id;

    reset({
      operatingHours: mapBusinessHoursToForm(business.operating_hours),
    });
  }, [business, reset]);

  async function submitValues(values: OperatingHoursForm) {
    if (savingRef.current || !business || business.status !== "active") {
      return;
    }

    savingRef.current = true;

    try {
      await updateOperatingHours(buildHoursPayload(values.operatingHours));

      Toast.show({
        type: "success",
        text1: "Operating hours updated",
      });

      router.back();
    } catch (caught) {
      const response = caught as ApiError;

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
      savingRef.current = false;
    }
  }

  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading Operating Hours"
        description="Fetching your current schedule..."
      />
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
                  Changes to your operating hours don't require administrator
                  approval. Your updated schedule will appear on your business
                  listing after saving.
                </AppText>
              </View>
            </View>
          </View>

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
            onPress={() => router.back()}
            disabled={isSaving || form.formState.isSubmitting}
            rounded="full"
          />

          <Button
            title="Save Changes"
            className="flex-1"
            onPress={() => void form.handleSubmit(submitValues)()}
            loading={isSaving || form.formState.isSubmitting}
            rounded="full"
          />
        </View>
      </View>
    </FormProvider>
  );
}
