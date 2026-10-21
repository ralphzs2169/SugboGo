import { act, renderHook } from "@testing-library/react-native";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import { normalizeIdentity } from "../../../utils/merchant-application/normalizers/normalizeIdentity.utils";
import type { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import useRegistrationUnsavedChanges from "../useRegistrationUnsavedChanges";

type FormInput = z.input<typeof merchantRegistrationSchema>;
type FormOutput = z.output<typeof merchantRegistrationSchema>;
type SavedIdentity = ReturnType<typeof normalizeIdentity> | null;

it("reacts to typing, clearing, successful saves, and later edits", async () => {
  const { result, rerender } = await renderHook(
    ({ savedIdentity }: { savedIdentity: SavedIdentity }) => {
      const form = useForm<FormInput, undefined, FormOutput>({
        defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
      });
      const hasChanges = useRegistrationUnsavedChanges(form.control, {
        lastSavedIdentity: savedIdentity,
        lastSavedLocation: null,
        lastSavedOperatingHours: null,
        lastSavedPhotos: null,
        lastSavedDocuments: null,
      });
      return { form, hasChanges };
    },
    { initialProps: { savedIdentity: null as SavedIdentity } },
  );

  expect(result.current.hasChanges).toBe(false);
  await act(async () =>
    result.current.form.setValue("businessName", "New cafe"),
  );
  expect(result.current.hasChanges).toBe(true);
  await act(async () => result.current.form.setValue("businessName", ""));
  expect(result.current.hasChanges).toBe(false);

  await act(async () =>
    result.current.form.setValue("businessName", "Saved cafe"),
  );
  await rerender({
    savedIdentity: normalizeIdentity(result.current.form.getValues()),
  });
  expect(result.current.hasChanges).toBe(false);
  await act(async () =>
    result.current.form.setValue("contactNumber", "09123456789"),
  );
  expect(result.current.hasChanges).toBe(true);
});
