import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import AuthSplitLayout from "../components/common/AuthSplitLayout";
import AdminInvitationSetupForm from "../components/forms/AdminInvitationSetupForm";
import AdminInvitationSetupSuccess from "../components/states/AdminInvitationSetupSuccess";
import InvalidAdminInvitation from "../components/states/InvalidAdminInvitation";
import { useValidateAdminInvitation } from "../hooks/useValidateAdminInvitation";
import {
  ADMIN_INVITATION_VIEW,
  getAdminInvitationCredentials,
  resolveAdminInvitationSetupView,
} from "../utils/adminInvitationSetup";

export default function AdminInvitationSetupPage() {
  useDocumentTitle("Set Up Admin Account | SugboGo Admin");

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const credentials = useMemo(
    () => getAdminInvitationCredentials(searchParams),
    [searchParams],
  );
  const [terminalView, setTerminalView] = useState(null);
  const validationQuery = useValidateAdminInvitation(
    credentials,
    location.key,
  );
  const currentTerminalView =
    terminalView?.locationKey === location.key ? terminalView.view : null;
  const view = resolveAdminInvitationSetupView({
    credentials,
    terminalView: currentTerminalView,
    validationStatus: validationQuery.status,
    validationError: validationQuery.error,
  });

  let content;

  if (view === ADMIN_INVITATION_VIEW.INVALID) {
    content = <InvalidAdminInvitation />;
  } else if (view === ADMIN_INVITATION_VIEW.SUCCESS) {
    content = <AdminInvitationSetupSuccess />;
  } else if (view === ADMIN_INVITATION_VIEW.LOADING) {
    content = (
      <div
        className="flex flex-col items-center justify-center py-16"
        role="status"
      >
        <span
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-gray-500">
          Verifying your invitation...
        </p>
      </div>
    );
  } else if (view === ADMIN_INVITATION_VIEW.RETRYABLE_ERROR) {
    content = (
      <InvalidAdminInvitation
        retryable
        onRetry={validationQuery.refetch}
      />
    );
  } else {
    content = (
      <AdminInvitationSetupForm
        credentials={credentials}
        onCompleted={() =>
          setTerminalView({
            locationKey: location.key,
            view: ADMIN_INVITATION_VIEW.SUCCESS,
          })
        }
        onInvitationInvalid={() =>
          setTerminalView({
            locationKey: location.key,
            view: ADMIN_INVITATION_VIEW.INVALID,
          })
        }
      />
    );
  }

  return <AuthSplitLayout>{content}</AuthSplitLayout>;
}
