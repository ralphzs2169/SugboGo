import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * ThemeToggle component that allows users to switch between light and dark themes.
 * It uses localStorage to persist the user's theme preference across sessions.
 */
function ThemeToggle() {
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
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-background-secondary hover:text-text-primary sm:h-10 sm:w-10"
      aria-label="Toggle theme"
    >
      {darkMode ? (
        <Sun className="h-5 w-5 stroke-[1.75]" />
      ) : (
        <Moon className="h-5 w-5 stroke-[1.75]" />
      )}
    </button>
  );
}

export default ThemeToggle;
