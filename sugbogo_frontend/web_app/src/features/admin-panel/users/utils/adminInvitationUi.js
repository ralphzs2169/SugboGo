export const CREATE_ADMIN_FIELDS = ["first_name", "last_name", "email"];

export function canCreateAdmin(actor) {
  return actor?.role === "super_admin";
}

export function canResendAdminInvitation(actor, targetUser) {
  return (
    canCreateAdmin(actor) &&
    targetUser?.role === "admin" &&
    targetUser?.status === "pending"
  );
}

export function validateCreateAdmin(values) {
  const errors = {};
  const firstName = values.first_name?.trim() ?? "";
  const lastName = values.last_name?.trim() ?? "";
  const email = values.email?.trim() ?? "";

  if (!firstName) {
    errors.first_name = "First name is required.";
  } else if (firstName.length > 50) {
    errors.first_name = "First name must not exceed 50 characters.";
  }

  if (!lastName) {
    errors.last_name = "Last name is required.";
  } else if (lastName.length > 50) {
    errors.last_name = "Last name must not exceed 50 characters.";
  }

  if (!email) {
    errors.email = "Email is required.";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

export function buildCreateAdminPayload(values) {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
  };
}

export function getCreateAdminFeedback(result) {
  if (result?.data?.invitation_email_sent) {
    return {
      kind: "success",
      message: "Admin created successfully. Invitation email sent.",
    };
  }

  return {
    kind: "warning",
    message:
      "Admin account created, but the invitation email could not be sent. You can resend the invitation from the user's actions menu.",
  };
}
