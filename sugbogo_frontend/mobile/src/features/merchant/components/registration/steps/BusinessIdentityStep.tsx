import RHFFormInput from "@/shared/components/form/RHFFormInput";
import RHFFormSelect from "@/shared/components/form/RHFFormSelect";
import RHFFormTextArea from "@/shared/components/form/RHFFormTextArea";

/**
 * Displays the business identity fields for the
 * merchant registration flow.
 */
export default function BusinessIdentityStep() {
  return (
    <>
      <RHFFormInput
        name="businessName"
        label="Business Name"
        placeholder="e.g. Cafe Sugbo"
      />

      <RHFFormSelect
        name="businessCategory"
        label="Business Category"
        placeholder="Select a category"
      />

      <RHFFormTextArea
        name="businessDescription"
        label="Business Description"
        placeholder="Tell explorers about your business..."
        maxLength={500}
      />

      <RHFFormInput
        name="contactNumber"
        label="Contact Number"
        placeholder="09XXXXXXXXX"
        keyboardType="phone-pad"
      />

      <RHFFormInput
        name="businessEmail"
        label="Business Email (Optional)"
        placeholder="business@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <RHFFormInput
        name="website"
        label="Facebook Page / Website (Optional)"
        placeholder="https://..."
        autoCapitalize="none"
      />
    </>
  );
}
