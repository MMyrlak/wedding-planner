import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Users,
  UserPlus,
  Trash2,
  Palette,
  Calculator,
  Scale,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Shield,
  Download,
  DatabaseBackup,
  KeyRound,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export const WeddingSettings = () => {
  const { user: currentUser } = useAuth();
  const { darkMode, toggleDarkMode, themeColor, setThemeColor, themeOptions } = useTheme();

  const [settings, setSettings] = useState({
    wedding_name: "Nasze Wesele",
    wedding_date: "",
    venue_name: "",
    adult_weight: 1.0,
    child_weight: 0.5,
    toddler_weight: 0.0,
    adult_age_desc: "powyżej 10 lat",
    child_age_desc: "3–10 lat",
    toddler_age_desc: "0–2 lata",
    plate_price: 350,
    afterparty_price: 120,
    hotel_price: 150,
    theme_color: "emerald",
  });

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Formularz dodawania współorganizatora
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState("Współorganizator");
  const [memberAdding, setMemberAdding] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberSuccess, setMemberSuccess] = useState("");

  // Formularz zmiany własnego hasła
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdChanging, setPwdChanging] = useState(false);
  const [pwdMessage, setPwdMessage] = useState({ type: "", text: "" });

  // Pobieranie backupu
  const [backingUp, setBackingUp] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsRes, membersRes] = await Promise.all([
        api.get("/wedding/settings"),
        api.get("/wedding/members"),
      ]);
      setSettings({
        ...settingsRes.data,
        wedding_date: settingsRes.data.wedding_date || "",
        venue_name: settingsRes.data.venue_name || "",
      });
      if (settingsRes.data.theme_color) {
        setThemeColor(settingsRes.data.theme_color);
      }
      setMembers(membersRes.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się wczytać konfiguracji wesela.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleColorSelect = (colorId) => {
    setSettings((prev) => ({ ...prev, theme_color: colorId }));
    setThemeColor(colorId);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      const payload = {
        wedding_name: settings.wedding_name.trim(),
        wedding_date: settings.wedding_date || null,
        venue_name: settings.venue_name.trim() || null,
        adult_weight: parseFloat(settings.adult_weight),
        child_weight: parseFloat(settings.child_weight),
        toddler_weight: parseFloat(settings.toddler_weight),
        adult_age_desc: settings.adult_age_desc.trim(),
        child_age_desc: settings.child_age_desc.trim(),
        toddler_age_desc: settings.toddler_age_desc.trim(),
        plate_price: parseFloat(settings.plate_price) || 0,
        afterparty_price: parseFloat(settings.afterparty_price) || 0,
        hotel_price: parseFloat(settings.hotel_price) || 0,
        theme_color: settings.theme_color,
      };

      const res = await api.put("/wedding/settings", payload);
      setSettings({
        ...res.data,
        wedding_date: res.data.wedding_date || "",
        venue_name: res.data.venue_name || "",
      });
      setThemeColor(res.data.theme_color);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Nie udało się zapisać ustawień.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberAdding(true);
    setMemberError("");
    setMemberSuccess("");

    try {
      const payload = {
        email: memberEmail.trim(),
        password: memberPassword.trim() || null,
        role_label: memberRole.trim() || "Współorganizator",
      };
      const res = await api.post("/wedding/members", payload);
      setMembers((prev) => {
        const exists = prev.some((m) => m.id === res.data.id);
        return exists
          ? prev.map((m) => (m.id === res.data.id ? res.data : m))
          : [...prev, res.data];
      });
      setMemberEmail("");
      setMemberPassword("");
      setMemberRole("Współorganizator");
      setMemberSuccess(`Dodano konto ${res.data.email} do zespołu organizacyjnego.`);
      setTimeout(() => setMemberSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      setMemberError(
        err.response?.data?.detail || "Nie udało się dodać współorganizatora."
      );
    } finally {
      setMemberAdding(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (
      !window.confirm(
        `Czy na pewno usunąć konto ${member.email} z tego wesela?`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/wedding/members/${member.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      alert(err.response?.data?.detail || "Nie udało się usunąć konta.");
    }
  };

  const handleDownloadBackup = async (format) => {
    setBackingUp(true);
    try {
      const res = await api.get("/wedding/backup", {
        params: { format },
        responseType: "blob",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `backup_wesela_${stamp}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Nie udało się pobrać kopii zapasowej.");
    } finally {
      setBackingUp(false);
    }
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    setPwdChanging(true);
    setPwdMessage({ type: "", text: "" });
    try {
      const res = await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdMessage({ type: "success", text: res.data.message });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwdMessage({
        type: "error",
        text: err.response?.data?.detail || "Nie udało się zmienić hasła.",
      });
    } finally {
      setPwdChanging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">
          Wczytywanie konfiguracji wesela...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Nagłówek strony */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Konfiguracja Wesela i Zespół
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dostosuj przeliczniki wiekowe gości, stawki jednostkowe, kolory motywu, kopie zapasowe oraz zespół organizacyjny.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Ustawienia wesela zostały pomyślnie zapisane!</span>
        </div>
      )}

      {/* FORMULARZ USTAWIEŃ GŁÓWNYCH */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">
                Informacje Podstawowe
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nazwa uroczystości / Pary Młodej *
              </label>
              <input
                type="text"
                required
                value={settings.wedding_name}
                onChange={(e) =>
                  setSettings({ ...settings, wedding_name: e.target.value })
                }
                placeholder="np. Wesele Emilii i Mikołaja"
                className="w-full text-sm px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data ślubu i wesela
                </label>
                <input
                  type="date"
                  value={settings.wedding_date}
                  onChange={(e) =>
                    setSettings({ ...settings, wedding_date: e.target.value })
                  }
                  className="w-full text-sm px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sala weselna / Lokalizacja</span>
                </label>
                <input
                  type="text"
                  value={settings.venue_name}
                  onChange={(e) =>
                    setSettings({ ...settings, venue_name: e.target.value })
                  }
                  placeholder="np. Sala Biały Dom, Paniówki"
                  className="w-full text-sm px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Palette className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">
                Motyw Kolorystyczny i Tryb Wyświetlania
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Kolor przewodni panelu
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {themeOptions.map((opt) => {
                  const isSelected = themeColor === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleColorSelect(opt.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-inner"
                        style={{ backgroundColor: opt.swatch }}
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Ciemny motyw interfejsu (Dark Mode)
                </span>
                <span className="text-[11px] text-slate-500">
                  Zmniejsza zmęczenie oczu podczas wieczornego planowania.
                </span>
              </div>

              <button
                type="button"
                onClick={toggleDarkMode}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Włącz Jasny</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-600" />
                    <span>Włącz Ciemny</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Wagi wiekowe i Cennik */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Scale className="w-4 h-4 text-emerald-600" />
              <div>
                <h2 className="font-bold text-slate-900 text-base">
                  Przelicznik Wiekowy Gości
                </h2>
                <p className="text-[11px] text-slate-400">
                  Określ przedziały wiekowe oraz współczynnik talerzyka dla każdej grupy.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-xl">
                <div className="col-span-4">
                  <span className="text-xs font-bold text-slate-800 block">Dorosły</span>
                  <span className="text-[10px] text-slate-400 font-mono">adult</span>
                </div>
                <div className="col-span-5">
                  <label className="block text-[10px] text-slate-500 mb-0.5">Przedział wieku</label>
                  <input
                    type="text"
                    value={settings.adult_age_desc}
                    onChange={(e) =>
                      setSettings({ ...settings, adult_age_desc: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] text-slate-500 mb-0.5">Waga (x)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="5"
                    value={settings.adult_weight}
                    onChange={(e) =>
                      setSettings({ ...settings, adult_weight: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-xl">
                <div className="col-span-4">
                  <span className="text-xs font-bold text-slate-800 block">Dziecko</span>
                  <span className="text-[10px] text-slate-400 font-mono">child</span>
                </div>
                <div className="col-span-5">
                  <label className="block text-[10px] text-slate-500 mb-0.5">Przedział wieku</label>
                  <input
                    type="text"
                    value={settings.child_age_desc}
                    onChange={(e) =>
                      setSettings({ ...settings, child_age_desc: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] text-slate-500 mb-0.5">Waga (x)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="5"
                    value={settings.child_weight}
                    onChange={(e) =>
                      setSettings({ ...settings, child_weight: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-xl">
                <div className="col-span-4">
                  <span className="text-xs font-bold text-slate-800 block">Maluch</span>
                  <span className="text-[10px] text-slate-400 font-mono">toddler</span>
                </div>
                <div className="col-span-5">
                  <label className="block text-[10px] text-slate-500 mb-0.5">Przedział wieku</label>
                  <input
                    type="text"
                    value={settings.toddler_age_desc}
                    onChange={(e) =>
                      setSettings({ ...settings, toddler_age_desc: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] text-slate-500 mb-0.5">Waga (x)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="5"
                    value={settings.toddler_weight}
                    onChange={(e) =>
                      setSettings({ ...settings, toddler_weight: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Stawki Jednostkowe (Cennik Sali i Hotelu)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Automatycznie estymują koszt cateringu, poprawin i noclegów na Pulpicie Głównym.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Talerzyk Wesele (PLN)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={settings.plate_price}
                    onChange={(e) =>
                      setSettings({ ...settings, plate_price: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Za 1.0 os. przeliczeniową
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Poprawiny (PLN)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={settings.afterparty_price}
                    onChange={(e) =>
                      setSettings({ ...settings, afterparty_price: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Za 1.0 os. przeliczeniową
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nocleg / Hotel (PLN)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={settings.hotel_price}
                    onChange={(e) =>
                      setSettings({ ...settings, hotel_price: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Za 1 gościa z noclegiem
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Zapisywanie..." : "Zapisz Wszystkie Ustawienia"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* SEKCJA BACKUP OFFLINE I ZMIANA HASŁA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kopia zapasowa offline */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <DatabaseBackup className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">
                Kopia Zapasowa Offline (Na Wypadek Braku Zasięgu)
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              Pobierz pełny zrzut wszystkich danych wesela (listy gości, pokoi hotelowych, transportu, stołów, budżetu, rat, harmonogramu oraz usługodawców) na telefon lub komputer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleDownloadBackup("xlsx")}
              disabled={backingUp}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{backingUp ? "Generuję..." : "Pobierz Pełny Excel (.xlsx)"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadBackup("json")}
              disabled={backingUp}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Zrzut Techniczny (.json)</span>
            </button>
          </div>
        </div>

        {/* Zmiana własnego hasła */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-base">
              Bezpieczeństwo i Zmiana Własnego Hasła
            </h2>
          </div>

          {pwdMessage.text && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                pwdMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200"
              }`}
            >
              {pwdMessage.text}
            </div>
          )}

          <form onSubmit={handleChangeOwnPassword} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Obecne hasło
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nowe hasło (min. 6 zn.)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={pwdChanging}
                className="w-full py-2 px-3 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {pwdChanging ? "Zapis..." : "Zmień hasło"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ZESPÓŁ ORGANIZACYJNY */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-base">
              Konta Przypisane do Tego Wesela (Współorganizatorzy)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dodaj drugie lub kolejne konto (np. Narzeczonej/Narzeczonego, Świadków lub Rodziców), aby wspólnie edytować listę gości, plan stołów i budżet.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>Dodaj Konto do Wesela</span>
            </h3>

            {memberError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                {memberError}
              </div>
            )}

            {memberSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {memberSuccess}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adres e-mail *
                </label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="partner@email.pl"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hasło startowe (min. 6 znaków)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="Wymagane dla nowego konta"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Pozostaw puste, jeśli podpinasz już istniejące konto.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rola w zespole
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                >
                  <option value="Para Młoda">Para Młoda</option>
                  <option value="Panna Młoda">Panna Młoda</option>
                  <option value="Pan Młody">Pan Młody</option>
                  <option value="Świadkowa / Świadek">Świadkowa / Świadek</option>
                  <option value="Rodzice">Rodzice</option>
                  <option value="Konsultant Ślubny">Konsultant Ślubny</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={memberAdding}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              >
                {memberAdding ? "Dodawanie..." : "Dodaj do zespołu"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Konto / E-mail</th>
                  <th className="py-3 px-4">Rola</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const isSelf = m.id === currentUser?.id;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{m.email}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              Ty
                            </span>
                          )}
                          {m.is_admin === 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                              <Shield className="w-3 h-3" /> Admin
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {m.role_label || "Współorganizator"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {m.is_approved === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Aktywne
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            Oczekuje
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!isSelf && m.is_admin !== 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Usuń dostęp z tego wesela"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};