import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Phone,
  FileCheck,
  FileText,
  Trash2,
  Edit2,
  AlertCircle,
  X,
  Filter,
} from "lucide-react";
import api from "../api/client";

const VENDOR_CATEGORIES = [
  "Sala Weselna",
  "Fotograf",
  "Kamerzysta",
  "DJ / Zespół",
  "Florystka / Dekoracje",
  "Cukiernia / Tort",
  "Auto do Ślubu",
  "Animatorka dla Dzieci",
  "Makijaż i Fryzura",
  "Inny",
];

export const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("");
  const [contractFilter, setContractFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    category: VENDOR_CATEGORIES[0],
    name: "",
    contact_phone: "",
    price: 0,
    contract_signed: 0,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchVendors = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (contractFilter !== "") params.contract_signed = Number(contractFilter);

      const res = await api.get("/vendors", { params });
      setVendors(res.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się pobrać listy usługodawców.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [selectedCategory, contractFilter]);

  const formatMoney = (val) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleToggleContract = async (vendor) => {
    const newStatus = vendor.contract_signed === 1 ? 0 : 1;
    try {
      await api.put(`/vendors/${vendor.id}`, {
        ...vendor,
        contract_signed: newStatus,
      });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, contract_signed: newStatus } : v
        )
      );
    } catch (err) {
      alert("Błąd podczas aktualizacji statusu umowy.");
    }
  };

  const handleOpenAddModal = () => {
    setEditingVendor(null);
    setFormData({
      category: VENDOR_CATEGORIES[0],
      name: "",
      contact_phone: "",
      price: 0,
      contract_signed: 0,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      category: vendor.category,
      name: vendor.name,
      contact_phone: vendor.contact_phone || "",
      price: vendor.price,
      contract_signed: vendor.contract_signed,
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
      name: formData.name.trim(),
      contact_phone: formData.contact_phone.trim() || null,
      price: parseFloat(formData.price) || 0.0,
      contract_signed: Number(formData.contract_signed),
    };

    try {
      if (editingVendor) {
        await api.put(`/vendors/${editingVendor.id}`, payload);
      } else {
        await api.post("/vendors", payload);
      }
      setIsModalOpen(false);
      fetchVendors();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.detail || "Nie udało się zapisać usługodawcy."
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteVendor = async (id, name) => {
    if (!window.confirm(`Czy na pewno usunąć usługodawcę "${name}"?`)) return;
    try {
      await api.delete(`/vendors/${id}`);
      setVendors((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      alert("Nie udało się usunąć wykonawcy.");
    }
  };

  const totalVendorsCost = vendors.reduce((acc, v) => acc + (v.price || 0), 0);
  const signedCount = vendors.filter((v) => v.contract_signed === 1).length;

  return (
    <div className="space-y-6">
      {/* Pasek nagłówkowy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Rejestr Usługodawców
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Baza kontaktów, stawki wykonawców oraz weryfikacja podpisanych umów.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Usługodawcę</span>
        </button>
      </div>

      {/* Górne wskaźniki podsumowujące */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Zarejestrowani Wykonawcy
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {vendors.length}
            </span>
            <span className="text-xs text-slate-400">firm / osób</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Podpisane Umowy
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700">
              {signedCount}
            </span>
            <span className="text-xs text-slate-400">/ {vendors.length} sfinalizowanych</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Suma Zobowiązań z Umów
          </span>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {formatMoney(totalVendorsCost)}
            </span>
          </div>
        </div>
      </div>

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
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Wszystkie branże</option>
            {VENDOR_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Status umowy</option>
            <option value="1">Umowa podpisana</option>
            <option value="0">Brak umowy</option>
          </select>
        </div>
      </div>

      {/* Karty usługodawców w siatce */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            Ładowanie listy wykonawców...
          </div>
        ) : vendors.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">
              Brak zarejestrowanych usługodawców
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Dodaj fotografa, salę lub zespół, aby kontrolować umowy.
            </p>
          </div>
        ) : (
          vendors.map((vendor) => {
            const isSigned = vendor.contract_signed === 1;

            return (
              <div
                key={vendor.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between hover:border-slate-200 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {vendor.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleContract(vendor)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                        isSigned
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isSigned ? (
                        <>
                          <FileCheck className="w-3 h-3 text-emerald-700" />
                          <span>Umowa Podpisana</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3 text-amber-700" />
                          <span>Do Podpisania</span>
                        </>
                      )}
                    </button>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-3">
                    {vendor.name}
                  </h3>

                  {vendor.contact_phone ? (
                    <a
                      href={`tel:${vendor.contact_phone}`}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-700 mt-2 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{vendor.contact_phone}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic block mt-2">
                      Brak numeru telefonu
                    </span>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Wynagrodzenie
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatMoney(vendor.price)}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(vendor)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                      title="Edytuj dane"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Usuń wykonawcę"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal dodawania / edycji usługodawcy */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingVendor ? "Edycja Usługodawcy" : "Nowy Usługodawca"}
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
                  Branża / Kategoria *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {VENDOR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nazwa firmy / Wykonawcy *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="np. Studio Fotograficzne Vision"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefon kontaktowy
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_phone: e.target.value })
                    }
                    placeholder="np. +48 500 600 700"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Koszt usługi (PLN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={formData.contract_signed === 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contract_signed: e.target.checked ? 1 : 0,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Umowa została podpisana
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Zaznacz, jeśli formalności i zadatek zostały zrealizowane.
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
                    : editingVendor
                    ? "Zapisz zmiany"
                    : "Dodaj usługodawcę"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};