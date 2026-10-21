import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";

export default function DuplicateResubmissionWarning() {
  return (
    <InfoBanner
      title="Before you resubmit"
      variant="warning"
      icon="alert-outline"
    >
      <AppText className="text-sm leading-5 text-text-secondary">
        Submitting the same information without additional clarification may
        result in another rejection.
      </AppText>
    </InfoBanner>
  );
}
