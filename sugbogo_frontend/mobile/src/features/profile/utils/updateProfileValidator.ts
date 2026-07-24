export type UpdateProfileErrors = {
  firstName?: string;
  lastName?: string;
};

export function validateProfileForm(
  firstName: string,
  lastName: string,
): UpdateProfileErrors {
  const errors: UpdateProfileErrors = {};

  if (!firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (firstName.length > 50) {
    errors.firstName = "First name is too long.";
  }

  if (lastName.length > 50) {
    errors.lastName = "Last name is too long.";
  }

  return errors;
}
