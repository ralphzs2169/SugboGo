import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import { Toaster } from "react-hot-toast";

import LoginPage from "@/features/auth/pages/LoginPage";

import AdminPanelLayout from "@/features/admin-panel/pages/AdminPanelLayout";
import Dashboard from "@/features/admin-panel/pages/Dashboard";
import Businesses from "@/features/admin-panel/pages/BusinessesPage";
import AllReviewsPage from "@/features/admin-panel/pages/AllReviewsPage";
import ActivityLogsPage from "@/features/admin-panel/pages/ActivityLogsPage";
import NotificationsPage from "@/features/admin-panel/pages/NotificationsPage";
import Users from "@/features/admin-panel/pages/Users";
import UserDetailPage from "@/features/admin-panel/pages/UserDetailPage";
import ModerationIntegrityPage from "@/features/admin-panel/pages/ModerationIntegrityPage";
import Analytics from "@/features/admin-panel/pages/Analytics";
import DiscoveryScoresPage from "@/features/admin-panel/pages/DiscoveryScoresPage";
import ProtectedRoute from "@/features/auth/routes/ProtectedRoute";
import ClusterCategoryPage from "@/features/admin-panel/pages/ClusterCategoryPage";
import BusinessTaxonomyPage from "@/features/admin-panel/pages/BusinessTaxonomyPage";
import ExploreConfigurationPage from "@/features/admin-panel/pages/ExploreConfigurationPage";
import BusinessApplications from "@/features/admin-panel/pages/BusinessApplicationsPage";
import BusinessApplicationReviewPage from "@/features/admin-panel/pages/BusinessApplicationReviewPage";
import BusinessDetailPage from "@/features/admin-panel/pages/BusinessDetailPage";
import ReviewDisputeDetailPage from "@/features/admin-panel/pages/ReviewDisputeDetailPage";
import UpdateRequestsPage from "@/features/admin-panel/pages/UpdateRequestsPage";
import UpdateRequestReviewPage from "@/features/admin-panel/pages/UpdateRequestReviewPage";
import ClassificationUpdateRequestReviewPage from "@/features/admin-panel/pages/ClassificationUpdateRequestReviewPage";
import LocationUpdateRequestReviewPage from "@/features/admin-panel/pages/LocationUpdateRequestReviewPage";

import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import EmailSentPage from "@/features/auth/pages/EmailSentPage";
import AdminInvitationSetupPage from "@/features/auth/pages/AdminInvitationSetupPage";
import PublicLegalLayout from "@/features/legal/components/PublicLegalLayout";
import DataDeletionPage from "@/features/legal/pages/DataDeletionPage";
import PrivacyPolicyPage from "@/features/legal/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/features/legal/pages/TermsOfServicePage";
import NotFound from "@/shared/components/errors/NotFound";

import PageLoader from "@/shared/components/loading/PageLoader";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import SpecialtyTagsPage from "./features/admin-panel/pages/SpecialtyTagsPage";
import TransitNetworkPage from "@/features/admin-panel/pages/TransitNetworkPage";
import { getLegacyModerationDestination } from "@/features/admin-panel/utils/moderationNavigation";

function LegacyModerationRedirect({ tab }) {
  const location = useLocation();

  return (
    <Navigate
      to={getLegacyModerationDestination(location.search, tab)}
      replace
    />
  );
}

function AdminWebSession() {
  useRestoreSession();

  const isLoading = useAuthStore((state) => state.isLoading);
  const showLoader = useDelayedLoading(isLoading, 300);

  if (showLoader) {
    return <PageLoader />;
  }

  return (
    <>
      <Outlet />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      />
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<PublicLegalLayout />}>
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />
      </Route>

      <Route element={<AdminWebSession />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/forgot-password/sent" element={<EmailSentPage />} />
        <Route
          path="/admin/setup-account"
          element={<AdminInvitationSetupPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/admin-panel" element={<AdminPanelLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="businesses/applications"
              element={<BusinessApplications />}
            />
            <Route
              path="business/application/:applicationId"
              element={<BusinessApplicationReviewPage />}
            />

            {/* Business Management */}
            <Route path="businesses" element={<Businesses />} />
            <Route path="reviews" element={<AllReviewsPage />} />
            <Route path="activity-logs" element={<ActivityLogsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route
              path="businesses/update-requests"
              element={<UpdateRequestsPage />}
            />
            <Route
              path="businesses/update-requests/:requestId"
              element={<UpdateRequestReviewPage />}
            />
            <Route
              path="businesses/update-requests/classification/:requestId"
              element={<ClassificationUpdateRequestReviewPage />}
            />
            <Route
              path="businesses/update-requests/location/:requestId"
              element={<LocationUpdateRequestReviewPage />}
            />
            <Route
              path="businesses/:businessId"
              element={<BusinessDetailPage />}
            />

            <Route path="cluster-category" element={<ClusterCategoryPage />} />
            <Route path="business-taxonomy" element={<BusinessTaxonomyPage />} />
            <Route path="explore-configuration" element={<ExploreConfigurationPage />} />
            <Route path="users" element={<Users />} />
            <Route path="users/all" element={<Users />} />
            <Route path="users/:userId" element={<UserDetailPage />} />
            <Route path="specialty-tags" element={<SpecialtyTagsPage />} />
            <Route path="transit-network" element={<TransitNetworkPage />} />
            <Route
              path="transit-network/routes/:routeId/variants/new"
              element={
                <Navigate
                  to="/admin-panel/transit-network?tab=routes"
                  replace
                />
              }
            />
            <Route
              path="transit-network/routes/:routeId/variants/:variantId/edit"
              element={
                <Navigate
                  to="/admin-panel/transit-network?tab=routes"
                  replace
                />
              }
            />
            <Route
              path="moderation-integrity"
              element={<ModerationIntegrityPage />}
            />
            <Route
              path="flags-suspicious"
              element={<LegacyModerationRedirect tab="under-review" />}
            />
            <Route
              path="review-disputes"
              element={<LegacyModerationRedirect tab="disputes" />}
            />
            <Route
              path="review-disputes/:disputeId"
              element={<ReviewDisputeDetailPage />}
            />
            <Route path="analytics" element={<Analytics />} />
            <Route
              path="analytics/discovery-scores"
              element={<DiscoveryScoresPage />}
            />
          </Route>
        </Route>

        {/* Keep this retired URL from matching users/:userId. */}
        <Route
          path="/admin-panel/users/roles-permissions"
          element={<NotFound />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
