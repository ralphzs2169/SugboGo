import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreateAdminPayload,
  canCreateAdmin,
  canResendAdminInvitation,
  CREATE_ADMIN_FIELDS,
  getCreateAdminFeedback,
  validateCreateAdmin,
} from "./adminInvitationUi.js";
import { invalidateAdminUserLists } from "../hooks/adminInvitationQueryEffects.js";

test("only a Super Admin can see Create Admin controls", () => {
  assert.equal(canCreateAdmin({ role: "super_admin" }), true);
  assert.equal(canCreateAdmin({ role: "admin" }), false);
  assert.equal(canCreateAdmin({ role: "explorer" }), false);
});

test("the Create Admin form exposes only backend identity fields", () => {
  assert.deepEqual(CREATE_ADMIN_FIELDS, ["first_name", "last_name", "email"]);

  for (const protectedField of [
    "role",
    "status",
    "password",
    "confirm_password",
    "email_verified",
    "is_staff",
    "is_superuser",
  ]) {
    assert.equal(CREATE_ADMIN_FIELDS.includes(protectedField), false);
  }
});

test("Create Admin payload trims and forwards only identity values", () => {
  assert.deepEqual(
    buildCreateAdminPayload({
      first_name: "  Juan ",
      last_name: " Dela Cruz  ",
      email: " admin@example.com ",
      role: "super_admin",
      password: "not-forwarded",
    }),
    {
      first_name: "Juan",
      last_name: "Dela Cruz",
      email: "admin@example.com",
    },
  );
});

test("Create Admin validation requires name and email identity fields", () => {
  assert.deepEqual(validateCreateAdmin({}), {
    first_name: "First name is required.",
    last_name: "Last name is required.",
    email: "Email is required.",
  });

  assert.deepEqual(
    validateCreateAdmin({
      first_name: "Juan",
      last_name: "Dela Cruz",
      email: "admin@example.com",
    }),
    {},
  );
});

test("creation feedback distinguishes delivery success from partial success", () => {
  assert.deepEqual(
    getCreateAdminFeedback({ data: { invitation_email_sent: true } }),
    {
      kind: "success",
      message: "Admin created successfully. Invitation email sent.",
    },
  );

  const partial = getCreateAdminFeedback({
    data: { invitation_email_sent: false },
  });
  assert.equal(partial.kind, "warning");
  assert.match(partial.message, /account created/i);
  assert.match(partial.message, /resend the invitation/i);
});

test("successful creation invalidates only Admin user list queries", async () => {
  const calls = [];
  const queryClient = {
    invalidateQueries(options) {
      calls.push(options);
      return Promise.resolve();
    },
  };

  await invalidateAdminUserLists(queryClient);

  assert.deepEqual(calls, [
    {
      queryKey: ["admin", "users", "list"],
    },
  ]);
});

test("resend is visible only to Super Admins for pending Admins", () => {
  const superAdmin = { role: "super_admin" };
  const admin = { role: "admin" };

  assert.equal(
    canResendAdminInvitation(superAdmin, {
      role: "admin",
      status: "pending",
    }),
    true,
  );
  assert.equal(
    canResendAdminInvitation(admin, {
      role: "admin",
      status: "pending",
    }),
    false,
  );

  for (const target of [
    { role: "explorer", status: "pending" },
    { role: "merchant", status: "pending" },
    { role: "super_admin", status: "pending" },
    { role: "admin", status: "active" },
    { role: "admin", status: "suspended" },
    { role: "admin", status: "disabled" },
  ]) {
    assert.equal(canResendAdminInvitation(superAdmin, target), false);
  }
});
