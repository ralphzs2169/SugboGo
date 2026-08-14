export const MIN_FEEDBACK_LENGTH = 10;

const rejectionFeedbackSections = [
  {
    value: "identity",
    label: "Business Identity",
    templates: [
      "Business name does not match the registered name on file.",
      "Business type/category appears incorrect for the description given.",
      "Owner information is incomplete or inconsistent.",
    ],
  },
  {
    value: "location",
    label: "Business Location",
    templates: [
      "Pinned location does not match the address provided.",
      "Address is incomplete — missing barangay or landmark.",
      "Location appears to be residential, not a registered business site.",
    ],
  },
  {
    value: "operating_hours",
    label: "Operating Hours",
    templates: [
      "Operating hours are incomplete or missing required days.",
      "The submitted opening and closing times appear inconsistent.",
      "The listed operating hours do not accurately reflect the business's regular schedule.",
    ],
  },
  {
    value: "photos",
    label: "Business Photos",
    templates: [
      "Photos are blurry or too low-resolution to verify.",
      "Photos do not clearly show the storefront/entrance.",
      "Photos appear to be stock images, not the actual business.",
    ],
  },
  {
    value: "documents",
    label: "Verification Documents",
    templates: [
      "Document is blurry or unreadable.",
      "Document appears expired.",
      "Business name on document does not match the application.",
    ],
  },
];

export default rejectionFeedbackSections;
