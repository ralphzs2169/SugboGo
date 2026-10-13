export const SIGNAL_LABELS = {
  duplicate_content: "Duplicate Content",
  rapid_submission: "Rapid Submission",
  shared_installation_accounts: "Shared Installation / Accounts",
};

export const BASIS_LABELS = {
  same_user: "Same user",
  same_installation: "Same app installation identifier",
  same_user_or_installation: "Both same-user and same-installation relationships",
};

export function displayName(author) {
  return [author?.first_name, author?.last_name].filter(Boolean).join(" ") || "Unknown user";
}
