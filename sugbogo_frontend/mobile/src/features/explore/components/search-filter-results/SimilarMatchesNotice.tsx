import AppText from "@/shared/components/AppText";

/** Explains approximate results without inventing a corrected search term. */
export default function SimilarMatchesNotice() {
  return (
    <AppText className="mt-1 text-xs text-text-secondary">
      Showing similar matches
    </AppText>
  );
}
