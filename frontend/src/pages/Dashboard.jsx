import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  Clock,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  ArrowRight,
  Grid,
  RefreshCw,
  Utensils,
  Hotel,
  Sparkles,
  Settings,
  Bus,
  AlertTriangle,
  CheckSquare,
} from "lucide-react";
import api from "../api/client";

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/dashboard/stats");
      setStats(response.data);
    } catch (err) {
      console.error("Błąd podczas pobierania danych dashboardu:", err);
      setError("Nie udało się pobrać statystyk wesela.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Ładowanie podsumowania wesela...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-rose-100 shadow-sm text-center max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">{error}</h3>
        <button
          onClick={fetchStats}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  const tableFillPercentage =
    stats.total_capacity > 0
      ? Math.min(Math.round((stats.assigned_seats / stats.total_capacity) * 100), 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Nagłówek powitalny */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {stats.wedding_name || "Pulpit Organizacyjny Wesela"}
            </h1>
            {stats.wedding_date && (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                {new Date(stats.wedding_date).toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Bieżący stan listy gości, usadzenia przy stołach, logistyki oraz harmonogramu płatności.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-600" />
            <span>Parametry i Ceny</span>
          </Link>

          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Odśwież</span>
          </button>
        </div>
      </div>

      {/* ALERT O ZBLIŻAJĄCYCH SIĘ LUB PRZETERMINOWANYCH RATACH */}
      {stats.upcoming_installments && stats.upcoming_installments.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                Uwaga: Zbliżające się lub zaległe płatności ratalne ({stats.upcoming_installments.length})
              </span>
            </div>
            <Link
              to="/budget"
              className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1"
            >
              Przejdź do rat <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {stats.upcoming_installments.map((inst) => (
              <div
                key={inst.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  inst.is_overdue
                    ? "bg-rose-50/90 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                    : "bg-white border-amber-200/80 text-slate-800"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {inst.item_name} ({inst.installment_name})
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {inst.is_overdue
                      ? `Po terminie (${Math.abs(inst.days_remaining)} dni temu • ${inst.due_date})`
                      : inst.days_remaining === 0
                      ? `Płatne DZISIAJ (${inst.due_date})`
                      : `Za ${inst.days_remaining} dni (${inst.due_date})`}
                  </p>
                </div>
                <span className="font-extrabold shrink-0">
                  {formatMoney(inst.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Górna siatka 4 głównych wskaźników KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Liczba Gości
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {stats.total_physical_guests}
              </span>
              <span className="text-xs font-medium text-slate-400">osób fizycznych</span>
            </div>
            <p className="text-xs font-medium text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
              {stats.weighted_guest_count.toFixed(1)} talerzyków ({stats.adult_weight} / {stats.child_weight} / {stats.toddler_weight})
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link to="/guests" className="text-emerald-700 font-semibold hover:underline flex items-center gap-1">
              Szczegóły gości <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Odpowiedzi RSVP
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 p-2 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-medium mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tak</span>
              </div>
              <span className="text-lg font-bold text-emerald-900">{stats.confirmed_guests}</span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-300 text-xs font-medium mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Czeka</span>
              </div>
              <span className="text-lg font-bold text-amber-900 dark:text-amber-200">{stats.pending_guests}</span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-rose-700 dark:text-rose-300 text-xs font-medium mb-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Nie</span>
              </div>
              <span className="text-lg font-bold text-rose-900 dark:text-rose-200">{stats.declined_guests}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Potwierdzenia z tokenów</span>
            <span className="font-semibold text-slate-700">
              {stats.total_physical_guests > 0
                ? `${Math.round((stats.confirmed_guests / stats.total_physical_guests) * 100)}%`
                : "0%"}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Miejsca przy Stołach
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center">
              <Grid className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">{stats.assigned_seats}</span>
                <span className="text-sm font-medium text-slate-400">/ {stats.total_capacity}</span>
              </div>
              <span className="text-xs font-semibold text-slate-600">{tableFillPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${tableFillPercentage}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link to="/tables" className="text-emerald-700 font-semibold hover:underline flex items-center gap-1">
              Plan rozmieszczenia <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Finanse i Budżet
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">
              {formatMoney(stats.actual_budget)}
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-500">
              <span>Szacowano:</span>
              <span className="font-medium text-slate-700">{formatMoney(stats.estimated_budget)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-rose-600">
              <span>Pozostało do zapłaty:</span>
              <span className="font-semibold">{formatMoney(stats.remaining_to_pay)}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link to="/budget" className="text-emerald-700 font-semibold hover:underline flex items-center gap-1">
              Kalkulator budżetu <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Estymacja kosztów zmiennych i logistyki */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">
              Talerzyki (Wesele)
            </span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">
              {formatMoney(stats.catering_estimated_cost)}
            </span>
            <span className="text-[11px] text-slate-400">
              {formatMoney(stats.plate_price)} / os. przelicz.
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">
              Poprawiny
            </span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">
              {formatMoney(stats.afterparty_estimated_cost)}
            </span>
            <span className="text-[11px] text-slate-400">
              {formatMoney(stats.afterparty_price)} / os. przelicz.
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">
              Noclegi ({stats.hotel_guests_count} os.)
            </span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">
              {formatMoney(stats.hotel_estimated_cost)}
            </span>
            <span className="text-[11px] text-slate-400">
              {formatMoney(stats.hotel_price)} / os. w hotelu
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Hotel className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">
              Transport Busem
            </span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">
              {stats.transport_guests_count} pasażerów
            </span>
            <Link
              to="/reports"
              className="text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              Pobierz listę dla kierowcy →
            </Link>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Bus className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sekcja dolna: Oś czasu + szybkie akcje */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Najbliższe Punkty Harmonogramu
              </h2>
            </div>
            <Link
              to="/timeline"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Cały harmonogram <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {stats.upcoming_timeline && stats.upcoming_timeline.length > 0 ? (
            <div className="space-y-4">
              {stats.upcoming_timeline.map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs font-mono font-bold text-xs text-emerald-700 shrink-0">
                    {event.time_start}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {event.description}
                      </p>
                    )}
                  </div>
                  {event.assigned_person && (
                    <span className="text-[11px] font-medium bg-slate-200/60 dark:bg-slate-700 text-slate-700 px-2.5 py-1 rounded-md shrink-0">
                      {event.assigned_person}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">Brak dodanych punktów programu wesela.</p>
              <Link
                to="/timeline"
                className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline"
              >
                Dodaj pierwsze wydarzenie
              </Link>
            </div>
          )}
        </div>

        {/* Karta szybkich skrótów */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Szybkie Akcje
            </h2>
            <div className="space-y-2.5">
              <Link
                to="/reports"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Utensils className="w-4 h-4 text-emerald-600" />
                  <span>Wydruki na salę, QR i winietki</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/checklist"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>Checklista zadań przedślubnych</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/tables"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Grid className="w-4 h-4 text-emerald-600" />
                  <span>Usadź gości (Drag & Drop)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-slate-700">
            <span className="font-semibold text-emerald-800 block mb-1">
              Kopia zapasowa offline
            </span>
            Przed weselem pobierz pełny arkusz Excel lub plik JSON w zakładce{" "}
            <Link to="/settings" className="underline font-semibold">
              Ustawienia Wesela
            </Link>
            , aby mieć wszystkie dane pod ręką bez dostępu do internetu.
          </div>
        </div>
      </div>
    </div>
  );
};