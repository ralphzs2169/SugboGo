import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ADMIN_INVITATION_VIEW,
  ADMIN_INVITATION_SETUP_PATH,
  buildAdminInvitationCompletionPayload,
  canSubmitAdminInvitation,
  getAdminInvitationCredentials,
  isInvalidAdminInvitationError,
  normalizeAdminInvitationFieldErrors,
  resolveAdminInvitationSetupView,
  validateAdminInvitationPasswords,
} from "./adminInvitationSetup.js";

test("the Admin setup route is public and declared before ProtectedRoute", async () => {
  const appSource = await readFile(
    new URL("../../../App.jsx", import.meta.url),
    "utf8",
  );
  const publicRouteIndex = appSource.indexOf(
    `path="${ADMIN_INVITATION_SETUP_PATH}"`,
  );
  const protectedRouteIndex = appSource.indexOf(
    '<Route element={<ProtectedRoute />}>',
  );

  assert.notEqual(publicRouteIndex, -1);
  assert.ok(publicRouteIndex < protectedRouteIndex);
});

test("missing invitation parameters do not produce usable credentials", () => {
  assert.equal(
    getAdminInvitationCredentials(new URLSearchParams()),
    null,
  );
  assert.equal(
    getAdminInvitationCredentials(new URLSearchParams({ uid: "abc" })),
    null,
  );
  assert.equal(
    getAdminInvitationCredentials(new URLSearchParams({ token: "token" })),
    null,
  );
});

test("setup view never exposes the form before successful validation", () => {
  const credentials = { uid: "encoded-id", token: "secure-token" };

  assert.equal(
    resolveAdminInvitationSetupView({
      credentials: null,
      validationStatus: "pending",
    }),
    ADMIN_INVITATION_VIEW.INVALID,
  );
  assert.equal(
    resolveAdminInvitationSetupView({
      credentials,
      validationStatus: "pending",
    }),
    ADMIN_INVITATION_VIEW.LOADING,
  );
  assert.equal(
    resolveAdminInvitationSetupView({
      credentials,
      validationStatus: "success",
    }),
    ADMIN_INVITATION_VIEW.FORM,
  );
});

test("valid invitation parameters remain scoped to the request payload", () => {
  assert.deepEqual(
    getAdminInvitationCredentials(
      new URLSearchParams({ uid: " encoded-id ", token: " secure-token " }),
    ),
    { uid: "encoded-id", token: "secure-token" },
  );
});

test("password mismatch is blocked before invitation completion", () => {
  const errors = validateAdminInvitationPasswords(
    "Strong-Setup-Password-482!",
    "Different-Setup-Password-731!",
  );

  assert.equal(errors.confirmPassword, "Passwords do not match.");
});

test("completion payload contains exactly the backend invitation fields", () => {
  assert.deepEqual(
    buildAdminInvitationCompletionPayload(
      { uid: "encoded-id", token: "secure-token" },
      "Strong-Setup-Password-482!",
      "Strong-Setup-Password-482!",
    ),
    {
      uid: "encoded-id",
      token: "secure-token",
      password: "Strong-Setup-Password-482!",
      confirm_password: "Strong-Setup-Password-482!",
    },
  );
});

test("only the backend invalid-invitation code transitions to link error", () => {
  assert.equal(
    isInvalidAdminInvitationError({
      response: { data: { code: "INVALID_ADMIN_INVITATION" } },
    }),
    true,
  );
  assert.equal(
    isInvalidAdminInvitationError({
      response: { data: { code: "NETWORK_ERROR" } },
    }),
    false,
  );

  assert.equal(
    resolveAdminInvitationSetupView({
      credentials: { uid: "encoded-id", token: "secure-token" },
      validationStatus: "error",
      validationError: {
        response: { data: { code: "INVALID_ADMIN_INVITATION" } },
      },
    }),
    ADMIN_INVITATION_VIEW.INVALID,
  );
});

test("pending completion prevents duplicate submission", () => {
  const values = {
    password: "Strong-Setup-Password-482!",
    confirmPassword: "Strong-Setup-Password-482!",
  };

  assert.equal(
    canSubmitAdminInvitation({ ...values, isPending: false }),
    true,
  );
  assert.equal(
    canSubmitAdminInvitation({ ...values, isPending: true }),
    false,
  );
});

test("successful completion resolves to the explicit success state", () => {
  assert.equal(
    resolveAdminInvitationSetupView({
      credentials: { uid: "encoded-id", token: "secure-token" },
      terminalView: ADMIN_INVITATION_VIEW.SUCCESS,
      validationStatus: "success",
    }),
    ADMIN_INVITATION_VIEW.SUCCESS,
  );
});

test("backend password errors are normalized for the existing inputs", () => {
  assert.deepEqual(
    normalizeAdminInvitationFieldErrors({
      password: ["This password is too common.", "Choose another password."],
      confirm_password: "Passwords do not match.",
    }),
    {
      password: "This password is too common. Choose another password.",
      confirm_password: "Passwords do not match.",
    },
  );
});
