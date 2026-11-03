import type useMerchantBusinessStatus from "../../hooks/business-profile/useMerchantBusinessStatus";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import Skeleton from "@/shared/components/Skeleton";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

/** Show the merchant-facing explanation without blocking permitted read-only information. */
export default function MerchantBusinessStatusNotice({
  query,
  onViewBusiness,
}: {
  query?: ReturnType<typeof useMerchantBusinessStatus>;
  onViewBusiness?: () => void;
}) {
  useApiErrorNotification({
    error: query?.error,
    toastId: "merchant-business-status",
    title: "Unable to verify business status",
    fallbackMessage: "Please retry the status check.",
  });
  if (!query) return null;
  if (query.isPending && !query.data)
    return <Skeleton className="h-16 rounded-xl" />;
  return (
    <>
      {query.error && (
        <ErrorState
          size="section"
          title="Unable to verify business status"
          description="Showing previously confirmed information where available. Editing is unavailable until status can be verified."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void query.refetch()}
        />
      )}
      {query.data?.status === "suspended" && (
        <InfoBanner
          title="Business Suspended"
          variant="warning"
          actionTitle={onViewBusiness ? "View Business" : undefined}
          onAction={onViewBusiness}
        >
          {/* Only the owner-authorized status contract supplies this explanation. */}
          <AppText className="text-sm leading-5 text-text-secondary">
            Your business listing is currently suspended and unavailable to
            explorers.
          </AppText>
          {query.data.suspension_reason && (
            <AppText className="text-sm leading-5 text-text-primary">
              Reason: {query.data.suspension_reason}
            </AppText>
          )}
          <AppText className="text-sm leading-5 text-text-secondary">
            Business information editing is temporarily restricted. Your
            existing business data has been preserved.
          </AppText>
        </InfoBanner>
      )}
    </>
  );
}
