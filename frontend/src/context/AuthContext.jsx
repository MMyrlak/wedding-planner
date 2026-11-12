import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("wedding_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const response = await api.get("/auth/me");
        setUser(response.data);
      } catch (err) {
        console.error("Błąd weryfikacji tokena:", err);
        localStorage.removeItem("wedding_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, [token]);

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    const receivedToken = response.data.access_token;
    localStorage.setItem("wedding_token", receivedToken);
    setToken(receivedToken);

    const userResponse = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${receivedToken}` },
    });
    setUser(userResponse.data);
    return userResponse.data;
  };

  const logout = () => {
    localStorage.removeItem("wedding_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth musi być użyte wewnątrz AuthProvider");
  }
  return context;
};