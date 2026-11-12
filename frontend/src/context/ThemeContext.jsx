import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

export const THEME_OPTIONS = [
  { id: "emerald", label: "Szmaragdowy", swatch: "#059669" },
  { id: "pink", label: "Pudrowy Róż", swatch: "#ec4899" },
  { id: "beige", label: "Ciepły Beż", swatch: "#b89872" },
  { id: "rose", label: "Różane Złoto", swatch: "#e11d48" },
  { id: "amber", label: "Złoty Piasek", swatch: "#d97706" },
  { id: "indigo", label: "Królewski Granat", swatch: "#4f46e5" },
  { id: "burgundy", label: "Bordowy / Marsala", swatch: "#881337" },
];

export const ThemeProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("wedding_dark_mode");
    return saved === "true";
  });

  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem("wedding_theme_color") || "emerald";
  });

  // Aplikowanie klasy 'dark' na <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("wedding_dark_mode", String(darkMode));
  }, [darkMode]);

  // Aplikowanie atrybutu koloru motywu na <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme-color", themeColor);
    localStorage.setItem("wedding_theme_color", themeColor);
  }, [themeColor]);

  // Pobranie zapisanego koloru z konfiguracji wesela po zalogowaniu
  useEffect(() => {
    const syncWeddingTheme = async () => {
      if (!isAuthenticated) return;
      try {
        const res = await api.get("/wedding/settings");
        if (res.data?.theme_color) {
          setThemeColor(res.data.theme_color);
        }
      } catch (err) {
        console.error("Nie udało się zsynchronizować koloru motywu:", err);
      }
    };

    syncWeddingTheme();
  }, [isAuthenticated]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        themeColor,
        setThemeColor,
        themeOptions: THEME_OPTIONS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme musi być użyte wewnątrz ThemeProvider");
  }
  return context;
};