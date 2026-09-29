import { useState } from "react";
import { MailPlus } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import TextInput from "@/shared/components/forms/TextInput";
import Modal from "@/shared/components/modals/Modal";

import useCreateAdmin from "../hooks/useCreateAdmin";
import {
  buildCreateAdminPayload,
  validateCreateAdmin,
} from "../utils/adminInvitationUi";

const INITIAL_VALUES = {
  first_name: "",
  last_name: "",
  email: "",
};

function normalizeApiFieldErrors(errors = {}) {
  return Object.fromEntries(
    Object.entries(errors).map(([field, value]) => [
      field,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

export default function CreateAdminModal({ isOpen, onClose, onCreated }) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const { createAdmin, isCreating } = useCreateAdmin();

  function resetForm() {
    setValues(INITIAL_VALUES);
    setErrors({});
  }

  function handleClose() {
    if (isCreating) {
      return;
    }

    resetForm();
    onClose();
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isCreating) {
      return;
    }

    const validationErrors = validateCreateAdmin(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const result = await createAdmin(buildCreateAdminPayload(values));

      resetForm();
      onClose();
      onCreated(result);
    } catch (error) {
      setErrors(
        normalizeApiFieldErrors(error.response?.data?.errors),
      );
      toast.error(
        error.response?.data?.message ||
          "The Admin account could not be created. Please try again.",
      );
    }
  }

  const submitDisabled =
    !values.first_name.trim() ||
    !values.last_name.trim() ||
    !values.email.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Admin"
      description="Create a pending Admin account and send an account setup invitation."
      showCloseButton={!isCreating}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-stroke bg-surface p-4">
          <MailPlus
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm leading-6 text-text-secondary">
            The new Admin will receive an email invitation and create their own
            password before they can sign in.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="admin-first-name"
            name="first_name"
            label="First Name"
            autoComplete="given-name"
            placeholder="Enter first name"
            value={values.first_name}
            onChange={handleChange}
            error={errors.first_name}
            required
          />
          <TextInput
            id="admin-last-name"
            name="last_name"
            label="Last Name"
            autoComplete="family-name"
            placeholder="Enter last name"
            value={values.last_name}
            onChange={handleChange}
            error={errors.last_name}
            required
          />
        </div>

        <TextInput
          id="admin-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="admin@example.com"
          value={values.email}
          onChange={handleChange}
          error={errors.email}
          required
        />

        <div className="flex justify-end gap-3 border-t border-stroke pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isCreating}
            disabled={submitDisabled}
          >
            {isCreating ? "Creating Admin..." : "Create Admin"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
