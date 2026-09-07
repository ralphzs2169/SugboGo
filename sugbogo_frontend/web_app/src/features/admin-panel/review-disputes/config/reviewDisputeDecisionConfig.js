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
        value: "fake_or_non_genuine",
        label: "Fake or non-genuine review",
        text: "The available evidence indicates that the review is fake, fabricated, or not based on a genuine customer experience.",
      },
      {
        value: "abusive_or_inappropriate",
        label: "Abusive or inappropriate content",
        text: "The review contains abusive, inappropriate, or otherwise unacceptable content that violates platform guidelines.",
      },
      {
        value: "false_or_misleading",
        label: "False or misleading information",
        text: "The review contains false or materially misleading information, and the submitted evidence sufficiently supports the merchant's claim.",
      },
      {
        value: "conflict_of_interest",
        label: "Conflict of interest",
        text: "The available information indicates a conflict of interest that affects the credibility or impartiality of the review.",
      },
      {
        value: "wrong_business_or_unrelated",
        label: "Wrong business or unrelated experience",
        text: "The review appears to describe another business or an experience that is not relevant to the disputed business.",
      },
      {
        value: "evidence_supports_removal",
        label: "Evidence supports removal",
        text: "The submitted evidence sufficiently supports the dispute and justifies removing the review from the platform.",
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
        text: "The submitted evidence is not sufficient to support the merchant's dispute.",
      },
      {
        value: "no_policy_violation",
        label: "No policy violation",
        text: "The review was evaluated against platform guidelines and no violation requiring removal was found.",
      },
      {
        value: "claim_not_verified",
        label: "Claim could not be verified",
        text: "The merchant's claim could not be sufficiently verified based on the available information and evidence.",
      },
      {
        value: "subjective_customer_opinion",
        label: "Subjective customer opinion",
        text: "The disputed content reflects a subjective customer opinion and does not, by itself, justify review removal.",
      },
      {
        value: "review_relevant_to_business",
        label: "Review is relevant to the business",
        text: "The review appears to relate to the correct business and customer experience, and there is insufficient basis for removal.",
      },
    ],
  },
};

export const MIN_MODERATION_NOTES_LENGTH = 20;

export default REVIEW_DISPUTE_DECISION_CONFIG;
