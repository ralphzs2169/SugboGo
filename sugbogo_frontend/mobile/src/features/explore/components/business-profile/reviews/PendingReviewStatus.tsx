import AppText from "@/shared/components/AppText";

/** Keeps routine author-only moderation feedback within the review card's rhythm. */
export default function PendingReviewStatus({
  delayed = false,
}: {
  delayed?: boolean;
}) {
  return (
    <AppText
      accessibilityLiveRegion="polite"
      className="mt-2 text-xs leading-5 text-text-secondary"
    >
      {delayed
        ? "Taking a little longer than usual · Only you can see this"
        : "Checking before publishing · Only you can see this"}
    </AppText>
  );
}
