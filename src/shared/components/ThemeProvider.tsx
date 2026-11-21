import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Theme = "dark" | "light";
export function resolveTheme(value: string | null): Theme {
  return value === "light" ? "light" : "dark";
}
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>("dark");
  useEffect(() => {
    try { updateTheme(resolveTheme(localStorage.getItem("artha-theme"))); } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  function setTheme(next: Theme) {
    updateTheme(next);
    try { localStorage.setItem("artha-theme", next); } catch { /* Keep the session preference. */ }
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return <Button variant="outline" size="icon" aria-label={label} title={label} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
    {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </Button>;
}