import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Heart,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../api/client";

export const Login = () => {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [weddingName, setWeddingName] = useState("");
  const [roleLabel, setRoleLabel] = useState("Para Młoda");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
        navigate(from, { replace: true });
      } else {
        await api.post("/auth/register", {
          email,
          password,
          wedding_name: weddingName.trim() || "Nasze Wesele",
          role_label: roleLabel.trim() || "Para Młoda",
        });
        setSuccessMsg(
          "Konto zostało utworzone! Oczekuje teraz na zatwierdzenie przez administratora."
        );
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        setError("Nieprawidłowy adres e-mail lub hasło.");
      } else if (err.response?.data?.detail) {
        setError(
          typeof err.response.data.detail === "string"
            ? err.response.data.detail
            : "Wystąpił błąd autoryzacji."
        );
      } else {
        setError("Nie udało się połączyć z serwerem. Upewnij się, że backend działa.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors duration-200">
      {/* Przycisk trybu ciemnego */}
      <button
        type="button"
        onClick={toggleDarkMode}
        className="absolute top-5 right-5 p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
        title={darkMode ? "Tryb jasny" : "Tryb ciemny"}
      >
        {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
          <Heart className="w-6 h-6 fill-emerald-600 text-emerald-600" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Wedding Planner
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login"
            ? "Zaloguj się do panelu organizacji wesela"
            : "Załóż nowe konto organizatora wesela"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-100 sm:px-10">
          {/* Zakładki Logowanie / Rejestracja */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Logowanie
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setSuccessMsg("");
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Rejestracja
            </button>
          </div>

          {successMsg && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-emerald-800">{successMsg}</div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nazwa wydarzenia / Pary Młodej
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={weddingName}
                      onChange={(e) => setWeddingName(e.target.value)}
                      placeholder="np. Wesele Emilii i Mikołaja"
                      className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Twoja rola
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={roleLabel}
                      onChange={(e) => setRoleLabel(e.target.value)}
                      placeholder="np. Pan Młody / Panna Młoda / Świadek"
                      className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Adres e-mail
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Hasło {mode === "register" && "(min. 6 znaków)"}
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting
                  ? "Przetwarzanie..."
                  : mode === "login"
                  ? "Zaloguj się"
                  : "Utwórz konto"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};