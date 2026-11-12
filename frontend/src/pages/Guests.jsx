import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  UserPlus,
  Search,
  Download,
  Upload,
  Copy,
  Check,
  Mail,
  Trash2,
  Edit3,
  AlertCircle,
  Hotel,
  Utensils,
  RefreshCw,
  X,
  Send,
  Sparkles,
} from "lucide-react";
import api from "../api/client";

export const Guests = () => {
  const [guests, setGuests] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedToken, setCopiedToken] = useState(null);

  // Filtry
  const [search, setSearch] = useState("");
  const [filterRsvp, setFilterRsvp] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterHotel, setFilterHotel] = useState("");
  const [filterDiet, setFilterDiet] = useState("");

  // Zaznaczenia masowe
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal dodawania / edycji
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    age_category: "adult",
    rsvp_status: "pending",
    diet: "standard",
    needs_hotel: 0,
    table_id: "",
    rsvp_group_id: "",
    invite_sent: 0,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Obsługa importu pliku
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (filterRsvp) params.rsvp_status = filterRsvp;
      if (filterTable) params.table_id = filterTable;
      if (filterHotel !== "") params.needs_hotel = filterHotel;
      if (filterDiet) params.diet = filterDiet;

      const [guestsRes, tablesRes] = await Promise.all([
        api.get("/guests", { params }),
        api.get("/tables"),
      ]);

      setGuests(guestsRes.data);
      setTables(tablesRes.data);
    } catch (err) {
      console.error(err);
      setError("Wystąpił problem z pobraniem listy gości lub stołów.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterRsvp, filterTable, filterHotel, filterDiet]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  // Kopiowanie linku RSVP
  const handleCopyLink = (token) => {
    if (!token) return;
    const url = `${window.location.origin}/rsvp/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Otwarcie modalu w trybie dodawania
  const handleOpenAddModal = () => {
    setEditingGuest(null);
    setFormData({
      first_name: "",
      last_name: "",
      age_category: "adult",
      rsvp_status: "pending",
      diet: "standard",
      needs_hotel: 0,
      table_id: "",
      rsvp_group_id: "",
      invite_sent: 0,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Otwarcie modalu w trybie edycji
  const handleOpenEditModal = (guest) => {
    setEditingGuest(guest);
    setFormData({
      first_name: guest.first_name,
      last_name: guest.last_name,
      age_category: guest.age_category,
      rsvp_status: guest.rsvp_status,
      diet: guest.diet,
      needs_hotel: guest.needs_hotel,
      table_id: guest.table_id ? String(guest.table_id) : "",
      rsvp_group_id: guest.rsvp_group_id || "",
      invite_sent: guest.invite_sent,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Zapis formularza
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      age_category: formData.age_category,
      rsvp_status: formData.rsvp_status,
      diet: formData.diet.trim() || "standard",
      needs_hotel: Number(formData.needs_hotel),
      table_id: formData.table_id ? Number(formData.table_id) : null,
      rsvp_group_id: formData.rsvp_group_id.trim() || null,
      invite_sent: Number(formData.invite_sent),
    };

    try {
      if (editingGuest) {
        await api.put(`/guests/${editingGuest.id}`, payload);
      } else {
        await api.post("/guests", payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.detail || "Nie udało się zapisać danych gościa."
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Usuwanie gościa
  const handleDeleteGuest = async (id, name) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć gościa: ${name}?`)) return;
    try {
      await api.delete(`/guests/${id}`);
      setGuests(guests.filter((g) => g.id !== id));
      setSelectedIds(selectedIds.filter((selId) => selId !== id));
    } catch (err) {
      alert("Nie udało się usunąć gościa.");
    }
  };

  // Masowe zaznaczanie
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(guests.map((g) => g.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selId) => selId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Masowe oznaczanie wysyłki zaproszeń
  const handleBulkInvites = async (statusVal) => {
    if (selectedIds.length === 0) return;
    try {
      await api.patch("/guests/bulk/invites", {
        guest_ids: selectedIds,
        invite_sent: statusVal,
      });
      fetchData();
      setSelectedIds([]);
    } catch (err) {
      alert("Wystąpił błąd podczas masowej aktualizacji statusu zaproszeń.");
    }
  };

  // Masowe generowanie brakujących tokenów
  const handleBulkGenerateTokens = async () => {
    try {
      const res = await api.post("/guests/bulk/generate-tokens");
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert("Błąd podczas generowania tokenów.");
    }
  };

  // Eksport XLSX
  const handleExportXLSX = async () => {
    try {
      const response = await api.get("/guests/export/xlsx", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "lista_gosci_weselnych.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Wystąpił problem podczas eksportu do Excela.");
    }
  };

  // Import XLSX
  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    setImporting(true);
    try {
      const res = await api.post("/guests/import/xlsx", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Błąd podczas importu pliku.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Pomocniczy słownik stołów
  const tableMap = tables.reduce((acc, tbl) => {
    acc[tbl.id] = tbl.name;
    return acc;
  }, {});

  // Zgodne z wytycznymi badge RSVP
  const renderRsvpBadge = (status) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Potwierdzony
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            Odmowa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            Oczekujący
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Pasek górny */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Lista Gości i RSVP
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Zarządzaj gośćmi, unikalnymi tokenami zaproszeń, dietami i noclegami.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Eksport XLSX */}
          <button
            onClick={handleExportXLSX}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Eksport (.xlsx)</span>
          </button>

          {/* Import XLSX */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>{importing ? "Importuję..." : "Import (.xlsx)"}</span>
          </button>

          {/* Dodaj gościa */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Dodaj Gościa</span>
          </button>
        </div>
      </div>

      {/* Pasek filtrów i wyszukiwarki */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po imieniu lub nazwisku..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Szukaj
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Status RSVP
            </label>
            <select
              value={filterRsvp}
              onChange={(e) => setFilterRsvp(e.target.value)}
              className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Wszystkie statusy</option>
              <option value="confirmed">Potwierdzeni</option>
              <option value="pending">Oczekujący</option>
              <option value="declined">Odmowa</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Przypisanie do Stołu
            </label>
            <select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Wszystkie stoły</option>
              <option value="unassigned">Nieprzypisani</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Potrzeba Noclegu
            </label>
            <select
              value={filterHotel}
              onChange={(e) => setFilterHotel(e.target.value)}
              className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Wszyscy</option>
              <option value="1">Wymaga noclegu</option>
              <option value="0">Bez noclegu</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Dieta
            </label>
            <select
              value={filterDiet}
              onChange={(e) => setFilterDiet(e.target.value)}
              className="w-full text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Wszystkie diety</option>
              <option value="standard">Standardowa</option>
              <option value="wege">Wegetariańska</option>
              <option value="wegan">Wegańska</option>
              <option value="bezglutenowa">Bezglutenowa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pasek operacji masowych (widoczny przy zaznaczeniach) */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
              {selectedIds.length}
            </span>
            <span>Zaznaczonych gości</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkInvites(1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100/60 rounded-xl text-xs font-medium transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              Oznacz: Wysłano zaproszenie
            </button>
            <button
              onClick={() => handleBulkInvites(0)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              Oznacz: Niewysłano
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-500 hover:underline px-2"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Tabela główna gości */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      guests.length > 0 && selectedIds.length === guests.length
                    }
                    onChange={handleSelectAll}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="py-3 px-4">Gość</th>
                <th className="py-3 px-4">Kategoria</th>
                <th className="py-3 px-4">Status RSVP</th>
                <th className="py-3 px-4">Preferencje</th>
                <th className="py-3 px-4">Stół</th>
                <th className="py-3 px-4">Zaproszenie</th>
                <th className="py-3 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Pobieranie gości...
                  </td>
                </tr>
              ) : guests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Brak gości spełniających wybrane kryteria.
                  </td>
                </tr>
              ) : (
                guests.map((guest) => {
                  const isSelected = selectedIds.includes(guest.id);
                  return (
                    <tr
                      key={guest.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isSelected ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(guest.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Imię i Nazwisko + Grupa */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {guest.first_name} {guest.last_name}
                        </div>
                        {guest.rsvp_group_id && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Grupa: #{guest.rsvp_group_id}
                          </span>
                        )}
                      </td>

                      {/* Kategoria wiekowa */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-600 capitalize">
                          {guest.age_category === "adult" && "Dorosły (1.0)"}
                          {guest.age_category === "child" && "Dziecko (0.5)"}
                          {guest.age_category === "toddler" && "Maluch (0.0)"}
                        </span>
                      </td>

                      {/* RSVP Status */}
                      <td className="py-3.5 px-4">
                        {renderRsvpBadge(guest.rsvp_status)}
                      </td>

                      {/* Dieta & Hotel */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Utensils className="w-3 h-3 text-slate-400" />
                          <span className="capitalize">{guest.diet}</span>
                        </div>
                        {guest.needs_hotel === 1 && (
                          <div className="flex items-center gap-1.5 text-indigo-700">
                            <Hotel className="w-3 h-3 text-indigo-500" />
                            <span className="font-medium">Wymaga noclegu</span>
                          </div>
                        )}
                      </td>

                      {/* Stół */}
                      <td className="py-3.5 px-4">
                        {guest.table_id && tableMap[guest.table_id] ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {tableMap[guest.table_id]}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Nieprzypisany
                          </span>
                        )}
                      </td>

                      {/* Zaproszenie i Token RSVP */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              guest.invite_sent
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            }`}
                          />
                          <span className="text-[11px] font-medium text-slate-600">
                            {guest.invite_sent ? "Wysłano" : "Niewysłano"}
                          </span>
                        </div>
                        {guest.rsvp_token && (
                          <button
                            type="button"
                            onClick={() => handleCopyLink(guest.rsvp_token)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                            title="Kopiuj bezpośredni link RSVP do schowka"
                          >
                            {copiedToken === guest.rsvp_token ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Skopiowano link!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-emerald-600" />
                                <span>Kopiuj link RSVP</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Akcje */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(guest)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edytuj dane"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteGuest(
                                guest.id,
                                `${guest.first_name} ${guest.last_name}`
                              )
                            }
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Usuń gościa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pasek podsumowujący na dole tabeli */}
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Wyświetlono {guests.length} gości</span>
          <button
            onClick={handleBulkGenerateTokens}
            className="text-xs text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Uzupełnij brakujące tokeny RSVP
          </button>
        </div>
      </div>

      {/* Modal dodawania / edycji gościa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingGuest ? "Edycja Gościa" : "Nowy Gość Weselny"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Imię *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    placeholder="np. Anna"
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nazwisko *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    placeholder="np. Nowak"
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategoria Wiekowa
                  </label>
                  <select
                    value={formData.age_category}
                    onChange={(e) =>
                      setFormData({ ...formData, age_category: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="adult">Dorosły (1.0)</option>
                    <option value="child">Dziecko (0.5)</option>
                    <option value="toddler">Maluch (0.0)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status RSVP
                  </label>
                  <select
                    value={formData.rsvp_status}
                    onChange={(e) =>
                      setFormData({ ...formData, rsvp_status: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="pending">Oczekujący</option>
                    <option value="confirmed">Potwierdzony</option>
                    <option value="declined">Odmowa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferencja Diety
                  </label>
                  <input
                    type="text"
                    value={formData.diet}
                    onChange={(e) =>
                      setFormData({ ...formData, diet: e.target.value })
                    }
                    placeholder="standard / wege / bezglutenowa..."
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Przypisany Stół
                  </label>
                  <select
                    value={formData.table_id}
                    onChange={(e) =>
                      setFormData({ ...formData, table_id: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Brak (nieprzypisany)</option>
                    {tables.map((tbl) => (
                      <option key={tbl.id} value={tbl.id}>
                        {tbl.name} ({tbl.assigned_count}/{tbl.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Identyfikator Grupy (wspólne RSVP)
                  </label>
                  <input
                    type="text"
                    value={formData.rsvp_group_id}
                    onChange={(e) =>
                      setFormData({ ...formData, rsvp_group_id: e.target.value })
                    }
                    placeholder="np. kowalscy-para"
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Osoby z tym samym ID grupy widzą się na jednym formularzu.
                  </span>
                </div>
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.needs_hotel === 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          needs_hotel: e.target.checked ? 1 : 0,
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Wymaga rezerwacji hotelu
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.invite_sent === 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invite_sent: e.target.checked ? 1 : 0,
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Zaproszenie zostało wysłane
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {formSubmitting
                    ? "Zapisuję..."
                    : editingGuest
                    ? "Zapisz zmiany"
                    : "Dodaj gościa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};