import React, { useState, useEffect } from "react";
import {
  Wallet,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  X,
  PieChart,
  Filter,
  CalendarClock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../api/client";

const DEFAULT_CATEGORIES = [
  "Sala i Catering",
  "Oprawa Muzyczna",
  "Foto i Video",
  "Dekoracje i Kwiaty",
  "Stroje i Uroda",
  "Papeteria i Zaproszenia",
  "Obrączki i Formalności",
  "Transport i Nocleg",
  "Atrakcje i Inne",
];

export const Budget = () => {
  const [items, setItems] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Rozwinięte wiersze rat dla konkretnych pozycji
  const [expandedItemId, setExpandedItemId] = useState(null);

  // Filtry
  const [selectedCategory, setSelectedCategory] = useState("");
  const [paidFilter, setPaidFilter] = useState("");

  // Modal pozycji budżetowej
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    category: DEFAULT_CATEGORIES[0],
    item_name: "",
    estimated_cost: 0,
    actual_cost: 0,
    paid: 0,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Formularz dodawania nowej raty wewnątrz rozwiniętej pozycji
  const [instForm, setInstForm] = useState({
    installment_name: "Zadatek",
    amount: "",
    due_date: "",
    paid: 0,
    notes: "",
  });
  const [instSubmitting, setInstSubmitting] = useState(false);

  const fetchBudgetAndInstallments = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (paidFilter !== "") params.paid = Number(paidFilter);

      const [itemsRes, instRes] = await Promise.all([
        api.get("/budget", { params }),
        api.get("/budget/installments"),
      ]);
      setItems(itemsRes.data);
      setInstallments(instRes.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się pobrać pozycji budżetowych lub rat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetAndInstallments();
  }, [selectedCategory, paidFilter]);

  const formatMoney = (val) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const totalEstimated = items.reduce((acc, it) => acc + (it.estimated_cost || 0), 0);
  const totalActual = items.reduce((acc, it) => acc + (it.actual_cost || 0), 0);
  const totalPaid = items
    .filter((it) => it.paid === 1)
    .reduce((acc, it) => acc + (it.actual_cost || 0), 0);
  const remainingToPay = items
    .filter((it) => it.paid === 0)
    .reduce((acc, it) => acc + (it.actual_cost || it.estimated_cost || 0), 0);

  const handleTogglePaid = async (item) => {
    const updatedStatus = item.paid === 1 ? 0 : 1;
    try {
      await api.put(`/budget/${item.id}`, {
        ...item,
        paid: updatedStatus,
      });
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, paid: updatedStatus } : it))
      );
    } catch (err) {
      alert("Nie udało się zaktualizować statusu opłacenia.");
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      category: DEFAULT_CATEGORIES[0],
      item_name: "",
      estimated_cost: 0,
      actual_cost: 0,
      paid: 0,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      item_name: item.item_name,
      estimated_cost: item.estimated_cost,
      actual_cost: item.actual_cost,
      paid: item.paid,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const payload = {
      category: formData.category.trim(),
      item_name: formData.item_name.trim(),
      estimated_cost: parseFloat(formData.estimated_cost) || 0.0,
      actual_cost: parseFloat(formData.actual_cost) || 0.0,
      paid: Number(formData.paid),
    };

    try {
      if (editingItem) {
        await api.put(`/budget/${editingItem.id}`, payload);
      } else {
        await api.post("/budget", payload);
      }
      setIsModalOpen(false);
      fetchBudgetAndInstallments();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.detail || "Nie udało się zapisać wydatku."
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Czy na pewno usunąć wydatek "${name}" wraz z jego ratami?`)) return;
    try {
      await api.delete(`/budget/${id}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setInstallments((prev) => prev.filter((ins) => ins.budget_item_id !== id));
    } catch (err) {
      alert("Nie udało się usunąć pozycji.");
    }
  };

  // Operacje na ratach
  const handleAddInstallment = async (e, budgetItemId) => {
    e.preventDefault();
    if (!instForm.installment_name.trim() || !instForm.amount) return;
    setInstSubmitting(true);
    try {
      await api.post("/budget/installments", {
        budget_item_id: budgetItemId,
        installment_name: instForm.installment_name.trim(),
        amount: parseFloat(instForm.amount) || 0,
        due_date: instForm.due_date || null,
        paid: Number(instForm.paid),
        notes: instForm.notes.trim() || null,
      });
      setInstForm({
        installment_name: "Kolejna rata",
        amount: "",
        due_date: "",
        paid: 0,
        notes: "",
      });
      fetchBudgetAndInstallments();
    } catch (err) {
      alert("Nie udało się dodać raty.");
    } finally {
      setInstSubmitting(false);
    }
  };

  const handleToggleInstallmentPaid = async (inst) => {
    const nextPaid = inst.paid === 1 ? 0 : 1;
    try {
      await api.put(`/budget/installments/${inst.id}`, { paid: nextPaid });
      fetchBudgetAndInstallments();
    } catch (err) {
      alert("Nie udało się zaktualizować statusu raty.");
    }
  };

  const handleDeleteInstallment = async (instId) => {
    try {
      await api.delete(`/budget/installments/${instId}`);
      fetchBudgetAndInstallments();
    } catch (err) {
      alert("Nie udało się usunąć raty.");
    }
  };

  const unpaidInstallments = installments.filter((i) => i.paid === 0);

  return (
    <div className="space-y-6">
      {/* Pasek nagłówkowy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kalkulator Budżetu i Harmonogram Rat
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rejestruj wydatki oraz rozbijaj umowy na zadatki, raty i dopłaty końcowe z datami płatności.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Pozycję Kosztową</span>
        </button>
      </div>

      {/* 4 Karty podsumowania finansowego */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Budżet Szacowany
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">
              {formatMoney(totalEstimated)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Wstępny plan kosztów</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Koszt Rzeczywisty
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">
              {formatMoney(totalActual)}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs">
              <span className="text-slate-400">Różnica:</span>
              <span
                className={`font-semibold ${
                  totalActual > totalEstimated ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {formatMoney(totalActual - totalEstimated)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Już Zapłacono
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-700">
              {formatMoney(totalPaid)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalActual > 0
                ? `${Math.round((totalPaid / totalActual) * 100)}% uregulowanych umów`
                : "Brak płatności"}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pozostało do Zapłaty
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-rose-600">
              {formatMoney(remainingToPay)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Otwarte raty: {unpaidInstallments.length}
            </p>
          </div>
        </div>
      </div>

      {/* Zestawienie najbliższych nieopłaconych rat (jeśli istnieją) */}
      {unpaidInstallments.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Harmonogram Nadchodzących Rat i Zaliczek ({unpaidInstallments.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unpaidInstallments.slice(0, 6).map((inst) => (
              <div
                key={inst.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {inst.item_name} — {inst.installment_name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Termin: <strong>{inst.due_date || "Bez terminu"}</strong> •{" "}
                    <span className="font-bold text-rose-600">
                      {formatMoney(inst.amount)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleInstallmentPaid(inst)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shrink-0 transition-colors"
                >
                  Opłać
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pasek filtrów */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtruj:</span>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Wszystkie kategorie</option>
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Wszystkie statusy</option>
            <option value="1">Tylko opłacone</option>
            <option value="0">Tylko nieopłacone</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Kliknij „Raty” przy wybranej pozycji, aby rozbić płatność na transze.
        </span>
      </div>

      {/* Tabela wydatków z rozwijanymi ratami */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Pozycja / Usługa</th>
                <th className="py-3 px-4">Kategoria</th>
                <th className="py-3 px-4 text-right">Szacowany</th>
                <th className="py-3 px-4 text-right">Rzeczywisty</th>
                <th className="py-3 px-4 text-center">Harmonogram Rat</th>
                <th className="py-3 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    Ładowanie pozycji budżetowych...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Brak wydatków w wybranej kategorii.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isPaid = item.paid === 1;
                  const itemInstallments = installments.filter(
                    (ins) => ins.budget_item_id === item.id
                  );
                  const isExpanded = expandedItemId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 w-12">
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(item)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isPaid
                                ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                : "text-slate-400 bg-slate-100 hover:bg-slate-200"
                            }`}
                            title={isPaid ? "Opłacono" : "Nieopłacono"}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.item_name}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {item.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                          {formatMoney(item.estimated_cost)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {formatMoney(item.actual_cost)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedItemId(isExpanded ? null : item.id)
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              itemInstallments.length > 0
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            <span>Raty ({itemInstallments.length})</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edytuj pozycję"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id, item.item_name)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Usuń pozycję"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Rozwijany panel rat dla danej pozycji */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" className="bg-slate-50/80 px-6 py-4 border-t border-slate-100">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                  Transze płatności dla: {item.item_name}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Suma rat:{" "}
                                  <strong>
                                    {formatMoney(
                                      itemInstallments.reduce((s, r) => s + r.amount, 0)
                                    )}
                                  </strong>
                                </span>
                              </div>

                              {itemInstallments.length > 0 && (
                                <div className="space-y-1.5">
                                  {itemInstallments.map((inst) => (
                                    <div
                                      key={inst.id}
                                      className="flex flex-wrap items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80"
                                    >
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleInstallmentPaid(inst)}
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            inst.paid === 1
                                              ? "bg-emerald-100 text-emerald-800"
                                              : "bg-amber-100 text-amber-800"
                                          }`}
                                        >
                                          {inst.paid === 1 ? "Opłacona" : "Do zapłaty"}
                                        </button>
                                        <span className="font-semibold text-slate-900">
                                          {inst.installment_name}
                                        </span>
                                        {inst.due_date && (
                                          <span className="text-[11px] text-slate-500">
                                            Termin: <strong>{inst.due_date}</strong>
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-900">
                                          {formatMoney(inst.amount)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteInstallment(inst.id)}
                                          className="text-rose-500 hover:text-rose-700 p-1"
                                          title="Usuń ratę"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Dodanie nowej raty */}
                              <form
                                onSubmit={(e) => handleAddInstallment(e, item.id)}
                                className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2"
                              >
                                <input
                                  type="text"
                                  required
                                  value={instForm.installment_name}
                                  onChange={(e) =>
                                    setInstForm({
                                      ...instForm,
                                      installment_name: e.target.value,
                                    })
                                  }
                                  placeholder="Nazwa (np. Zadatek / II rata)"
                                  className="sm:col-span-4 text-xs px-3 py-1.5 rounded-lg border border-slate-200"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  value={instForm.amount}
                                  onChange={(e) =>
                                    setInstForm({ ...instForm, amount: e.target.value })
                                  }
                                  placeholder="Kwota (PLN)"
                                  className="sm:col-span-3 text-xs px-3 py-1.5 rounded-lg border border-slate-200"
                                />
                                <input
                                  type="date"
                                  value={instForm.due_date}
                                  onChange={(e) =>
                                    setInstForm({ ...instForm, due_date: e.target.value })
                                  }
                                  className="sm:col-span-3 text-xs px-3 py-1.5 rounded-lg border border-slate-200"
                                />
                                <button
                                  type="submit"
                                  disabled={instSubmitting}
                                  className="sm:col-span-2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                >
                                  + Dodaj ratę
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal dodawania / edycji pozycji budżetowej */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingItem ? "Edycja Pozycji Kosztowej" : "Nowy Wydatek"}
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategoria *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nazwa pozycji / usługi *
                </label>
                <input
                  type="text"
                  required
                  value={formData.item_name}
                  onChange={(e) =>
                    setFormData({ ...formData, item_name: e.target.value })
                  }
                  placeholder="np. Oprawa muzyczna DJ"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Koszt szacowany (PLN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.estimated_cost}
                    onChange={(e) =>
                      setFormData({ ...formData, estimated_cost: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Koszt rzeczywisty (PLN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.actual_cost}
                    onChange={(e) =>
                      setFormData({ ...formData, actual_cost: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={formData.paid === 1}
                    onChange={(e) =>
                      setFormData({ ...formData, paid: e.target.checked ? 1 : 0 })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Całość opłacona
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Jeśli płacisz w transzach, zostaw odznaczone i dodaj raty w tabeli.
                    </span>
                  </div>
                </label>
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
                    : editingItem
                    ? "Zapisz zmiany"
                    : "Dodaj wydatek"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};