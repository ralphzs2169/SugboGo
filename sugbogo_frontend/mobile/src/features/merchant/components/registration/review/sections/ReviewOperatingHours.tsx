import { View, Text } from "react-native";
import type { z } from "zod";

import { DAYS } from "@/features/merchant/constants/registration/operatingHours.constants";
import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

import ReviewSection from "../ReviewSection";
import ReviewRow from "../ReviewRow";
import StatusBadge from "../../operating-hours/StatusBadge";

type ReviewForm = z.input<typeof merchantRegistrationSchema>;
type ReviewOperatingHoursProps = {
  form: ReviewForm;
  onEdit?: () => void;
};

const formatDay = (day: string) => day.charAt(0).toUpperCase() + day.slice(1);

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes} ${period}`;
};

export default function ReviewOperatingHours({
  form,
  onEdit,
}: ReviewOperatingHoursProps) {
  const operatingHours = form.operatingHours;

  return (
    <ReviewSection icon="clock-outline" title="Operating Hours" onEdit={onEdit}>
      <View className="gap-2">
        {DAYS.map((day) => {
          const schedule = operatingHours[day];

          let value = "—";

          if (schedule.isOpen) {
            value = schedule.is24Hours
              ? "Open 24 hours"
              : `${formatTime(schedule.openTime)} – ${formatTime(
                  schedule.closeTime,
                )}`;
          }

          return (
            <ReviewRow
              key={day}
              label={
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-text-secondary">
                    {formatDay(day)}
                  </Text>
                  <StatusBadge isOpen={schedule.isOpen} />
                </View>
              }
              value={value}
            />
          );
        })}
      </View>
    </ReviewSection>
  );
}
