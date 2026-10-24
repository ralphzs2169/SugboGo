import { useSearchParams } from "react-router-dom";

import SuspiciousReviewWorkspace from "../../suspicious-reviews/components/SuspiciousReviewWorkspace";
import SuspiciousVouchWorkspace from "../../suspicious-vouches/components/SuspiciousVouchWorkspace";

export default function SuspiciousActivityWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activity = searchParams.get("suspicious_type") === "vouches" ? "vouches" : "reviews";

  function changeActivity(nextActivity) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("suspicious_type", nextActivity);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Suspicious activity type" className="inline-flex items-center rounded-lg bg-sidebar-active p-1">
        {[{ id: "reviews", label: "Reviews" }, { id: "vouches", label: "Vouches" }].map((item) => (
          <button key={item.id} type="button" aria-pressed={activity === item.id} onClick={() => changeActivity(item.id)} className={`cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-info ${activity === item.id ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {activity === "vouches" ? <SuspiciousVouchWorkspace /> : <SuspiciousReviewWorkspace />}
    </div>
  );
}
