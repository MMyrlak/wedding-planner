import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Cpu,
  HardDrive,
  Database,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Clock,
  Server,
  AlertTriangle,
  Layers,
  KeyRound,
  Download,
  X,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export const AdminPanel = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");

  // Modal resetu hasła
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, metricsRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/metrics"),
      ]);
      setUsers(usersRes.data);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się pobrać danych administracyjnych lub metryk serwera.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleApproval = async (user) => {
    const nextStatus = user.is_approved === 1 ? 0 : 1;
    setActionLoadingId(user.id);
    try {
      const res = await api.patch(`/admin/users/${user.id}/status`, {
        is_approved: nextStatus,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_approved: res.data.is_approved } : u))
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Błąd podczas zmiany statusu konta.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTargetUser || resetNewPassword.length < 6) return;
    setResetSubmitting(true);
    try {
      const res = await api.patch(`/admin/users/${resetTargetUser.id}/reset-password`, {
        new_password: resetNewPassword,
      });
      alert(res.data.message);
      setResetTargetUser(null);
      setResetNewPassword("");
    } catch (err) {
      alert(err.response?.data?.detail || "Nie udało się zresetować hasła.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Czy na pewno usunąć konto użytkownika ${user.email}?`)) {
      return;
    }
    setActionLoadingId(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      alert(err.response?.data?.detail || "Nie udało się usunąć użytkownika.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadFullSystemBackup = async () => {
    try {
      const res = await api.get("/admin/backup-all", { responseType: "blob" });
      const stamp = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `full_system_backup_${stamp}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Nie udało się pobrać pełnego zrzutu bazy danych.");
    }
  };

  const formatUptime = (totalSeconds) => {
    if (!totalSeconds) return "0s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8">
      {/* Nagłówek panelu */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Panel Administratora
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Zarządzanie dostępem kont, resetowanie haseł, kopia zapasowa systemu oraz monitoring Turso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleDownloadFullSystemBackup}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pełny Backup Systemu (.json)</span>
          </button>

          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Odśwież metryki</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Siatka wskaźników zasobów */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Użycie Procesora (CPU)
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">
                {metrics.server.cpu_percent}%
              </span>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    metrics.server.cpu_percent > 80
                      ? "bg-rose-500"
                      : metrics.server.cpu_percent > 50
                      ? "bg-amber-500"
                      : "bg-emerald-600"
                  }`}
                  style={{ width: `${Math.min(metrics.server.cpu_percent, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 truncate">
              {metrics.server.python_version}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pamięć RAM
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">
                  {metrics.server.ram_used_gb}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  / {metrics.server.ram_total_gb} GB
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${metrics.server.ram_percent}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              Zużycie: {metrics.server.ram_percent}%
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Baza Danych (Turso)
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">
                  {formatBytes(metrics.database.total_size_bytes)}
                </span>
              </div>
              <p className="text-xs text-emerald-700 font-medium mt-1">
                {metrics.database.total_rows} rekordów łącznie
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              libSQL over HTTPS / SQLite cloud
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Czas Pracy (Uptime)
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900">
                {formatUptime(metrics.server.process_uptime_seconds)}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Dysk: {metrics.server.disk_used_gb} / {metrics.server.disk_total_gb} GB ({metrics.server.disk_percent}%)
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Proces FastAPI / Uvicorn</p>
          </div>
        </div>
      )}

      {/* Struktura tabel bazy danych */}
      {metrics?.database?.tables && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Struktura i Wolumen Tabel Bazy Turso
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {metrics.database.tables.map((t) => (
              <div
                key={t.table_name}
                className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center"
              >
                <span className="text-[11px] text-slate-500 font-mono block truncate">
                  {t.table_name}
                </span>
                <span className="text-lg font-extrabold text-slate-900 block mt-1">
                  {t.row_count}
                </span>
                <span className="text-[10px] text-slate-400">rekordów</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela kont użytkowników */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-base">
              Zarządzanie Kontami i Zatwierdzanie Dostępu
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {users.length} zarejestrowanych
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-6">ID</th>
                <th className="py-3 px-6">Adres E-mail</th>
                <th className="py-3 px-6">Wesele / Rola</th>
                <th className="py-3 px-6">Status Konta</th>
                <th className="py-3 px-6">Data Rejestracji</th>
                <th className="py-3 px-6 text-right">Zarządzanie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    Ładowanie kont użytkowników...
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  const isApproved = user.is_approved === 1;
                  const isAdmin = user.is_admin === 1;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-slate-400 font-medium">
                        #{user.id}
                      </td>

                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{user.email}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              Ty
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-6">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            Wesele #{user.wedding_id || "-"} • {user.role_label || "Użytkownik"}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-6">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Zatwierdzone</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Oczekuje na zatwierdzenie</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-6 text-slate-500 font-medium">
                        {user.created_at ? new Date(user.created_at).toLocaleString("pl-PL") : "-"}
                      </td>

                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetUser(user);
                              setResetNewPassword("");
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Zresetuj hasło użytkownika"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || actionLoadingId === user.id}
                            onClick={() => handleToggleApproval(user)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              isApproved
                                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                            }`}
                          >
                            {isApproved ? (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                <span>Zablokuj</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Zatwierdź</span>
                              </>
                            )}
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              disabled={actionLoadingId === user.id}
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors disabled:opacity-40"
                              title="Usuń konto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal resetu hasła użytkownika */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Reset Hasła Użytkownika
              </h3>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Ustaw nowe hasło tymczasowe dla konta:{" "}
                <strong className="text-slate-900">{resetTargetUser.email}</strong>
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nowe hasło (min. 6 znaków) *
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="np. NoweHaslo2026!"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {resetSubmitting ? "Zapisuję..." : "Ustaw nowe hasło"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};