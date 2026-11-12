import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Grid,
  Wallet,
  Clock,
  Briefcase,
  Printer,
  CheckSquare,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Heart,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export const Layout = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navigationItems = [
    { name: "Pulpit Główny", path: "/", icon: LayoutDashboard },
    { name: "Goście i RSVP", path: "/guests", icon: Users },
    { name: "Plan Stołów", path: "/tables", icon: Grid },
    { name: "Raporty i Druk", path: "/reports", icon: Printer },
    { name: "Kalkulator Budżetu", path: "/budget", icon: Wallet },
    { name: "Checklista Ślubna", path: "/checklist", icon: CheckSquare },
    { name: "Harmonogram Dnia", path: "/timeline", icon: Clock },
    { name: "Usługodawcy", path: "/vendors", icon: Briefcase },
    { name: "Ustawienia Wesela", path: "/settings", icon: Settings },
    ...(user?.is_admin === 1
      ? [{ name: "Panel Administratora", path: "/admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors duration-200">
      {/* Pasek mobilny */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Heart className="w-4 h-4 fill-emerald-600 text-emerald-600" />
          </div>
          <span className="font-semibold text-slate-800 text-base">Wedding Planner</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleDarkMode}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            title={darkMode ? "Tryb jasny" : "Tryb ciemny"}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Przełącz menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Boczny panel nawigacyjny (Sidebar) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static flex flex-col justify-between ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
                <Heart className="w-5 h-5 fill-emerald-600 text-emerald-600" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-none">
                  Wedding Planner
                </h1>
                <span className="text-[11px] text-slate-400 font-medium">Panel Organizacyjny</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="hidden md:flex p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              title={darkMode ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny"}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 mb-2 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.email}</p>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {user?.is_admin === 1
                  ? "Główny Administrator"
                  : user?.role_label || "Współorganizator"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Wyloguj się</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};