/**
 * Represents the authenticated user's basic profile information
 * returned by the authentication API.
 */
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say" | null;
  avatar_url?: string | null;
  email: string;
  role: string;
  status: string;

  oauth_avatar_url?: string | null;
  has_completed_interest_selection: boolean;
  has_custom_profile_picture: boolean;
  use_oauth_avatar: boolean;
  has_oauth_accounts: boolean;
}
