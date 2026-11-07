import { Bell, Menu } from "lucide-react";

import ThemeToggle from "@/shared/components/ThemeToggle";
import GlobalSearch from "../global-search/components/GlobalSearch";

/**
 * Provides global administrative utilities that remain available
 * independently of the currently viewed dashboard page.
 */
export default function NavigationHeader({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-stroke bg-background px-4 sm:px-6 lg:px-8">
      {/* Left-side global navigation and search */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-interaction-hover hover:text-text-primary lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Global search */}
        <GlobalSearch />
      </div>

      {/* Right-side global utilities */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Theme */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-interaction-hover hover:text-text-primary"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 stroke-[1.75]" />
        </button>
      </div>
    </header>
  );
}
