import React, { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Star,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle2,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react";
import api from "../api/client";

const STATUS_MAP = {
  considering: {
    label: "Rozważany",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
  contacted: {
    label: "Wysłano zapytanie",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  meeting: {
    label: "Spotkanie / Oferta",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  chosen: {
    label: "Wybrany",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Odrzucony",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
};

const EMPTY_FORM = {
  id: null,
  group_id: "",
  name: "",
  contact_phone: "",
  contact_email: "",
  website_url: "",
  offered_price: "",
  rating: 0,
  pros: "",
  cons: "",
  notes: "",
  status: "considering",
};

export default function VendorCandidatesSection({ onPromoted }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [promoteTarget, setPromoteTarget] = useState(null);
  const [addToBudget, setAddToBudget] = useState(true);
  const [contractSigned, setContractSigned] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get("/vendors/candidates/groups");
      setGroups(res.data || []);
    } catch (err) {
      console.error("Błąd pobierania rozważanych usługodawców:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const res = await api.post("/vendors/candidates/groups", {
        name: newGroupName.trim(),
        sort_order: groups.length,
      });
      setGroups((prev) => [...prev, res.data]);
      setNewGroupName("");
    } catch (err) {
      console.error("Błąd tworzenia grupy:", err);
    }
  };

  const handleRenameGroup = async (groupId) => {
    if (!editingGroupName.trim()) {
      setEditingGroupId(null);
      return;
    }
    try {
      await api.patch(`/vendors/candidates/groups/${groupId}`, {
        name: editingGroupName.trim(),
      });
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name: editingGroupName.trim() } : g))
      );
      setEditingGroupId(null);
    } catch (err) {
      console.error("Błąd zmiany nazwy grupy:", err);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Usunąć grupę „${group.name}” oraz wszystkie przypisane do niej oferty?`)) {
      return;
    }
    try {
      await api.delete(`/vendors/candidates/groups/${group.id}`);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (err) {
      console.error("Błąd usuwania grupy:", err);
    }
  };

  const openAddModal = (groupId) => {
    setForm({ ...EMPTY_FORM, group_id: groupId });
    setModalOpen(true);
  };

  const openEditModal = (cand) => {
    setForm({
      id: cand.id,
      group_id: cand.group_id,
      name: cand.name || "",
      contact_phone: cand.contact_phone || "",
      contact_email: cand.contact_email || "",
      website_url: cand.website_url || "",
      offered_price: cand.offered_price ?? "",
      rating: cand.rating || 0,
      pros: cand.pros || "",
      cons: cand.cons || "",
      notes: cand.notes || "",
      status: cand.status || "considering",
    });
    setModalOpen(true);
  };

  const handleSaveCandidate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.group_id) return;

    const payload = {
      group_id: Number(form.group_id),
      name: form.name.trim(),
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      website_url: form.website_url.trim() || null,
      offered_price: parseFloat(form.offered_price) || 0,
      rating: Number(form.rating) || 0,
      pros: form.pros.trim() || null,
      cons: form.cons.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };

    try {
      if (form.id) {
        await api.patch(`/vendors/candidates/${form.id}`, payload);
      } else {
        await api.post("/vendors/candidates", payload);
      }
      setModalOpen(false);
      await fetchGroups();
    } catch (err) {
      console.error("Błąd zapisu oferty usługodawcy:", err);
    }
  };

  const handleDeleteCandidate = async (candId) => {
    if (!window.confirm("Usunąć tę ofertę z listy rozważanych?")) return;
    try {
      await api.delete(`/vendors/candidates/${candId}`);
      await fetchGroups();
    } catch (err) {
      console.error("Błąd usuwania oferty:", err);
    }
  };

  const handlePromoteConfirm = async () => {
    if (!promoteTarget) return;
    try {
      await api.post(`/vendors/candidates/${promoteTarget.id}/promote`, {
        add_to_budget: addToBudget,
        contract_signed: contractSigned,
      });
      setPromoteTarget(null);
      await fetchGroups();
      if (onPromoted) onPromoted();
    } catch (err) {
      console.error("Błąd przenoszenia usługodawcy:", err);
    }
  };

  const toggleCollapse = (groupId) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400 text-xs">Ładowanie grup usługodawców...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pasek tworzenia nowej grupy */}
      <form
        onSubmit={handleCreateGroup}
        className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"
      >
        <div className="relative flex-1">
          <FolderPlus className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nazwa własnej grupy (np. Fotograf, DJ / Zespół, Florystka, Barman)..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Grupę</span>
        </button>
      </form>

      {/* Lista grup */}
      {groups.length === 0 ? (
        <div className="text-center py-14 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Brak zdefiniowanych grup usługodawców
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Wpisz nazwę pierwszej kategorii powyżej (np. „Fotograf”), aby zbierać i porównywać oferty.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.id];
            const prices = (group.candidates || [])
              .map((c) => Number(c.offered_price))
              .filter((p) => p > 0);
            const priceRange =
              prices.length > 0
                ? `${Math.min(...prices).toLocaleString("pl-PL")} – ${Math.max(...prices).toLocaleString("pl-PL")} zł`
                : null;

            return (
              <div
                key={group.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Nagłówek grupy */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(group.id)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onBlur={() => handleRenameGroup(group.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameGroup(group.id);
                          if (e.key === "Escape") setEditingGroupId(null);
                        }}
                        className="px-2.5 py-1 text-sm rounded-lg border border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                      />
                    ) : (
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {group.name}
                      </h3>
                    )}

                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {group.candidates.length} {group.candidates.length === 1 ? "oferta" : "ofert"}
                    </span>

                    {priceRange && (
                      <span className="hidden md:inline-block text-xs text-slate-500 dark:text-slate-400">
                        Widełki: <strong className="text-slate-800 dark:text-slate-200">{priceRange}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openAddModal(group.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Dodaj Ofertę</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                      }}
                      title="Zmień nazwę grupy"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group)}
                      title="Usuń grupę"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Karty kandydatów wewnątrz grupy */}
                {!isCollapsed && (
                  <div className="p-5">
                    {group.candidates.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Brak ofert w tej grupie. Kliknij „Dodaj Ofertę”, aby zapisać pierwszą propozycję.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.candidates.map((cand) => {
                          const st = STATUS_MAP[cand.status] || STATUS_MAP.considering;
                          const isChosen = cand.status === "chosen";

                          return (
                            <div
                              key={cand.id}
                              className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                                isChosen
                                  ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                                  : "border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40"
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                    {cand.name}
                                  </h4>
                                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>
                                    {st.label}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between mt-2.5 pb-2.5 border-b border-slate-200/70 dark:border-slate-700">
                                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                                    {Number(cand.offered_price) > 0
                                      ? `${Number(cand.offered_price).toLocaleString("pl-PL")} zł`
                                      : "Brak ceny"}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-3.5 h-3.5 ${
                                          star <= (cand.rating || 0)
                                            ? "text-amber-400 fill-amber-400"
                                            : "text-slate-300 dark:text-slate-600"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                  {cand.contact_phone && (
                                    <a
                                      href={`tel:${cand.contact_phone}`}
                                      className="flex items-center gap-1.5 hover:text-emerald-700"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                                      <span>{cand.contact_phone}</span>
                                    </a>
                                  )}
                                  {cand.contact_email && (
                                    <div className="flex items-center gap-1.5">
                                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                                      <span>{cand.contact_email}</span>
                                    </div>
                                  )}
                                  {cand.website_url && (
                                    <a
                                      href={
                                        cand.website_url.startsWith("http")
                                          ? cand.website_url
                                          : `https://${cand.website_url}`
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Portfolio / Oferta WWW</span>
                                    </a>
                                  )}
                                </div>

                                {(cand.pros || cand.cons || cand.notes) && (
                                  <div className="mt-3 space-y-1.5 text-xs">
                                    {cand.pros && (
                                      <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-300">
                                        <ThumbsUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>{cand.pros}</span>
                                      </div>
                                    )}
                                    {cand.cons && (
                                      <div className="flex items-start gap-1.5 text-rose-600 dark:text-rose-300">
                                        <ThumbsDown className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>{cand.cons}</span>
                                      </div>
                                    )}
                                    {cand.notes && (
                                      <p className="text-slate-500 dark:text-slate-400 italic pt-0.5">
                                        {cand.notes}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2">
                                {!isChosen ? (
                                  <button
                                    type="button"
                                    onClick={() => setPromoteTarget(cand)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Wybierz Ofertę</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Przeniesiono do Wybranych</span>
                                  </span>
                                )}

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(cand)}
                                    className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-800 cursor-pointer"
                                    title="Edytuj ofertę"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCandidate(cand.id)}
                                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-400 hover:text-rose-600 cursor-pointer"
                                    title="Usuń ofertę"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DODAWANIA / EDYCJI OFERTY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {form.id ? "Edytuj Rozważaną Ofertę" : "Nowy Rozważany Usługodawca"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grupa
                  </label>
                  <select
                    value={form.group_id}
                    onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status rozmów
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {Object.entries(STATUS_MAP).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nazwa firmy / wykonawcy *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="np. Studio Foto Kowalski"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Wycena / Cena oferty (PLN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.offered_price}
                    onChange={(e) => setForm({ ...form, offered_price: e.target.value })}
                    placeholder="4500"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nasza ocena (1–5)
                  </label>
                  <div className="flex items-center gap-1.5 h-9">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm({ ...form, rating: star === form.rating ? 0 : star })}
                        className="cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= form.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    placeholder="+48 500 000 000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="kontakt@firma.pl"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Link do oferty / portfolio / Instagrama
                </label>
                <input
                  type="text"
                  value={form.website_url}
                  onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    Plusy oferty
                  </label>
                  <textarea
                    rows={2}
                    value={form.pros}
                    onChange={(e) => setForm({ ...form, pros: e.target.value })}
                    placeholder="np. Dron w cenie, szybki termin oddania zdjęć"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-rose-600 dark:text-rose-400 mb-1">
                    Minusy / wątpliwości
                  </label>
                  <textarea
                    rows={2}
                    value={form.cons}
                    onChange={(e) => setForm({ ...form, cons: e.target.value })}
                    placeholder="np. Dopłata za dojazd powyżej 50 km"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dodatkowe notatki
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Warunki zaliczki, zakres godzinowy pakietu..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                >
                  Zapisz Ofertę
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WYBORU OFERTY */}
      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Wybrać ofertę „{promoteTarget.name}”?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
              Wykonawca zostanie oznaczony jako wybrany i dodany do zakładki „Wybrani Usługodawcy”.
            </p>

            <div className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-slate-200">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToBudget}
                  onChange={(e) => setAddToBudget(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  Dodaj również pozycję do <strong>Budżetu</strong> (
                  {Number(promoteTarget.offered_price || 0).toLocaleString("pl-PL")} zł)
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contractSigned}
                  onChange={(e) => setContractSigned(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Oznacz umowę jako już podpisaną</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPromoteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handlePromoteConfirm}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Potwierdź Wybór
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}