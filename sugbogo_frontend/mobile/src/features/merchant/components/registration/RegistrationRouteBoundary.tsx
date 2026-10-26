import type { ReactNode } from "react";
import { Redirect, router, useSegments } from "expo-router";
import useCurrentApplication from "../../hooks/registration/useCurrentApplication";
import { useReviewLandmarksStore } from "../../stores/reviewLandmarksStore";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ErrorState from "@/shared/components/ErrorState";

/** Keeps legacy registration links aligned with the server application lifecycle. */
export default function RegistrationRouteBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const { application, isLoading, error, refetch } = useCurrentApplication();
  const segments = useSegments();
  const route = String(segments[segments.length - 1]);
  const previewSource = useReviewLandmarksStore((state) => state.returnTo);

  if (isLoading && !application)
    return (
      <LoadingScreen
        title="Loading Application"
        description="Checking your application status..."
      />
    );
  if (application?.status === "approved") {
    return <Redirect href="/(explorer)/profile/merchant-portal" />;
  }
  if (error && !application)
    return (
      <ErrorState
        title="Unable to check application status"
        description="Retry before editing your application."
        primaryActionTitle="Retry"
        onPrimaryAction={() => void refetch()}
        secondaryActionTitle="Back to Explorer"
        onSecondaryAction={() => router.replace("/(explorer)/(tabs)/explore")}
      />
    );
  if (application?.status === "submitted") {
    const readOnly =
      route === "submitted-application" ||
      route === "submission-success" ||
      (route === "review-landmarks" && previewSource === "application-summary");
    if (!readOnly)
      return (
        <Redirect href="/(explorer)/merchant-registration/submitted-application" />
      );
  }
  if (
    route === "submitted-application" &&
    application?.status !== "submitted"
  ) {
    return <Redirect href="/(explorer)/profile/merchant-portal" />;
  }
  return (
    <>
      {error && (
        <ErrorState
          size="section"
          title="Unable to refresh application status"
          description="Your last available application details are shown."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
        />
      )}
      {children}
    </>
  );
}
