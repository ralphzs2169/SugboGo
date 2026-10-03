import { merchantRegistrationSchema } from "./merchantRegistration.schema";

/** Reuses onboarding rules for the four editable business information fields. */
export const merchantBusinessInformationSchema = merchantRegistrationSchema.pick({
  businessDescription: true,
  contactNumber: true,
  businessEmail: true,
  website: true,
});
