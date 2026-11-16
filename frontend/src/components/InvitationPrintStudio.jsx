import React, { useEffect, useState } from "react";
import {
  Upload,
  FileDown,
  Save,
  QrCode,
  FileImage,
  Sliders,
  Check,
} from "lucide-react";
import api from "../api/client";

const SIZE_PRESETS = [
  { label: "A6 (105 × 148 mm) – 4 na A4", w: 105, h: 148, perPage: 4 },
  { label: "DL (99 × 210 mm) – 2 na A4", w: 99, h: 210, perPage: 2 },
  { label: "A5 (148 × 210 mm) – 2 na A4", w: 148, h: 210, perPage: 2 },
  { label: "Kwadrat (140 × 140 mm) – 2 na A4", w: 140, h: 140, perPage: 2 },
];

export default function InvitationPrintStudio({ invitations = [] }) {
  // Stan szablonu zaproszenia
  const [tpl, setTpl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [exportingInv, setExportingInv] = useState(false);

  // Podgląd konkretnego zaproszenia z listy
  const [previewIndex, setPreviewIndex] = useState(0);
  const [perPage, setPerPage] = useState(4);
  const [cropMarks, setCropMarks] = useState(true);

// Stan generatora bilecików QR
  const [qrMessage, setQrMessage] = useState(
    "Potwierdźcie swoje przybycie online.\nZeskanuj kod QR aparatem w telefonie:"
  );
  const [qrCardW, setQrCardW] = useState(85);
  const [qrCardH, setQrCardH] = useState(55);
  const [qrFontFamily, setQrFontFamily] = useState("DejaVuSerif");
  const [qrFontSize, setQrFontSize] = useState(9.5);
  const [qrTextColor, setQrTextColor] = useState("#1f2937");
  const [qrBgColor, setQrBgColor] = useState("#ffffff");
  const [qrBorderColor, setQrBorderColor] = useState("#10b981");
  const [qrBorderStyle, setQrBorderStyle] = useState("double");
  const [qrColor, setQrColor] = useState("#065f46");
  const [qrStyle, setQrStyle] = useState("rounded");
  const [qrPosition, setQrPosition] = useState("right");
  const [qrShowSalutation, setQrShowSalutation] = useState(true);
  const [qrCropMarks, setQrCropMarks] = useState(true);
  const [exportingQr, setExportingQr] = useState(false);

  const QR_THEME_PRESETS = [
    {
      name: "Szmaragd i Biel",
      bg: "#ffffff",
      text: "#1f2937",
      border: "#10b981",
      qr: "#065f46",
    },
    {
      name: "Złoto i Krem",
      bg: "#fffbeb",
      text: "#451a03",
      border: "#d97706",
      qr: "#92400e",
    },
    {
      name: "Pudrowy Róż",
      bg: "#fff1f2",
      text: "#4c0519",
      border: "#f43f5e",
      qr: "#9f1239",
    },
    {
      name: "Klasyczna Czerń",
      bg: "#ffffff",
      text: "#0f172a",
      border: "#334155",
      qr: "#0f172a",
    },
  ];

  useEffect(() => {
    const loadTpl = async () => {
      try {
        const res = await api.get("/invitations/template");
        if (res.data) setTpl(res.data);
      } catch (err) {
        console.error("Błąd pobierania szablonu:", err);
      }
    };
    loadTpl();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const res = await api.post("/invitations/template/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTpl(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Nie udało się wgrać szablonu.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!tpl) return;
    try {
      setSaving(true);
      await api.patch("/invitations/template/settings", {
        width_mm: Number(tpl.width_mm),
        height_mm: Number(tpl.height_mm),
        text_x_pct: Number(tpl.text_x_pct),
        text_y_pct: Number(tpl.text_y_pct),
        box_w_pct: Number(tpl.box_w_pct),
        box_h_pct: Number(tpl.box_h_pct),
        font_family: tpl.font_family,
        font_size: Number(tpl.font_size),
        font_color: tpl.font_color,
        text_align: tpl.text_align,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      console.error("Błąd zapisu ustawień:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvitationsPdf = async () => {
    if (!tpl) return;
    const salutations = invitations
      .map((inv) => (inv.salutation || inv.invitation_salutation || "").trim())
      .filter(Boolean);

    if (salutations.length === 0) {
      alert("Brak wygenerowanych tekstów zaproszeń na liście gości.");
      return;
    }

    try {
      setExportingInv(true);
      await handleSaveSettings();
      const res = await api.post(
        "/invitations/export-pdf",
        { salutations, per_page: Number(perPage), crop_marks: cropMarks },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Zaproszenia_A4.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Błąd podczas generowania pliku PDF z zaproszeniami.");
    } finally {
      setExportingInv(false);
    }
  };

  const handleDownloadQrCardsPdf = async () => {
    const origin = window.location.origin;
    const cards = invitations
      .filter((inv) => inv.rsvp_url || inv.rsvp_token)
      .map((inv) => ({
        salutation: (inv.salutation || inv.invitation_salutation || "").trim(),
        rsvp_url: inv.rsvp_url || `${origin}/rsvp/${inv.rsvp_token}`,
      }));

    if (cards.length === 0) {
      alert("Brak zaproszeń z wygenerowanym linkiem RSVP.");
      return;
    }

    try {
      setExportingQr(true);
      const res = await api.post(
        "/invitations/qr-cards-pdf",
        {
          cards,
          custom_message: qrMessage,
          card_w_mm: Number(qrCardW),
          card_h_mm: Number(qrCardH),
          font_family: qrFontFamily,
          font_size: Number(qrFontSize),
          text_color: qrTextColor,
          bg_color: qrBgColor,
          border_color: qrBorderColor,
          border_style: qrBorderStyle,
          qr_color: qrColor,
          qr_style: qrStyle,
          qr_position: qrPosition,
          show_salutation: qrShowSalutation,
          crop_marks: qrCropMarks,
        },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Bileciki_QR_A4.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Błąd podczas generowania bilecików QR.");
    } finally {
      setExportingQr(false);
    }
  };

  const sampleText =
    invitations[previewIndex]?.salutation ||
    invitations[previewIndex]?.invitation_salutation ||
    "Emilkę Łabaj";

  return (
    <div className="space-y-8">
      {/* SEKCJA 1: KREATOR GOTOWYCH ZAPROSZEŃ PDF (PNG / DOCX) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <FileImage className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Generator gotowych zaproszeń do druku (PNG / DOCX → PDF A4)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Wgraj pusty wzór graficzny zaproszenia, ustaw pole na personalizację i pobierz arkusze A4.
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer transition">
            <Upload className="w-4 h-4" />
            {uploading ? "Przetwarzanie wzoru..." : "Wgraj wzór (PNG / DOCX)"}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {!tpl ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">
            Wgraj plik <strong>.png</strong>, <strong>.jpg</strong> lub <strong>.docx</strong> z projektem zaproszenia, aby skonfigurować rozmieszczenie tekstu.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* LEWA KOLUMNA: Podgląd na żywo */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Podgląd dla gościa:</span>
                {invitations.length > 0 && (
                  <select
                    value={previewIndex}
                    onChange={(e) => setPreviewIndex(Number(e.target.value))}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    {invitations.map((inv, idx) => (
                      <option key={idx} value={idx}>
                        {inv.salutation || inv.invitation_salutation || `Zaproszenie #${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div
                className="relative w-full max-w-[380px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden shadow-md bg-white"
                style={{ aspectRatio: `${tpl.width_mm} / ${tpl.height_mm}` }}
              >
                <img
                  src={`data:image/png;base64,${tpl.image_base64}`}
                  alt="Wzór zaproszenia"
                  className="w-full h-full object-fill select-none"
                />

                {/* Ramka pozycjonowania tekstu */}
                <div
                  style={{
                    position: "absolute",
                    left: `${tpl.text_x_pct}%`,
                    top: `${tpl.text_y_pct}%`,
                    width: `${tpl.box_w_pct}%`,
                    height: `${tpl.box_h_pct}%`,
                    color: tpl.font_color,
                    fontSize: `${tpl.font_size}px`,
                    textAlign: tpl.text_align,
                    fontFamily: tpl.font_family.includes("Serif") ? "Georgia, serif" : "sans-serif",
                  }}
                  className="border-2 border-emerald-500 bg-emerald-500/10 px-1 leading-snug break-words overflow-hidden"
                >
                  {sampleText}
                </div>
              </div>
            </div>

            {/* PRAWA KOLUMNA: Kontrolki wymiarów, czcionki i układu A4 */}
            <div className="lg:col-span-6 space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gotowy format zaproszenia
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SIZE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setTpl({ ...tpl, width_mm: p.w, height_mm: p.h });
                        setPerPage(p.perPage);
                      }}
                      className="text-left px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Szerokość zaproszenia (mm)
                  </label>
                  <input
                    type="number"
                    value={tpl.width_mm}
                    onChange={(e) => setTpl({ ...tpl, width_mm: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Wysokość zaproszenia (mm)
                  </label>
                  <input
                    type="number"
                    value={tpl.height_mm}
                    onChange={(e) => setTpl({ ...tpl, height_mm: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Suwaki X / Y / Szerokość / Wysokość ramki */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  Pozycja i wymiary pola tekstowego (%)
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label>
                    Od lewej (X): <strong>{tpl.text_x_pct}%</strong>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={tpl.text_x_pct}
                      onChange={(e) => setTpl({ ...tpl, text_x_pct: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                  <label>
                    Od góry (Y): <strong>{tpl.text_y_pct}%</strong>
                    <input
                      type="range"
                      min="0"
                      max="95"
                      value={tpl.text_y_pct}
                      onChange={(e) => setTpl({ ...tpl, text_y_pct: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                  <label>
                    Szerokość pola: <strong>{tpl.box_w_pct}%</strong>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={tpl.box_w_pct}
                      onChange={(e) => setTpl({ ...tpl, box_w_pct: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                  <label>
                    Wysokość pola: <strong>{tpl.box_h_pct}%</strong>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={tpl.box_h_pct}
                      onChange={(e) => setTpl({ ...tpl, box_h_pct: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                </div>
              </div>

              {/* Czcionka, rozmiar, kolor, wyrównanie */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Czcionka</label>
                  <select
                    value={tpl.font_family}
                    onChange={(e) => setTpl({ ...tpl, font_family: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="DejaVuSerif">Szeryfowa</option>
                    <option value="DejaVuSerifBold">Szeryfowa Pogrubiona</option>
                    <option value="DejaVuSans">Bezszeryfowa</option>
                    <option value="DejaVuSansBold">Bezszeryfowa Pogrubiona</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Rozmiar (pt)</label>
                  <input
                    type="number"
                    min="8"
                    max="48"
                    value={tpl.font_size}
                    onChange={(e) => setTpl({ ...tpl, font_size: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Wyrównanie</label>
                  <select
                    value={tpl.text_align}
                    onChange={(e) => setTpl({ ...tpl, text_align: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="center">Środek</option>
                    <option value="left">Do lewej</option>
                    <option value="right">Do prawej</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Kolor tekstu</label>
                  <input
                    type="color"
                    value={tpl.font_color}
                    onChange={(e) => setTpl({ ...tpl, font_color: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-600"
                  />
                </div>
              </div>

              {/* Ustawienia druku A4 */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium"
                  >
                    <option value={1}>1 zaproszenie na kartkę A4</option>
                    <option value={2}>2 zaproszenia na kartkę A4</option>
                    <option value={4}>4 zaproszenia na kartkę A4</option>
                  </select>

                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cropMarks}
                      onChange={(e) => setCropMarks(e.target.checked)}
                    />
                    Linie cięcia
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer"
                  >
                    {savedNotice ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
                    {savedNotice ? "Zapisano" : "Zapisz układ"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadInvitationsPdf}
                    disabled={exportingInv}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    {exportingInv ? "Generowanie PDF..." : `Pobierz PDF (${invitations.length} szt.)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA 2: OSOBNE BILECIKI Z KODEM QR NA A4 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Kreator bilecików z customowym kodem QR (arkusz A4)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dopasuj kolorystykę, ramkę, układ oraz styl modułów kodu QR z podglądem na żywo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QR_THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setQrBgColor(preset.bg);
                  setQrTextColor(preset.text);
                  setQrBorderColor(preset.border);
                  setQrColor(preset.qr);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
              >
                <span
                  className="w-3 h-3 rounded-full border border-slate-300"
                  style={{ backgroundColor: preset.qr }}
                />
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 text-xs">
          {/* LEWA STRONA: Podgląd na żywo bileciku */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-medium text-slate-400 mb-3">
              Podgląd bileciku ({qrCardW} × {qrCardH} mm)
            </span>

            <div
              style={{
                aspectRatio: `${qrCardW} / ${qrCardH}`,
                backgroundColor: qrBgColor,
                color: qrTextColor,
                fontFamily: qrFontFamily.includes("Serif") ? "Georgia, serif" : "sans-serif",
              }}
              className="w-full max-w-[340px] shadow-md p-2.5 relative flex items-center justify-center transition-all"
            >
              {/* Wewnętrzna ramka dekoracyjna */}
              <div
                style={{
                  borderColor: qrBorderColor,
                  borderStyle:
                    qrBorderStyle === "none"
                      ? "none"
                      : qrBorderStyle === "double"
                      ? "double"
                      : qrBorderStyle === "dashed"
                      ? "dashed"
                      : "solid",
                  borderWidth: qrBorderStyle === "double" ? "3px" : qrBorderStyle === "none" ? "0px" : "1.5px",
                }}
                className={`w-full h-full p-3 flex gap-3 items-center ${
                  qrPosition === "bottom"
                    ? "flex-col justify-between text-center"
                    : qrPosition === "left"
                    ? "flex-row-reverse justify-between text-left"
                    : "flex-row justify-between text-left"
                }`}
              >
                <div className="flex-1 min-w-0 leading-snug break-words" style={{ fontSize: `${Math.max(10, qrFontSize * 1.15)}px` }}>
                  {qrShowSalutation && (
                    <div className="font-bold mb-1 truncate">{sampleText}</div>
                  )}
                  <div className="whitespace-pre-line">{qrMessage}</div>
                </div>

                {/* Stylizowany podgląd kodu QR */}
                <div
                  style={{ borderColor: qrColor }}
                  className={`shrink-0 p-1.5 border ${
                    qrStyle === "rounded" || qrStyle === "dots" ? "rounded-xl" : "rounded-none"
                  } ${qrPosition === "bottom" ? "w-20 h-20" : "w-24 h-24"} flex items-center justify-center`}
                >
                  <svg viewBox="0 0 25 25" className="w-full h-full" style={{ fill: qrColor }}>
                    {/* 3 narożniki pozycjonujące */}
                    <rect x="1" y="1" width="7" height="7" rx={qrStyle === "rounded" ? 2 : qrStyle === "dots" ? 3.5 : 0} />
                    <rect x="2.5" y="2.5" width="4" height="4" style={{ fill: qrBgColor }} rx={qrStyle === "dots" ? 2 : 0} />
                    <rect x="3.5" y="3.5" width="2" height="2" rx={qrStyle === "dots" ? 1 : 0} />

                    <rect x="17" y="1" width="7" height="7" rx={qrStyle === "rounded" ? 2 : qrStyle === "dots" ? 3.5 : 0} />
                    <rect x="18.5" y="2.5" width="4" height="4" style={{ fill: qrBgColor }} rx={qrStyle === "dots" ? 2 : 0} />
                    <rect x="19.5" y="3.5" width="2" height="2" rx={qrStyle === "dots" ? 1 : 0} />

                    <rect x="1" y="17" width="7" height="7" rx={qrStyle === "rounded" ? 2 : qrStyle === "dots" ? 3.5 : 0} />
                    <rect x="2.5" y="18.5" width="4" height="4" style={{ fill: qrBgColor }} rx={qrStyle === "dots" ? 2 : 0} />
                    <rect x="3.5" y="19.5" width="2" height="2" rx={qrStyle === "dots" ? 1 : 0} />

                    {/* Moduły danych */}
                    {[
                      [10, 2], [13, 2], [11, 5], [14, 6], [10, 9], [12, 11], [15, 10],
                      [3, 11], [6, 12], [9, 14], [13, 14], [17, 11], [20, 13], [22, 11],
                      [11, 17], [14, 18], [17, 17], [20, 19], [12, 21], [16, 22], [21, 22],
                    ].map(([cx, cy], idx) =>
                      qrStyle === "dots" ? (
                        <circle key={idx} cx={cx + 1} cy={cy + 1} r="0.95" />
                      ) : (
                        <rect
                          key={idx}
                          x={cx}
                          y={cy}
                          width={qrStyle === "gapped" ? 1.5 : 1.9}
                          height={qrStyle === "gapped" ? 1.5 : 1.9}
                          rx={qrStyle === "rounded" ? 0.6 : 0}
                        />
                      )
                    )}
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* PRAWA STRONA: Kontrolki edycji */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Treść na bileciku QR
              </label>
              <textarea
                rows={2}
                value={qrMessage}
                onChange={(e) => setQrMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={qrShowSalutation}
                    onChange={(e) => setQrShowSalutation(e.target.checked)}
                  />
                  Nagłówek z odmianą gości
                </label>

                <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={qrCropMarks}
                    onChange={(e) => setQrCropMarks(e.target.checked)}
                  />
                  Linie cięcia na arkuszu
                </label>
              </div>
            </div>

            {/* Wymiary, układ i styl kodu QR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-1">Szerokość (mm)</label>
                <input
                  type="number"
                  value={qrCardW}
                  onChange={(e) => setQrCardW(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Wysokość (mm)</label>
                <input
                  type="number"
                  value={qrCardH}
                  onChange={(e) => setQrCardH(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Pozycja kodu QR</label>
                <select
                  value={qrPosition}
                  onChange={(e) => setQrPosition(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="right">Po prawej</option>
                  <option value="left">Po lewej</option>
                  <option value="bottom">Pod tekstem (środek)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Styl pikseli QR</label>
                <select
                  value={qrStyle}
                  onChange={(e) => setQrStyle(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="rounded">Zaokrąglony</option>
                  <option value="dots">Kropki</option>
                  <option value="gapped">Nowoczesna siatka</option>
                  <option value="square">Klasyczny kwadrat</option>
                </select>
              </div>
            </div>

            {/* Czcionka i ramka */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-1">Czcionka</label>
                <select
                  value={qrFontFamily}
                  onChange={(e) => setQrFontFamily(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="DejaVuSerif">Szeryfowa</option>
                  <option value="DejaVuSans">Bezszeryfowa</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Rozmiar tekstu (pt)</label>
                <input
                  type="number"
                  step="0.5"
                  min="7"
                  max="18"
                  value={qrFontSize}
                  onChange={(e) => setQrFontSize(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Styl ramki</label>
                <select
                  value={qrBorderStyle}
                  onChange={(e) => setQrBorderStyle(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="double">Podwójna elegancka</option>
                  <option value="solid">Pojedyncza ciągła</option>
                  <option value="dashed">Przerywana</option>
                  <option value="none">Bez ramki</option>
                </select>
              </div>
            </div>

            {/* Paleta 4 kolorów */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-1">Kolor kodu QR</label>
                <input
                  type="color"
                  value={qrColor}
                  onChange={(e) => setQrColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Kolor tekstu</label>
                <input
                  type="color"
                  value={qrTextColor}
                  onChange={(e) => setQrTextColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Kolor ramki</label>
                <input
                  type="color"
                  value={qrBorderColor}
                  onChange={(e) => setQrBorderColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Tło bileciku</label>
                <input
                  type="color"
                  value={qrBgColor}
                  onChange={(e) => setQrBgColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadQrCardsPdf}
              disabled={exportingQr}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer transition-colors"
            >
              <FileDown className="w-4 h-4" />
              {exportingQr
                ? "Generowanie bilecików QR..."
                : `Pobierz PDF z bilecikami QR na A4 (${invitations.length} szt.)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}