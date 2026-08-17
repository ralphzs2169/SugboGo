import { LogOut, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/storage/auth.store";

/**
 * Displays the authenticated administrator's identity at the bottom
 * of the sidebar and provides account actions through a compact menu.
 */
export default function SidebarFooter({ isCollapsed = false }) {
  const { handleLogout } = useLogout();

  const user = useAuthStore((state) => state.user);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isMenuOpen]);

  function handleLogoutClick() {
    setIsMenuOpen(false);
    handleLogout();
  }

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Administrator";

  const avatarUrl = user?.avatar_url;

  return (
    <div className="border-t border-stroke px-4 py-4">
      {/* Administrator identity and account actions */}
      <div
        ref={menuRef}
        className={`relative flex items-center ${
          isCollapsed ? "justify-center" : "gap-3"
        }`}
      >
        {/* Avatar */}
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-stroke bg-surface-muted">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-secondary">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Administrator information */}
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">
              {displayName}
            </p>

            <p className="truncate text-xs text-text-secondary">
              {user?.email}
            </p>
          </div>
        )}

        {/* Account menu trigger */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((previous) => !previous)}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-interaction-hover hover:text-text-primary"
          aria-label="Account actions"
          aria-expanded={isMenuOpen}
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {/* Account menu */}
        {isMenuOpen && (
          <div
            className={`absolute bottom-full z-50 mb-2 w-44 overflow-hidden rounded-lg border border-stroke bg-background p-1 shadow-lg ${
              isCollapsed ? "left-0" : "right-0"
            }`}
          >
            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
