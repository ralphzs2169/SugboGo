import CompactBusinessListSkeleton from "../CompactBusinessListSkeleton";

/** Uses the same bounded compact-card placeholders as the Explore previews. */
export default function ExploreCollectionSkeleton() {
  return <CompactBusinessListSkeleton count={4} testID="collection-loading" />;
}
