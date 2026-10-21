import { useWatch, type Control } from "react-hook-form";
import type { z } from "zod";

import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../constants/registration/defaultValues.constants";
import { getUnsavedSections } from "../../utils/merchant-application/comparisons/getUnsavedSections.utils";
import type { merchantRegistrationSchema } from "../../validation/merchantRegistration.schema";

type FormInput = z.input<typeof merchantRegistrationSchema>;
type FormOutput = z.output<typeof merchantRegistrationSchema>;
type SavedSections = Omit<Parameters<typeof getUnsavedSections>[0], "values">;

/** Compares reactive form values with the last successful saves on every edit. */
export default function useRegistrationUnsavedChanges(
  control: Control<FormInput, undefined, FormOutput>,
  savedSections: SavedSections,
) {
  // The form and subscription use complete defaults, including nested collections.
  const values = useWatch({
    control,
    defaultValue: MERCHANT_REGISTRATION_DEFAULT_VALUES,
  }) as FormInput;

  return getUnsavedSections({ ...savedSections, values }).length > 0;
}
