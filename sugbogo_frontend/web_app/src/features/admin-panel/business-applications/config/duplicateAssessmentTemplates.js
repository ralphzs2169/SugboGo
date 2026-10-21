/** Editable internal-note starters; choosing a chip never selects or saves a decision. */
export const duplicateAssessmentTemplates = {
  unresolved: [
    [
      "Verify location",
      "Verify the address, unit, and map pin before deciding.",
    ],
    [
      "Review documents",
      "Review supporting documents to establish whether this is a separate business.",
    ],
  ],
  confirmed_duplicate: [
    [
      "Same establishment",
      "The matching records represent the same physical establishment.",
    ],
    [
      "Existing listing",
      "The establishment is already represented by the matching business listing.",
    ],
  ],
  legitimate: [
    [
      "Separate branch",
      "A separate branch with distinct premises has been verified.",
    ],
    [
      "Different unit",
      "Separate businesses occupy different units at this address.",
    ],
  ],
  ownership_conflict: [
    [
      "Verify authority",
      "Verify the applicant's authority to represent this establishment.",
    ],
    [
      "Conflicting ownership",
      "Conflicting ownership claims require further investigation.",
    ],
  ],
};

/** Append a note without replacing entered text, duplicating a line, or exceeding the API limit. */
export function appendAssessmentTemplate(current, template) {
  const trimmed = current.trim();
  if (trimmed.split("\n").includes(template)) return current;
  const next = trimmed ? `${trimmed}\n${template}` : template;
  return next.length <= 4000 ? next : current;
}
