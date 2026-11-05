import { useEffect, useRef, useState } from "react";
import UserAccountInformation from "./UserAccountInformation";
import UserMerchantInformation from "./UserMerchantInformation";
import UserActivitySummary from "./UserActivitySummary";
import UserDetailContextBar from "./UserDetailContextBar";

/** Arranges the compact profile beside role-relevant information at desktop widths. */
export default function UserDetailOverview({ user, accountNotice, accountActions, children }) {
  const profileRef = useRef(null);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    if (!profileRef.current || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContext(
          !entry.isIntersecting && entry.boundingClientRect.bottom <= 64,
        );
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(profileRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {showContext && (
        <div className="sticky top-16 z-30 h-0">
          <UserDetailContextBar user={user} />
        </div>
      )}
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-5">
        {accountNotice}
        <UserAccountInformation user={user} profileRef={profileRef} />
        {accountActions}
      </div>
      <div className="min-w-0 space-y-5">
        {user.role === "merchant" && (
          <UserMerchantInformation application={user.application} business={user.business} />
        )}
        <UserActivitySummary summary={user.activity_summary} role={user.role} />
        {children}
      </div>
    </div>
    </>
  );
}
