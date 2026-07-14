import React from "react";
import { Search, Bell, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import ThemeToggle from "@/shared/components/ThemeToggle";

/**
 * Admin panel top navigation header with search, theme toggle, notifications, and profile actions.
 *
 * @component
 * @param {string} title - Main heading text displayed in the header.
 * @param {string} subtitle - Supporting description text shown below the heading.
 * @param {function} onMenuClick - Callback event handler invoked when the mobile hamburger button is pressed.
 */
function Header({ title, subtitle, onMenuClick }) {
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
    <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      {/* Left Side */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Title & Subtitle */}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold  text-text-primary sm:text-xl">
            {title}
          </h1>

          <p className="hidden truncate text-xs text-text-secondary sm:block sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 sm:gap-5">
        {/* Search */}
        <div className="relative hidden w-56 md:block lg:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />

          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border border-stroke bg-background-secondary py-2 pl-9 pr-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Divider */}
        <div className="hidden h-6 w-px bg-stroke sm:block" />

        <ThemeToggle />

        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-background-secondary hover:text-text-primary sm:h-10 sm:w-10"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 stroke-[1.75]" />
        </button>

        {/* Avatar */}
        <button
          className="h-9 w-9 overflow-hidden rounded-full border border-stroke focus:outline-none focus:ring-2 focus:ring-primary/20 sm:h-10 sm:w-10"
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

export default Header;
