import React, { useEffect, useState } from "react";
import { Search, Bell, Menu } from "lucide-react";
import ThemeToggle from "@/shared/components/ThemeToggle";

function NavigationHeader({ onMenuClick }) {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-stroke bg-background px-4 sm:px-6 lg:px-8">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Global Search */}
        <div className="relative hidden w-64 md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />

          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border border-stroke bg-surface-muted py-2 pl-9 pr-4 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-5">
        <ThemeToggle />

        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface hover:text-text-primary"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 stroke-[1.75]" />
        </button>

        <button
          className="h-10 w-10 overflow-hidden rounded-full border border-stroke"
          aria-label="Profile"
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop"
            alt="User avatar"
            className="h-full w-full object-cover"
          />
        </button>
      </div>
    </header>
  );
}

export default NavigationHeader;
