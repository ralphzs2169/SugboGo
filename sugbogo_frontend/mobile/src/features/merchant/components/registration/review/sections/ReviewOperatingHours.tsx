import { View } from "react-native";
import type { z } from "zod";

import { DAYS } from "@/features/merchant/constants/registration/operatingHours.constants";
import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

import ReviewSection from "../ReviewSection";
import { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";
import ReviewSectionFeedback from "../ReviewSectionFeedback";
import AppText from "@/shared/components/AppText";

type ReviewForm = z.input<typeof merchantRegistrationSchema>;
type ReviewOperatingHoursProps = {
  form: ReviewForm;
  onEdit?: () => void;
  feedback?: ApplicationFeedbackResponse;
};

const formatDay = (day: string) => day.charAt(0).toUpperCase() + day.slice(1);

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes} ${period}`;
};

/** Displays each day’s operating hours while preserving review feedback and editing. */
export default function ReviewOperatingHours({
  form,
  onEdit,
  feedback,
}: ReviewOperatingHoursProps) {
  const operatingHours = form.operatingHours;

  return (
    <ReviewSection icon="clock-outline" title="Operating Hours" onEdit={onEdit}>
      <ReviewSectionFeedback feedback={feedback} />
      {/* Daily operating schedules */}
      <View className="gap-2">
        {DAYS.map((day) => (
          <View
            key={day}
            className="flex-row items-center justify-between gap-4 rounded-xl bg-surface-muted px-4 py-4"
          >
            <View className="min-w-0 flex-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {formatDay(day)}
              </AppText>
            </View>
            <View className="max-w-[60%] items-end">
              <View className="flex-row items-center gap-1.5">
                {!operatingHours[day].isOpen && (
                  <View
                    accessible={false}
                    className="h-1.5 w-1.5 rounded-full bg-text-error"
                  />
                )}
                <AppText
                  weight={operatingHours[day].isOpen ? "semibold" : "regular"}
                  className="shrink text-right text-sm text-text-primary"
                >
                  {!operatingHours[day].isOpen
                    ? "Closed"
                    : operatingHours[day].is24Hours
                      ? "Open 24 hours"
                      : formatTime(operatingHours[day].openTime) +
                        " – " +
                        formatTime(operatingHours[day].closeTime)}
                </AppText>
              </View>
              {operatingHours[day].isOpen &&
                !operatingHours[day].is24Hours &&
                Boolean(operatingHours[day].openTime) &&
                Boolean(operatingHours[day].closeTime) &&
                operatingHours[day].closeTime <
                  operatingHours[day].openTime && (
                  <AppText className="mt-1 text-right text-xs text-text-secondary">
                    Closes the following day
                  </AppText>
                )}
            </View>
          </View>
        ))}
      </View>
    </ReviewSection>
  );
}
