/** Match the drawer's existing editable append-on-newline quick-reason behavior. */
export function appendQuickReason(current, message, maxLength = Infinity) {
  const next = current.trim() ? `${current.trim()}\n${message}` : message;
  return next.length <= maxLength ? next : current;
}

export const duplicateRejectionReasons = [
  {
    label: "Business already registered",
    message:
      "This application was rejected because the business is already registered on SugboGo.",
  },
  {
    label: "Matching existing listing",
    message: "The submitted business matches an existing SugboGo listing.",
  },
  {
    label: "Same establishment details",
    message:
      "The business name and location details identify the same establishment as an existing registration.",
  },
  {
    label: "Duplicate registration",
    message:
      "This application was identified as a duplicate registration of the same establishment.",
  },
];
