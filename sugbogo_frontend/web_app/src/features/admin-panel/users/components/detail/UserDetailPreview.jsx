import { useState } from "react";
import { Eye } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import UserAccountActions from "./UserAccountActions";
import UserDetailOverview from "./UserDetailOverview";
import UserAdministrativeHistory from "./UserAdministrativeHistory";
import UserDetailSkeleton from "./UserDetailSkeleton";
import UserRecentActivity from "./UserRecentActivity";

const STATES = [
  ["live", "Live data"],
  ["merchant", "Merchant · populated"],
  ["explorer", "Explorer · populated"],
  ["pending_admin", "Pending Admin invitation"],
  ["suspended", "Suspended merchant"],
  ["empty", "Empty activity and history"],
  ["loading", "Initial loading"],
  ["refresh_failed", "Refresh failed · retained data"],
];

/** Keeps synthetic user previews separate from live requests in development. */
export default function UserDetailPreview({ renderLive }) {
  const [mode, setMode] = useState("live");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-stroke bg-surface-muted p-4">
        <label htmlFor="user-detail-preview" className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Eye aria-hidden="true" className="h-4 w-4" />
          Preview state
        </label>
        <select
          id="user-detail-preview"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className="min-w-0 max-w-full cursor-pointer rounded-lg border border-stroke bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-info"
        >
          {STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {mode !== "live" && (
          <Button variant="secondary" size="sm" onClick={() => setMode("live")}>
            Return to live data
          </Button>
        )}
        <p className="w-full text-xs text-text-secondary" role="status">
          {mode === "live"
            ? "Development preview controls. Currently showing the real user."
            : "Preview only: synthetic data. Live fetching is paused; account actions and record navigation are inactive."}
        </p>
      </div>
      {mode === "live" ? renderLive() : (
        <PreviewContent
          key={mode}
          mode={mode}
          onReset={() => setMode("merchant")}
          onLive={() => setMode("live")}
        />
      )}
    </>
  );
}

/** Supplies disposable examples to the same components used by the live page. */
function PreviewContent({ mode, onReset, onLive }) {
  const timestamp = "2026-11-05T01:30:00Z";
  const invited = mode === "pending_admin";
  const explorer = mode === "explorer" || mode === "empty";
  const role = invited ? "admin" : explorer ? "explorer" : "merchant";
  const user = {
    id: 900001,
    name: invited ? "Sofia Reyes" : "Mara Villanueva",
    email: invited ? "sofia.reyes@example.com" : "mara.villanueva@example.com",
    role,
    status: invited ? "pending" : mode === "suspended" ? "suspended" : "active",
    joined_at: "2026-08-12T06:15:00Z",
    email_verified: !invited,
    email_verified_at: invited ? null : "2026-08-12T06:20:00Z",
    reputation: invited ? "0.20000" : "0.73500",
    avatar_key: "explorer_avatar_1",
    invitation_resend_eligible: invited,
    activity_summary: mode === "empty" || invited
      ? { reviews: 0, vouches: 0, reports: 0 }
      : { reviews: 18, vouches: 32, reports: 4, review_disputes: 2 },
  };
  const business = { id: 900002, name: "Mara's Cebu Kitchen", status: "active" };
  const application = { id: 900003, status: "approved" };
  const activities = explorer || invited ? [] : [
    { type: "review_created", description_data: { review_id: 900004, business_id: business.id, business_name: business.name, status: "published" } },
    { type: "business_vouched", description_data: { vouch_id: 900005, business_id: business.id, business_name: business.name, specialty_tag_name: "Traditional Cebuano dishes" } },
    { type: "review_reported", description_data: { report_id: 900006, review_id: 900004, report_type: "off_topic", status: "approved" } },
    { type: "merchant_application_submitted", description_data: { application_id: application.id, submission_number: 2 } },
    { type: "review_dispute_created", description_data: { dispute_id: 900007, review_id: 900004, status: "pending" } },
  ];
  if (mode === "explorer") {
    activities.push({
      type: "business_vouched",
      description_data: { business_id: business.id, business_name: business.name, specialty_tag_name: "Local comfort food" },
    });
  }
  const actor = { id: 900008, name: "Angela Santos", role: "super_admin" };
  const history = mode === "empty" ? [] : invited ? [
    { id: 1, action: "admin_created", context: {} },
  ] : [
    { id: 3, action: mode === "suspended" ? "user_suspended" : "user_reactivated", context: mode === "suspended" ? { reason: "Repeated policy violations require manual review. Linked businesses retain their existing status." } : {} },
    { id: 2, action: "review_report_approved", context: { report_id: 900006, review_id: 900004, report_type: "off_topic", previous_review_status: "published", review_status: "under_review", admin_notes: "The report was investigated and the review was referred for moderation." } },
    { id: 1, action: "user_suspended", context: { reason: "Account temporarily suspended while submitted information was reviewed." } },
  ];
  const error = mode === "refresh_failed" ? new Error("Preview refresh failure") : null;

  return (
    <div onClickCapture={(event) => {
      if (event.target.closest("a")) event.preventDefault();
    }}>
      <DetailPageLayout
        breadcrumbs={[{ label: "Users" }, { label: "Development preview" }]}
        title={user.name}
        backLabel="Return to live user"
        onBack={onLive}
        isLoading={mode === "loading"}
        hasData
        loadingContent={<UserDetailSkeleton role={role} />}
      >
        <div className="min-w-0 space-y-6 pb-12 sm:space-y-8">
          <UserDetailOverview
            user={{ ...user, business, application }}
            accountActions={(
              <fieldset disabled className="min-w-0">
                <legend className="sr-only">Preview account actions are disabled</legend>
                <UserAccountActions user={user} />
              </fieldset>
            )}
            accountNotice={error && (
              <DataErrorState compact retainedData refreshLabel="Account information" retryLabel="Retry" onRetry={onReset} />
            )}
          >
          <UserRecentActivity
            activities={activities.map((event) => ({ ...event, timestamp }))}
            hasData
            error={error}
            onRetry={onReset}
          />
          <UserAdministrativeHistory
            history={history.map((entry) => ({ ...entry, actor, timestamp }))}
            hasData
            error={error}
            onRetry={onReset}
          />
          </UserDetailOverview>
        </div>
      </DetailPageLayout>
    </div>
  );
}
