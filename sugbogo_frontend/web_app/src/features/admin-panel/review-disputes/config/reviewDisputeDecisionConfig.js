const REVIEW_DISPUTE_DECISION_CONFIG = {
  uphold: {
    title: "Uphold Dispute",
    description: "Provide the reason for upholding the merchant's dispute.",
    reviewLabel: "Review & Uphold",
    confirmationTitle: "Uphold this dispute?",
    confirmationDescription:
      "Review the moderation notes before submitting this decision.",
    outcomeMessage:
      "The merchant's dispute will be upheld and the disputed review will be removed from the platform.",
    confirmLabel: "Confirm Uphold",
    confirmVariant: "danger",
    successMessage: "Review dispute upheld successfully.",
    templates: [
      {
        value: "confirmed_fake",
        label: "Confirmed fake",
        text: "The review was determined to be inauthentic based on the available evidence.",
      },
      {
        value: "no_purchase_record",
        label: "No purchase record",
        text: "No matching purchase or visit record was found, which supports the dispute.",
      },
      {
        value: "evidence_supports_removal",
        label: "Evidence supports removal",
        text: "The submitted evidence sufficiently supports the dispute and review removal.",
      },
      {
        value: "policy_violation",
        label: "Review violates policy",
        text: "The review was found to violate platform guidelines and will be removed.",
      },
    ],
  },

  dismiss: {
    title: "Dismiss Dispute",
    description: "Provide the reason for dismissing the merchant's dispute.",
    reviewLabel: "Review & Dismiss",
    confirmationTitle: "Dismiss this dispute?",
    confirmationDescription:
      "Review the moderation notes before submitting this decision.",
    outcomeMessage:
      "The merchant's dispute will be dismissed and the disputed review will remain on the platform.",
    confirmLabel: "Confirm Dismiss",
    confirmVariant: "primary",
    successMessage: "Review dispute dismissed successfully.",
    templates: [
      {
        value: "insufficient_evidence",
        label: "Insufficient evidence",
        text: "The submitted evidence was not sufficient to support the dispute.",
      },
      {
        value: "no_policy_violation",
        label: "No policy violation",
        text: "The review was evaluated against platform guidelines and no policy violation was found.",
      },
      {
        value: "claim_could_not_be_verified",
        label: "Claim could not be verified",
        text: "The dispute claim could not be sufficiently verified based on the available information.",
      },
    ],
  },
};

export const MIN_MODERATION_NOTES_LENGTH = 20;

export default REVIEW_DISPUTE_DECISION_CONFIG;
