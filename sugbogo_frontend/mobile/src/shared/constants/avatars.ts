import type { ImageSource } from "expo-image";

export const AVATAR_KEYS = [
  "explorer_avatar_1",
  "explorer_avatar_2",
  "explorer_avatar_3",
  "explorer_avatar_4",
  "explorer_avatar_5",
  "explorer_avatar_6",
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const DEFAULT_AVATAR_KEY: AvatarKey = "explorer_avatar_1";

export const BUILT_IN_AVATARS: Record<AvatarKey, ImageSource> = {
  explorer_avatar_1: require("@/shared/assets/avatars/explorer-avatar-1.webp"),
  explorer_avatar_2: require("@/shared/assets/avatars/explorer-avatar-2.webp"),
  explorer_avatar_3: require("@/shared/assets/avatars/explorer-avatar-3.webp"),
  explorer_avatar_4: require("@/shared/assets/avatars/explorer-avatar-4.webp"),
  explorer_avatar_5: require("@/shared/assets/avatars/explorer-avatar-5.webp"),
  explorer_avatar_6: require("@/shared/assets/avatars/explorer-avatar-6.webp"),
};

export function isAvatarKey(value: unknown): value is AvatarKey {
  return AVATAR_KEYS.includes(value as AvatarKey);
}

export function resolveAvatarSource(avatarKey?: string | null): ImageSource {
  const resolvedKey = isAvatarKey(avatarKey) ? avatarKey : DEFAULT_AVATAR_KEY;

  return BUILT_IN_AVATARS[resolvedKey];
}
