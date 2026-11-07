import { UserRound } from "lucide-react";
import UserAvatar from "@/shared/components/UserAvatar";

/** Show an explicitly current account avatar or the log's neutral, non-personal fallback. */
export default function ActivityActorAvatar({ actor, size = "queue" }) {
  if (actor?.avatar_url || actor?.avatar_key) {
    return (
      <span role="img" aria-label="Current account avatar" className="shrink-0">
        <UserAvatar
          avatarUrl={actor.avatar_url}
          avatarKey={actor.avatar_key}
          size={size}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-stroke bg-surface-muted text-text-secondary ${size === "lg" ? "h-10 w-10" : "h-8 w-8"}`}
    >
      <UserRound className="h-4 w-4" />
    </span>
  );
}
