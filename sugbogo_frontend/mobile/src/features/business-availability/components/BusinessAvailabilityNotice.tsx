import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";
import type { BusinessAvailability } from "../services/businessAvailability.service";

/** Label saved information using receipts supplied by the owning screen, without live data fetching. */
export default function BusinessAvailabilityNotice({
  record,
  online = false,
  error,
  onRetry,
}: {
  record?: BusinessAvailability;
  online?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <InfoBanner
      title={
        record?.state === "unavailable"
          ? "Business currently unavailable"
          : "Saved information"
      }
      variant={record?.state === "unavailable" ? "warning" : "info"}
      actionTitle={error && online ? "Retry availability check" : undefined}
      onAction={onRetry}
    >
      {/* A receipt never claims current opening hours or freshly validated directions. */}
      <AppText className="text-sm leading-5 text-text-secondary">
        {record?.state === "unavailable"
          ? "This listing was confirmed unavailable. Your saved information has been preserved."
          : error
            ? "Unable to check availability. Your saved information is still readable."
            : !online || !record
              ? "Availability is not recently verified. This is historical saved information."
              : "The listing was available at the last check. Saved details and directions may have changed."}
      </AppText>
      {record && (
        <AppText className="text-xs text-text-secondary">
          Last confirmed {new Date(record.checkedAt).toLocaleString()}
        </AppText>
      )}
    </InfoBanner>
  );
}
