import explorerAvatar1 from "@/assets/avatars/explorer-avatar-1.webp";
import explorerAvatar2 from "@/assets/avatars/explorer-avatar-2.webp";
import explorerAvatar3 from "@/assets/avatars/explorer-avatar-3.webp";
import explorerAvatar4 from "@/assets/avatars/explorer-avatar-4.webp";
import explorerAvatar5 from "@/assets/avatars/explorer-avatar-5.webp";
import explorerAvatar6 from "@/assets/avatars/explorer-avatar-6.webp";

/**
 * @typedef {"explorer_avatar_1" | "explorer_avatar_2" | "explorer_avatar_3" | "explorer_avatar_4" | "explorer_avatar_5" | "explorer_avatar_6"} AvatarKey
 */

/** @type {AvatarKey} */
export const DEFAULT_AVATAR_KEY = "explorer_avatar_1";

/** @type {Readonly<Record<AvatarKey, string>>} */
export const BUILT_IN_AVATARS = Object.freeze({
  explorer_avatar_1: explorerAvatar1,
  explorer_avatar_2: explorerAvatar2,
  explorer_avatar_3: explorerAvatar3,
  explorer_avatar_4: explorerAvatar4,
  explorer_avatar_5: explorerAvatar5,
  explorer_avatar_6: explorerAvatar6,
});

/**
 * Resolves a persisted avatar key to a bundled SugboGo avatar asset.
 *
 * @param {string | null | undefined} avatarKey
 * @returns {string}
 */
export function resolveAvatarSource(avatarKey) {
  if (avatarKey && Object.hasOwn(BUILT_IN_AVATARS, avatarKey)) {
    return BUILT_IN_AVATARS[avatarKey];
  }

  return BUILT_IN_AVATARS[DEFAULT_AVATAR_KEY];
}
