import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const ssrHome = typeof document === "undefined" || document.getElementById("root")?.hasAttribute("data-ssr-home");
  const [theme, setTheme] = useState<Theme>(() => {
    if (ssrHome) return "light";
    const stored = localStorage.getItem("theme") as Theme;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [ready, setReady] = useState(!ssrHome);

  useEffect(() => {
    if (!ssrHome) return;
    const stored = localStorage.getItem("theme") as Theme;
    setTheme(stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme, ready]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
