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
        Your application was rejected as a possible duplicate. Before resubmitting,
        check that your details clearly identify your business or branch.
      </AppText>
    </InfoBanner>
  );
}
