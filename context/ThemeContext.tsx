import React, { createContext, useContext } from "react";

const colors = {
  primary: "#6366f1",
  background: "#181818",
  surface: "#282828",
  text: "#ffffff",
  textSecondary: "#b3b3b3",
  border: "#404040",
  error: "#ef4444",
  success: "#22c55e",
};

type ThemeContextType = {
  colors: typeof colors;
};

const ThemeContext = createContext<ThemeContextType>({ colors });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
