import React, { useState, useEffect } from "react";
import {
  Printer,
  Utensils,
  Hotel,
  Bus,
  Mail,
  QrCode,
  Tag,
  Download,
  FileSpreadsheet,
  FileText,
  Archive,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import api from "../api/client";

const TABS = [
  { id: "catering", label: "Kuchnia i Diety", icon: Utensils },
  { id: "hotel", label: "Recepcja (Hotel)", icon: Hotel },
  { id: "transport", label: "Kierowca (Bus)", icon: Bus },
  { id: "invitations", label: "Zaproszenia i Kody QR", icon: Mail },
  { id: "placecards", label: "Winietki na Stoły", icon: Tag },
];

export const Reports = () => {
  const [activeTab, setActiveTab] = useState("catering");
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [error, setError] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(null);

  const [cateringData, setCateringData] = useState(null);
  const [hotelData, setHotelData] = useState(null);
  const [transportData, setTransportData] = useState(null);
  const [invitationsData, setInvitationsData] = useState([]);
  const [placeCardsData, setPlaceCardsData] = useState([]);

  const fetchTabData = async (tab) => {
    setLoading(true);
    setError("");
    const baseUrl = window.location.origin;

    try {
      if (tab === "catering") {
        const res = await api.get("/reports/catering/summary");
        setCateringData(res.data);
      } else if (tab === "hotel") {
        const res = await api.get("/reports/hotel/summary");
        setHotelData(res.data);
      } else if (tab === "transport") {
        const res = await api.get("/reports/transport/summary");
        setTransportData(res.data);
      } else if (tab === "invitations") {
        const res = await api.get("/reports/invitations/preview", {
          params: { base_url: baseUrl },
        });
        setInvitationsData(res.data);
      } else if (tab === "placecards") {
        const res = await api.get("/reports/place-cards/preview");
        setPlaceCardsData(res.data);
      }
    } catch (err) {
      console.error(err);
      setError("Nie udało się wygenerować podglądu raportu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const handleDownloadFile = async (endpoint, params, filename, key) => {
    setDownloadingKey(key);
    try {
      const response = await api.get(endpoint, {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Wystąpił problem podczas generowania pliku do pobrania.");
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const formatMoney = (val) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(val || 0);

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Raporty na Salę, Zaproszenia i Druk
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gotowe zestawienia PDF, Excel i CSV dla kuchni, recepcji hotelowej, kierowcy busa oraz drukarni.
          </p>
        </div>

        <button
          onClick={() => fetchTabData(activeTab)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Odśwież dane</span>
        </button>
      </div>

      {/* Zakładki raportów */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-medium text-slate-500 mt-3">
            Przygotowywanie zestawienia...
          </p>
        </div>
      ) : (
        <>
          {/* ==========================================================
              ZAKŁADKA 1: RAPORT CATERINGOWY DLA KUCHNI
              ========================================================== */}
          {activeTab === "catering" && cateringData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Zestawienie Cateringowe dla Szefa Kuchni
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Uwzględnia wszystkich aktywnych gości (potwierdzonych i oczekujących) wraz z podziałem diet na konkretne stoły.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/catering/export",
                        { format: "pdf" },
                        "raport_cateringowy_kuchnia.pdf",
                        "cat-pdf"
                      )
                    }
                    disabled={downloadingKey === "cat-pdf"}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{downloadingKey === "cat-pdf" ? "Generuję..." : "Pobierz PDF"}</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/catering/export",
                        { format: "xlsx" },
                        "raport_cateringowy_kuchnia.xlsx",
                        "cat-xlsx"
                      )
                    }
                    disabled={downloadingKey === "cat-xlsx"}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/catering/export",
                        { format: "csv" },
                        "raport_cateringowy_kuchnia.csv",
                        "cat-csv"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Karty podsumowania kuchni */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Aktywni Goście
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {cateringData.total_active_guests} os.
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Dor: {cateringData.age_breakdown.adult || 0} • Dz:{" "}
                    {cateringData.age_breakdown.child || 0} • Mal:{" "}
                    {cateringData.age_breakdown.toddler || 0}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Talerzyki Przeliczeniowe
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                    {cateringData.total_weighted_plates}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Wg wag z konfiguracji wesela
                  </span>
                </div>

                <div className="sm:col-span-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-2">
                    Podsumowanie Diet (Globalnie)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(cateringData.diet_totals).length === 0 ? (
                      <span className="text-xs text-slate-400">Brak danych</span>
                    ) : (
                      Object.entries(cateringData.diet_totals).map(([diet, count]) => (
                        <span
                          key={diet}
                          className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 capitalize"
                        >
                          {diet}: <strong className="text-emerald-700">{count}</strong>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Tabela rozkładu diet na stoły */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-5">Stół</th>
                        <th className="py-3 px-5">Osób fizycznych</th>
                        <th className="py-3 px-5">Talerzyki przeliczeniowe</th>
                        <th className="py-3 px-5">Szczegółowy rozkład diet przy stole</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cateringData.tables_breakdown.map((row, idx) => (
                        <tr key={row.table_id ?? `unassigned-${idx}`} className="hover:bg-slate-50/60">
                          <td className="py-3.5 px-5 font-bold text-slate-900">
                            {row.table_name}
                          </td>
                          <td className="py-3.5 px-5 font-medium text-slate-700">
                            {row.physical_guests} os.
                          </td>
                          <td className="py-3.5 px-5 font-bold text-emerald-700">
                            {row.weighted_plates}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(row.diets).length === 0 ? (
                                <span className="text-slate-400 italic">Brak przypisanych gości</span>
                              ) : (
                                Object.entries(row.diets).map(([dName, dCount]) => (
                                  <span
                                    key={dName}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                                      dName === "standard"
                                        ? "bg-slate-100 text-slate-700"
                                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                    }`}
                                  >
                                    {dCount}x {dName}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              ZAKŁADKA 2: LISTA HOTELOWA DLA RECEPCJI
              ========================================================== */}
          {activeTab === "hotel" && hotelData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Lista Hotelowa i Rozliczenie Pokoi dla Recepcji
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zestawienie gości wymagających noclegu z numerami pokoi, liczbą dób oraz wskazaniem płatnika (Para Młoda vs Gość).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/hotel/export",
                        { format: "pdf" },
                        "lista_hotelowa_recepcja.pdf",
                        "hot-pdf"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Pobierz PDF</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/hotel/export",
                        { format: "xlsx" },
                        "lista_hotelowa_recepcja.xlsx",
                        "hot-xlsx"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/hotel/export",
                        { format: "csv" },
                        "lista_hotelowa_recepcja.csv",
                        "hot-csv"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Goście Hotelowi
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {hotelData.total_hotel_guests} os.
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Łącznie Osobodób
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {hotelData.total_person_nights}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Opłaca Para Młoda
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                    {formatMoney(hotelData.couple_covered_cost)}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Opłacają Goście Sami
                  </span>
                  <div className="text-2xl font-extrabold text-slate-700 mt-1">
                    {formatMoney(hotelData.guest_covered_cost)}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-5">Pokój</th>
                        <th className="py-3 px-5">Gość</th>
                        <th className="py-3 px-5">Status RSVP</th>
                        <th className="py-3 px-5">Liczba dób</th>
                        <th className="py-3 px-5">Płatnik</th>
                        <th className="py-3 px-5 text-right">Szacowany koszt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hotelData.rows.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-10 text-center text-slate-400">
                            Brak gości z zaznaczoną opcją noclegu.
                          </td>
                        </tr>
                      ) : (
                        hotelData.rows.map((r) => (
                          <tr key={r.guest_id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-5 font-bold text-indigo-700 dark:text-indigo-300">
                              {r.room_number}
                            </td>
                            <td className="py-3.5 px-5 font-semibold text-slate-900">
                              {r.full_name}
                            </td>
                            <td className="py-3.5 px-5">
                              {r.rsvp_status === "confirmed" ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                                  Potwierdzony
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                                  Oczekujący
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 font-medium">{r.nights_count}</td>
                            <td className="py-3.5 px-5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  r.accommodation_payer === "couple"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {r.accommodation_payer === "couple"
                                  ? "Para Młoda"
                                  : "Gość indywidualnie"}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                              {formatMoney(r.estimated_cost)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              ZAKŁADKA 3: LOGISTYKA TRANSPORTU (BUS DLA KIEROWCY)
              ========================================================== */}
          {activeTab === "transport" && transportData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Manifest Transportowy dla Kierowcy Busa
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lista pasażerów pogrupowana według przystanków odbioru i planowanych godzin kursów powrotnych.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/transport/export",
                        { format: "pdf" },
                        "lista_transport_kierowca.pdf",
                        "tr-pdf"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Pobierz PDF</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/transport/export",
                        { format: "xlsx" },
                        "lista_transport_kierowca.xlsx",
                        "tr-xlsx"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/transport/export",
                        { format: "csv" },
                        "lista_transport_kierowca.csv",
                        "tr-csv"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Łącznie Pasażerów
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {transportData.total_passengers} os.
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">
                    Przystanki Odbioru
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(transportData.pickup_counts).length === 0 ? (
                      <span className="text-xs text-slate-400">Brak</span>
                    ) : (
                      Object.entries(transportData.pickup_counts).map(([place, cnt]) => (
                        <span
                          key={place}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                        >
                          {place}: <strong className="text-emerald-700">{cnt}</strong>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">
                    Kursy Powrotne
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(transportData.return_time_counts).length === 0 ? (
                      <span className="text-xs text-slate-400">Brak</span>
                    ) : (
                      Object.entries(transportData.return_time_counts).map(([timeSlot, cnt]) => (
                        <span
                          key={timeSlot}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                        >
                          {timeSlot}: <strong className="text-emerald-700">{cnt} os.</strong>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-5">Pasażer</th>
                        <th className="py-3 px-5">Przystanek odbioru</th>
                        <th className="py-3 px-5">Kurs powrotny</th>
                        <th className="py-3 px-5">Status RSVP</th>
                        <th className="py-3 px-5">Stół</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transportData.passengers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-10 text-center text-slate-400">
                            Brak pasażerów zapisanych na transport busem.
                          </td>
                        </tr>
                      ) : (
                        transportData.passengers.map((p) => (
                          <tr key={p.guest_id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-5 font-semibold text-slate-900">
                              {p.full_name}
                            </td>
                            <td className="py-3.5 px-5 font-medium text-teal-700 dark:text-teal-300">
                              {p.transport_pickup}
                            </td>
                            <td className="py-3.5 px-5 font-mono font-bold text-slate-800">
                              {p.transport_return_time}
                            </td>
                            <td className="py-3.5 px-5">
                              {p.rsvp_status === "confirmed" ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                                  Potwierdzony
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                                  Oczekujący
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-slate-500">{p.table_name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              ZAKŁADKA 4: GENERATOR ZAPROSZEŃ I KODÓW QR (.ZIP)
              ========================================================== */}
          {activeTab === "invitations" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Personalizacja Zaproszeń i Paczka Kodów QR dla Drukarni
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pogrupowana lista zaproszeń ({invitationsData.length} szt.) z odmienionymi nagłówkami, linkami RSVP oraz plikami PNG kodów QR.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/invitations/qr-zip",
                        { base_url: window.location.origin },
                        "kody_qr_zaproszenia.zip",
                        "inv-zip"
                      )
                    }
                    disabled={downloadingKey === "inv-zip"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" />
                    <span>
                      {downloadingKey === "inv-zip"
                        ? "Pakuję QR..."
                        : "Pobierz Kody QR (.zip)"}
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/invitations/export",
                        { format: "xlsx", base_url: window.location.origin },
                        "zaproszenia_do_druku.xlsx",
                        "inv-xlsx"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Lista dla Drukarni (.xlsx)</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/invitations/export",
                        { format: "csv", base_url: window.location.origin },
                        "zaproszenia_do_druku.csv",
                        "inv-csv"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-4">Lp.</th>
                        <th className="py-3 px-4">Treść na zaproszenie / kopertę</th>
                        <th className="py-3 px-4">Osoby w grupie</th>
                        <th className="py-3 px-4">Plik QR (PNG)</th>
                        <th className="py-3 px-4">Link RSVP</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invitationsData.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-10 text-center text-slate-400">
                            Brak gości do wygenerowania zaproszeń.
                          </td>
                        </tr>
                      ) : (
                        invitationsData.map((inv, idx) => (
                          <tr key={inv.rsvp_group_id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                              {inv.salutation}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {inv.members_names.join(", ")} ({inv.members_count} os.)
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                                {inv.qr_filename}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => handleCopyUrl(inv.rsvp_url)}
                                className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-medium"
                              >
                                {copiedUrl === inv.rsvp_url ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Skopiowano!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Kopiuj URL</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="py-3.5 px-4">
                              {inv.invite_sent === 1 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Wysłano
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400">
                                  <Clock className="w-3.5 h-3.5" /> Do wręczenia
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              ZAKŁADKA 5: EKSPORT LISTY POD WINIETKI
              ========================================================== */}
          {activeTab === "placecards" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Lista Gości pod Winietki na Stoły ({placeCardsData.length} szt.)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zawiera wyłącznie potwierdzonych gości (status: confirmed). Automatycznie pomija maluchy bez własnego miejsca (waga 0.0) oraz nieuzupełnione „Osoby Towarzyszące”.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/place-cards/export",
                        { format: "xlsx" },
                        "winietki_do_druku.xlsx",
                        "pc-xlsx"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Eksport Winietek (.xlsx)</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFile(
                        "/reports/place-cards/export",
                        { format: "csv" },
                        "winietki_do_druku.csv",
                        "pc-csv"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-5">Lp.</th>
                        <th className="py-3 px-5">Tekst na winietkę</th>
                        <th className="py-3 px-5">Przypisany stół</th>
                        <th className="py-3 px-5">Kategoria</th>
                        <th className="py-3 px-5">Dieta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {placeCardsData.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-10 text-center text-slate-400">
                            Brak potwierdzonych gości kwalifikujących się do druku winietek.
                          </td>
                        </tr>
                      ) : (
                        placeCardsData.map((card, idx) => (
                          <tr key={card.guest_id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-5 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-5 font-bold text-slate-900 text-sm">
                              {card.display_name}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                {card.table_name}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 capitalize text-slate-600">
                              {card.age_category === "adult" ? "Dorosły" : "Dziecko"}
                            </td>
                            <td className="py-3.5 px-5 capitalize text-slate-600">
                              {card.diet}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};