import { useParams } from "react-router-dom";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import UserAccountActions from "../users/components/detail/UserAccountActions";
import UserDetailOverview from "../users/components/detail/UserDetailOverview";
import UserAdministrativeHistory from "../users/components/detail/UserAdministrativeHistory";
import UserDetailSkeleton from "../users/components/detail/UserDetailSkeleton";
import UserRecentActivity from "../users/components/detail/UserRecentActivity";
import useUserActivity from "../users/hooks/useUserActivity";
import useUserAdministrativeHistory from "../users/hooks/useUserAdministrativeHistory";
import useUserDetail from "../users/hooks/useUserDetail";

export default function UserDetailPage() {
  const { userId } = useParams();

  return <UserDetailContent key={userId} userId={userId} />;
}

/** Keeps account data and local history pagination scoped to the selected user. */
function UserDetailContent({ userId }) {
  const handleBack = useNavigateBack("/admin-panel/users/all");

  const userQuery = useUserDetail(userId);
  const activityQuery = useUserActivity(userId, { limit: 20 });
  const historyQuery = useUserAdministrativeHistory(userId, {
    page: 1,
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
      error={!user ? userQuery.error : null}
      hasData={Boolean(user)}
      onRetry={userQuery.refetch}
      loadingContent={<UserDetailSkeleton />}
      errorTitle="User unavailable"
      errorMessage="The user could not be loaded. They may not exist or you may not have access."
    >
      {user && (
        <div className="min-w-0 space-y-6 pb-12 sm:space-y-8">
          <UserDetailOverview
            user={user}
            accountActions={<UserAccountActions user={user} />}
            accountNotice={userQuery.error && (
              <DataErrorState
                compact
                framed
                retainedData
                refreshLabel="Account information"
                title="Unable to refresh account information"
                onRetry={() => userQuery.refetch()}
                retrying={userQuery.isFetching}
                retryLabel="Retry"
              />
            )}
          >
          <UserRecentActivity
            activities={activityQuery.activities}
            isLoading={activityQuery.isLoading}
            isFetching={activityQuery.isFetching}
            hasData={activityQuery.hasData}
            error={activityQuery.error}
            onRetry={activityQuery.refetch}
          />
          <UserAdministrativeHistory
            userId={userId}
            history={historyQuery.history}
            pagination={historyQuery.pagination}
            isLoading={historyQuery.isLoading}
            isFetching={historyQuery.isFetching}
            hasData={historyQuery.hasData}
            error={historyQuery.error}
            onRetry={historyQuery.refetch}
          />
          </UserDetailOverview>
        </div>
      )}
    </DetailPageLayout>
  );
}
