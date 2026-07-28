import RHFFormInput from "@/shared/components/form/RHFFormInput";
import RHFFormSelect from "@/shared/components/form/RHFFormSelect";
import RHFFormTextArea from "@/shared/components/form/RHFFormTextArea";

import RegistrationSection from "../RegistrationSection";

/**
 * Displays the business identity fields for the
 * merchant registration flow.
 */
export default function BusinessIdentityStep() {
  return (
    <>
      <RegistrationSection
        icon="store-outline"
        title="Business Details"
        description="Tell us about the business you'd like to register."
      >
        <RHFFormInput
          name="businessName"
          label="Business Name"
          placeholder="e.g. Cafe Sugbo"
          required
        />

        <RHFFormSelect
          name="businessCluster"
          label="Cluster"
          placeholder="Select a cluster"
          required
        />

        <RHFFormSelect
          name="businessCategory"
          label="Category"
          placeholder="Select a category"
          required
        />

        <RHFFormTextArea
          name="businessDescription"
          label="Description"
          placeholder="Tell explorers about your business..."
          maxLength={500}
        />

        <RHFFormInput
          name="website"
          label="Facebook Page / Website (Optional)"
          placeholder="https://..."
          autoCapitalize="none"
        />
      </RegistrationSection>

      <RegistrationSection
        icon="account-outline"
        title="Contact Information"
        description="We'll use these details to contact you regarding your application."
      >
        <RHFFormInput
          name="contactNumber"
          label="Mobile Number"
          placeholder="0912 345 6789"
          keyboardType="phone-pad"
          required
        />

        <RHFFormInput
          name="businessEmail"
          label="Email Address"
          placeholder="business@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          required
        />
      </RegistrationSection>

      <RegistrationSection
        icon="account-outline"
        title="Representative Information"
        description="Provide the details of the person authorized to submit this application."
      >
        <RHFFormInput
          name="representativeName"
          label="Representative Name"
          required
          placeholder="e.g. Juan Dela Cruz"
        />
        <RHFFormSelect
          name="representativeRole"
          label="Position / Role"
          required
          placeholder="Select your role"
        />
      </RegistrationSection>
    </>
  );
}
