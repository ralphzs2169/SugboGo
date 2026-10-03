import { validateResetPassword } from "./resetPasswordValidator.js";

export const ADMIN_INVITATION_SETUP_PATH = "/admin/setup-account";
export const INVALID_ADMIN_INVITATION_CODE = "INVALID_ADMIN_INVITATION";
export const ADMIN_INVITATION_VIEW = {
  LOADING: "loading",
  FORM: "form",
  INVALID: "invalid",
  RETRYABLE_ERROR: "retryable-error",
  SUCCESS: "success",
};

export function getAdminInvitationCredentials(searchParams) {
  const uid = searchParams.get("uid")?.trim() ?? "";
  const token = searchParams.get("token")?.trim() ?? "";

  if (!uid || !token) {
    return null;
  }

  return { uid, token };
}

export function validateAdminInvitationPasswords(password, confirmPassword) {
  return validateResetPassword(password, confirmPassword);
}

export function buildAdminInvitationCompletionPayload(
  credentials,
  password,
  confirmPassword,
) {
  return {
    uid: credentials.uid,
    token: credentials.token,
    password,
    confirm_password: confirmPassword,
  };
}

export function isInvalidAdminInvitationError(error) {
  return (
    error?.response?.data?.code === INVALID_ADMIN_INVITATION_CODE
  );
}

export function normalizeAdminInvitationFieldErrors(errors = {}) {
  return Object.fromEntries(
    Object.entries(errors).map(([field, value]) => [
      field,
      Array.isArray(value) ? value.join(" ") : value,
    ]),
  );
}

export function resolveAdminInvitationSetupView({
  credentials,
  terminalView,
  validationStatus,
  validationError,
}) {
  if (!credentials || terminalView === ADMIN_INVITATION_VIEW.INVALID) {
    return ADMIN_INVITATION_VIEW.INVALID;
  }

  if (terminalView === ADMIN_INVITATION_VIEW.SUCCESS) {
    return ADMIN_INVITATION_VIEW.SUCCESS;
  }

  if (validationStatus === "pending") {
    return ADMIN_INVITATION_VIEW.LOADING;
  }

  if (validationStatus === "error") {
    return isInvalidAdminInvitationError(validationError)
      ? ADMIN_INVITATION_VIEW.INVALID
      : ADMIN_INVITATION_VIEW.RETRYABLE_ERROR;
  }

  return ADMIN_INVITATION_VIEW.FORM;
}

export function canSubmitAdminInvitation({
  password,
  confirmPassword,
  isPending,
}) {
  return Boolean(password && confirmPassword && !isPending);
}
