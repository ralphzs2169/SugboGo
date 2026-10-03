import { View } from "react-native";
import OperatingHoursWeek from "../../operating-hours/OperatingHoursWeek";
import RegistrationSection from "../RegistrationSection";
import useRegistrationErrorScroll from "@/features/merchant/hooks/registration/useRegistrationErrorScroll";

type OperatingHoursStepProps = {
  registerErrorScrollTarget: ReturnType<
    typeof useRegistrationErrorScroll
  >["registerErrorScrollTarget"];
};

/**
 * Renders the operating-hours step of merchant registration.
 *
 * Displays each day as an expandable section and allows merchants
 * to configure the schedule for individual days.
 *
 * Validation errors are shown on collapsed days and remain visible
 * inside the editor when a day is expanded.
 */
export default function OperatingHoursStep({
  registerErrorScrollTarget,
}: OperatingHoursStepProps) {
  return (
    <View className="bg-surface">
      <RegistrationSection
        icon="clock-outline"
        title="Operating Hours"
        description="Set your business hours for each day of the week."
        showBorder={false}
      >
        <OperatingHoursWeek
          registerDayTarget={(day) =>
            registerErrorScrollTarget(`operatingHours.${day}`)
          }
        />
      </RegistrationSection>
    </View>
  );
}
