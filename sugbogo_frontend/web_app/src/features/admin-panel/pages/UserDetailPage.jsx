import { useState } from "react";
import { useParams } from "react-router-dom";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import UserAccountActions from "../users/components/detail/UserAccountActions";
import UserAccountInformation from "../users/components/detail/UserAccountInformation";
import UserActivitySummary from "../users/components/detail/UserActivitySummary";
import UserAdministrativeHistory from "../users/components/detail/UserAdministrativeHistory";
import UserDetailSkeleton from "../users/components/detail/UserDetailSkeleton";
import UserMerchantInformation from "../users/components/detail/UserMerchantInformation";
import UserRecentActivity from "../users/components/detail/UserRecentActivity";
import useUserActivity from "../users/hooks/useUserActivity";
import useUserAdministrativeHistory from "../users/hooks/useUserAdministrativeHistory";
import useUserDetail from "../users/hooks/useUserDetail";

export default function UserDetailPage() {
  const { userId } = useParams();
  const [historyPage, setHistoryPage] = useState(1);
  const handleBack = useNavigateBack("/admin-panel/users/all");

  const userQuery = useUserDetail(userId);
  const activityQuery = useUserActivity(userId, { limit: 20 });
  const historyQuery = useUserAdministrativeHistory(userId, {
    page: historyPage,
    page_size: 10,
  });

  useDocumentTitle(
    userQuery.user
      ? `${userQuery.user.name} | SugboGo Admin`
      : "User Details | SugboGo Admin",
  );

  useApiErrorNotification(userQuery.error, {
    toastId: `admin-user-${userId}-detail-load-error`,
    fallbackMessage: "Unable to load the user. Please try again.",
  });
  useApiErrorNotification(activityQuery.error, {
    toastId: `admin-user-${userId}-activity-load-error`,
    fallbackMessage: "Unable to load recent user activity.",
  });
  useApiErrorNotification(historyQuery.error, {
    toastId: `admin-user-${userId}-history-load-error`,
    fallbackMessage: "Unable to load administrative history.",
  });

  const user = userQuery.user;
  const breadcrumbs = [
    { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
    { label: "Management" },
    { label: "Users", href: "/admin-panel/users/all" },
    { label: user?.name || "User Details" },
  ];

  return (
    <DetailPageLayout
      breadcrumbs={breadcrumbs}
      title={user ? user.name : "User Details"}
      backLabel="Back to Users"
      onBack={handleBack}
      isLoading={userQuery.isLoading}
      error={userQuery.error}
      hasData={Boolean(user)}
      onRetry={userQuery.refetch}
      loadingContent={<UserDetailSkeleton />}
      errorTitle="User unavailable"
      errorMessage="The user could not be loaded. They may not exist or you may not have access."
    >
      {user && (
        <div className="space-y-6 pb-12">
          <UserAccountInformation user={user} />
          <UserMerchantInformation
            application={user.application}
            business={user.business}
          />
          <UserActivitySummary summary={user.activity_summary} />
          <UserRecentActivity
            activities={activityQuery.activities}
            isLoading={activityQuery.isLoading}
            error={activityQuery.error}
            onRetry={activityQuery.refetch}
          />
          <UserAdministrativeHistory
            history={historyQuery.history}
            pagination={historyQuery.pagination}
            isLoading={historyQuery.isLoading}
            isFetching={historyQuery.isFetching}
            error={historyQuery.error}
            onRetry={historyQuery.refetch}
            onPageChange={setHistoryPage}
          />
          <UserAccountActions user={user} />
        </div>
      )}
    </DetailPageLayout>
  );
}
