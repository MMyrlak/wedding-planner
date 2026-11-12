import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  Sparkles,
  Calendar,
  User,
  Filter,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import api from "../api/client";

const CHECKLIST_STAGES = [
  "12+ miesięcy przed",
  "6–12 miesięcy przed",
  "3–6 miesięcy przed",
  "1 miesiąc przed",
  "Tydzień przed",
  "Dzień ślubu i po",
];

const ASSIGNEE_OPTIONS = [
  "Para Młoda",
  "Panna Młoda",
  "Pan Młody",
  "Świadkowie",
  "Rodzice",
  "Konsultant Ślubny",
];

export const Checklist = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  // Filtry
  const [stageFilter, setStageFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal dodawania / edycji
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    stage: CHECKLIST_STAGES[0],
    title: "",
    description: "",
    assigned_to: "Para Młoda",
    due_date: "",
    is_completed: 0,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTasks = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (stageFilter) params.stage = stageFilter;
      if (assigneeFilter) params.assigned_to = assigneeFilter;
      if (statusFilter !== "") params.is_completed = Number(statusFilter);

      const res = await api.get("/checklist", { params });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się pobrać listy zadań.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [stageFilter, assigneeFilter, statusFilter]);

  const handleToggleComplete = async (task) => {
    const nextVal = task.is_completed === 1 ? 0 : 1;
    try {
      await api.put(`/checklist/${task.id}`, { is_completed: nextVal });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: nextVal } : t))
      );
    } catch (err) {
      alert("Nie udało się zaktualizować statusu zadania.");
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await api.post("/checklist/seed-defaults");
      setTasks(res.data);
    } catch (err) {
      alert("Nie udało się wczytać szablonu zadań.");
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTask(null);
    setFormData({
      stage: stageFilter || CHECKLIST_STAGES[0],
      title: "",
      description: "",
      assigned_to: "Para Młoda",
      due_date: "",
      is_completed: 0,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      stage: task.stage,
      title: task.title,
      description: task.description || "",
      assigned_to: task.assigned_to || "Para Młoda",
      due_date: task.due_date || "",
      is_completed: task.is_completed,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const payload = {
      stage: formData.stage.trim(),
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      assigned_to: formData.assigned_to.trim() || "Para Młoda",
      due_date: formData.due_date || null,
      is_completed: Number(formData.is_completed),
    };

    try {
      if (editingTask) {
        await api.put(`/checklist/${editingTask.id}`, payload);
      } else {
        await api.post("/checklist", payload);
      }
      setIsModalOpen(false);
      fetchTasks();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || "Nie udało się zapisać zadania.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteTask = async (id, title) => {
    if (!window.confirm(`Czy na pewno usunąć zadanie "${title}"?`)) return;
    try {
      await api.delete(`/checklist/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert("Nie udało się usunąć zadania.");
    }
  };

  const completedCount = tasks.filter((t) => t.is_completed === 1).length;
  const progressPercent =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Grupowanie zadań po etapach czasowych
  const stagesOrder = [...CHECKLIST_STAGES];
  tasks.forEach((t) => {
    if (!stagesOrder.includes(t.stage)) stagesOrder.push(t.stage);
  });

  const groupedStages = stagesOrder
    .map((stageName) => ({
      stageName,
      items: tasks.filter((t) => t.stage === stageName),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Checklista Przedślubna
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Podziel przygotowania na etapy czasowe i deleguj zadania członkom zespołu organizacyjnego.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tasks.length === 0 && !loading && (
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{seeding ? "Dodaję..." : "Wczytaj szablon 11 zadań"}</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj Zadanie</span>
          </button>
        </div>
      </div>

      {/* Pasek postępu przygotowań */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800">
            Postęp przygotowań weselnych
          </span>
          <span className="text-xs font-bold text-emerald-700">
            {completedCount} / {tasks.length} ukończonych ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Filtry */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtruj:</span>
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Wszystkie etapy</option>
          {CHECKLIST_STAGES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Wszyscy odpowiedzialni</option>
          {ASSIGNEE_OPTIONS.map((asg) => (
            <option key={asg} value={asg}>
              {asg}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Wszystkie statusy</option>
          <option value="0">Do zrobienia</option>
          <option value="1">Zrealizowane</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista etapów i zadań */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          Ładowanie listy zadań...
        </div>
      ) : groupedStages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">
            Brak zadań na liście
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Dodaj własne zadania lub załaduj gotową listę 11 kroków organizacji wesela jednym kliknięciem.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Załaduj gotowy szablon zadań
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedStages.map((group) => {
            const groupDone = group.items.filter((i) => i.is_completed === 1).length;
            return (
              <div
                key={group.stageName}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 text-sm">
                    {group.stageName}
                  </h2>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {groupDone} / {group.items.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.items.map((task) => {
                    const isDone = task.is_completed === 1;
                    return (
                      <div
                        key={task.id}
                        className={`p-4 sm:px-6 flex items-start justify-between gap-4 transition-colors ${
                          isDone ? "bg-slate-50/40 opacity-75" : "hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(task)}
                            className="mt-0.5 text-emerald-600 hover:scale-110 transition-transform shrink-0"
                            title={isDone ? "Oznacz jako niezrobione" : "Oznacz jako wykonane"}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 fill-emerald-50" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-600" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold ${
                                isDone
                                  ? "line-through text-slate-400"
                                  : "text-slate-900"
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {task.assigned_to && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                                  <User className="w-3 h-3 text-emerald-600" />
                                  {task.assigned_to}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[11px] font-medium">
                                  <Calendar className="w-3 h-3" />
                                  Termin: {task.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(task)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edytuj zadanie"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Usuń zadanie"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal zadania */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingTask ? "Edycja Zadania" : "Nowe Zadanie Ślubne"}
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
                  Etap czasowy *
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) =>
                    setFormData({ ...formData, stage: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CHECKLIST_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tytuł zadania *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="np. Odebranie obrączek od jubilera"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Osoba odpowiedzialna
                  </label>
                  <input
                    type="text"
                    list="assignees-list"
                    value={formData.assigned_to}
                    onChange={(e) =>
                      setFormData({ ...formData, assigned_to: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="assignees-list">
                    {ASSIGNEE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Termin (opcjonalnie)
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opis / Szczegóły
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Dodatkowe ustalenia..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
                    : editingTask
                    ? "Zapisz zmiany"
                    : "Dodaj zadanie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};