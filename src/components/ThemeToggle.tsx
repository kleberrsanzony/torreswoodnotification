"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const context = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !context) {
    return <div className="p-2 w-8 h-8" />;
  }

  const { theme, toggleTheme } = context;

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md"
      aria-label="Toggle Theme"
    >
      {theme === "light" ? (
        <Moon className="w-4 h-4 fill-slate-200" />
      ) : (
        <Sun className="w-4 h-4 fill-yellow-400 text-yellow-500" />
      )}
    </button>
  );
}
