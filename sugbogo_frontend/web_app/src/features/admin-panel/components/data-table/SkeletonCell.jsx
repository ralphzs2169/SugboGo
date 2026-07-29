/**
 * Renders a skeleton placeholder matching the column type.
 */
export default function SkeletonCell({ type }) {
  const base = "animate-pulse rounded bg-stroke";

  if (type === "number") {
    return <div className={`${base} h-4 w-8`} />;
  }

  if (type === "longText") {
    return (
      <div className="space-y-2">
        <div className={`${base} h-4 w-3/4`} />
        <div className={`${base} h-3 w-1/2`} />
      </div>
    );
  }

  if (type === "actions") {
    return (
      <div className="flex justify-center gap-2">
        <div className={`${base} h-8 w-8`} />
        <div className={`${base} h-8 w-8`} />
      </div>
    );
  }

  return <div className={`${base} h-4 w-full`} />;
}
