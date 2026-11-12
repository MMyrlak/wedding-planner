import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  X,
  UserCheck,
} from "lucide-react";
import api from "../api/client";

export const Timeline = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    time_start: "14:00",
    title: "",
    description: "",
    assigned_person: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTimeline = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/timeline");
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się pobrać harmonogramu dnia.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  const handleOpenAddModal = () => {
    setEditingEvent(null);
    setFormData({
      time_start: "14:00",
      title: "",
      description: "",
      assigned_person: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setFormData({
      time_start: event.time_start,
      title: event.title,
      description: event.description || "",
      assigned_person: event.assigned_person || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const payload = {
      time_start: formData.time_start.trim(),
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      assigned_person: formData.assigned_person.trim() || null,
    };

    try {
      if (editingEvent) {
        await api.put(`/timeline/${editingEvent.id}`, payload);
      } else {
        await api.post("/timeline", payload);
      }
      setIsModalOpen(false);
      fetchTimeline();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.detail || "Nie udało się zapisać punktu programu."
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id, title) => {
    if (!window.confirm(`Czy na pewno usunąć "${title}" z harmonogramu?`)) return;
    try {
      await api.delete(`/timeline/${id}`);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err) {
      alert("Nie udało się usunąć punktu programu.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Pasek nagłówkowy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Harmonogram Dnia Ślubu i Wesela
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ułóż chronologiczny plan godzinowy i przypisz osoby odpowiedzialne za poszczególne punkty.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Punkt Programu</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Widok osi czasu */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            Ładowanie harmonogramu...
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">
              Brak punktów harmonogramu
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Zaplanuj błogosławieństwo, ceremonię, pierwszy taniec, tort i oczepiny.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Dodaj pierwsze wydarzenie
            </button>
          </div>
        ) : (
          <div className="relative border-l-2 border-emerald-100 ml-4 sm:ml-6 space-y-8 py-2">
            {events.map((event) => (
              <div key={event.id} className="relative pl-6 sm:pl-8 group">
                {/* Wskaźnik kropkowy na osi */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-emerald-600 group-hover:scale-110 transition-transform shadow-xs" />

                <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl font-mono font-bold text-sm border border-emerald-200/50 shadow-2xs">
                        {event.time_start}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">
                        {event.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {event.assigned_person && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{event.assigned_person}</span>
                        </div>
                      )}

                      <button
                        onClick={() => handleOpenEditModal(event)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-colors"
                        title="Edytuj punkt"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.title)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                        title="Usuń punkt"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {event.description && (
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal dodawania / edycji punktu harmonogramu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingEvent ? "Edycja Punktu Programu" : "Nowy Punkt Programu"}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Godzina (HH:MM) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time_start}
                    onChange={(e) =>
                      setFormData({ ...formData, time_start: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nazwa wydarzenia *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="np. Pierwszy Taniec"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Osoba odpowiedzialna / wykonawca
                </label>
                <input
                  type="text"
                  value={formData.assigned_person}
                  onChange={(e) =>
                    setFormData({ ...formData, assigned_person: e.target.value })
                  }
                  placeholder="np. Świadek / DJ / Manager sali"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Szczegóły / Notatki organizacyjne
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="np. Utwór Ed Sheeran - Perfect, włączenie ciężkiego dymu..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                    : editingEvent
                    ? "Zapisz zmiany"
                    : "Dodaj wydarzenie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};