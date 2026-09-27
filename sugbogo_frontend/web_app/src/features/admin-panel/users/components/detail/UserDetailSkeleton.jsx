export default function UserDetailSkeleton() {
  return (
    <div className="space-y-6 pb-12" aria-label="Loading user details">
      {["account", "summary", "activity", "history"].map((section) => (
        <div key={section} className="animate-pulse">
          <div className="mb-4 h-3 w-36 rounded bg-surface" />
          <div className="h-36 rounded-xl border border-stroke bg-background p-6">
            <div className="h-4 w-48 rounded bg-surface" />
            <div className="mt-4 h-3 w-72 max-w-full rounded bg-surface" />
            <div className="mt-3 h-3 w-56 max-w-full rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}
