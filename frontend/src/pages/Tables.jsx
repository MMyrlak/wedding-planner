import React, { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import {
  Grid,
  Plus,
  Users,
  Utensils,
  Hotel,
  Bus,
  Trash2,
  Edit2,
  Circle,
  Square,
  AlertCircle,
  GripVertical,
  X,
  Search,
  MessageSquareWarning,
} from "lucide-react";
import api from "../api/client";

export const Tables = () => {
  const [tables, setTables] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchUnassigned, setSearchUnassigned] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 10,
    shape: "round",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [tablesRes, guestsRes] = await Promise.all([
        api.get("/tables"),
        api.get("/guests"),
      ]);
      setTables(tablesRes.data);
      setGuests(guestsRes.data);
    } catch (err) {
      console.error(err);
      setError("Nie udało się pobrać danych stołów lub gości.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const guestId = parseInt(draggableId.replace("guest-", ""), 10);
    const targetDroppableId = destination.droppableId;

    let targetTableId = null;
    if (targetDroppableId !== "unassigned") {
      targetTableId = parseInt(targetDroppableId.replace("table-", ""), 10);
    }

    if (targetTableId !== null) {
      const targetTable = tables.find((t) => t.id === targetTableId);
      const currentAssignedCount = guests.filter(
        (g) => g.table_id === targetTableId && g.id !== guestId
      ).length;

      if (targetTable && currentAssignedCount >= targetTable.capacity) {
        alert(
          `Stół "${targetTable.name}" jest już w pełni zapełniony (limit: ${targetTable.capacity} miejsc).`
        );
        return;
      }
    }

    const previousGuests = [...guests];
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, table_id: targetTableId } : g))
    );

    try {
      await api.patch(`/guests/${guestId}/assign-table`, {
        table_id: targetTableId,
      });
      const updatedTables = await api.get("/tables");
      setTables(updatedTables.data);
    } catch (err) {
      console.error("Błąd podczas przypisywania stołu:", err);
      alert(
        err.response?.data?.detail ||
          "Wystąpił błąd podczas zmiany przypisania stołu."
      );
      setGuests(previousGuests);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTable(null);
    setFormData({
      name: `Stół ${tables.length + 1}`,
      capacity: 10,
      shape: "round",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (table) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      capacity: table.capacity,
      shape: table.shape,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    const payload = {
      name: formData.name.trim(),
      capacity: Number(formData.capacity),
      shape: formData.shape,
    };

    try {
      if (editingTable) {
        await api.put(`/tables/${editingTable.id}`, payload);
      } else {
        await api.post("/tables", payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.detail || "Nie udało się zapisać konfiguracji stołu."
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteTable = async (tableId, tableName) => {
    if (
      !window.confirm(
        `Czy na pewno chcesz usunąć stół "${tableName}"? Przypisani goście powrócą na listę nieprzypisanych.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/tables/${tableId}`);
      fetchData();
    } catch (err) {
      alert("Nie udało się usunąć stołu.");
    }
  };

  const unassignedGuests = guests.filter(
    (g) =>
      g.table_id === null &&
      `${g.first_name} ${g.last_name}`
        .toLowerCase()
        .includes(searchUnassigned.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Pasek nagłówkowy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Plan Stołów i Usadzanie Gości
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Przeciągaj gości między stołami oraz z listy nieprzypisanych (Drag & Drop). Zwracaj uwagę na tagi relacji i diet.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Nowy Stół</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Główny obszar Drag & Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Lewy panel boczny: Nieprzypisani goście */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[760px]">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-bold text-slate-900 text-sm">Nieprzypisani</h2>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {unassignedGuests.length}
                </span>
              </div>

              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchUnassigned}
                  onChange={(e) => setSearchUnassigned(e.target.value)}
                  placeholder="Filtruj listę..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <Droppable droppableId="unassigned">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 p-3 overflow-y-auto space-y-2 transition-colors rounded-b-2xl ${
                    snapshot.isDraggingOver ? "bg-emerald-50/50" : "bg-slate-50/40"
                  }`}
                >
                  {unassignedGuests.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                      <Users className="w-8 h-8 stroke-slate-300 mb-2" />
                      <p className="text-xs font-medium">Wszyscy goście zostali przypisani do stołów!</p>
                    </div>
                  ) : (
                    unassignedGuests.map((guest, index) => (
                      <Draggable
                        key={guest.id}
                        draggableId={`guest-${guest.id}`}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={`p-2.5 bg-white border rounded-xl shadow-2xs select-none transition-all ${
                              dragSnapshot.isDragging
                                ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                                : guest.seating_notes
                                ? "border-amber-300 dark:border-amber-700"
                                : "border-slate-200/80 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                                <div className="truncate">
                                  <p className="text-xs font-semibold text-slate-800 truncate">
                                    {guest.first_name} {guest.last_name}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-medium capitalize">
                                      {guest.age_category}
                                    </span>
                                    {guest.diet && guest.diet !== "standard" && (
                                      <span className="text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1 rounded font-medium">
                                        {guest.diet}
                                      </span>
                                    )}
                                    {guest.needs_hotel === 1 && (
                                      <Hotel className="w-3 h-3 text-indigo-500 shrink-0" title="Hotel" />
                                    )}
                                    {guest.needs_transport === 1 && (
                                      <Bus className="w-3 h-3 text-teal-500 shrink-0" title="Transport" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {guest.seating_notes && (
                              <div className="mt-1.5 pl-6 flex items-start gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/60 px-2 py-1 rounded-md border border-amber-200/70 dark:border-amber-800">
                                <MessageSquareWarning className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                                <span className="leading-tight">{guest.seating_notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Prawa strona: Siatka stołów weselnych */}
          <div className="lg:col-span-3">
            {tables.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                <Grid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Brak utworzonych stołów
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Rozpocznij planowanie sali, dodając pierwszy stół okrągły lub podłużny.
                </p>
                <button
                  onClick={handleOpenAddModal}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Utwórz pierwszy stół
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {tables.map((table) => {
                  const tableGuests = guests.filter((g) => g.table_id === table.id);
                  const isFull = tableGuests.length >= table.capacity;

                  return (
                    <div
                      key={table.id}
                      className={`bg-white rounded-2xl border transition-shadow shadow-xs flex flex-col h-[390px] overflow-hidden ${
                        isFull ? "border-amber-200 dark:border-amber-800" : "border-slate-100"
                      }`}
                    >
                      {/* Nagłówek pojedynczego stołu */}
                      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              table.shape === "round"
                                ? "bg-wedding-sand text-wedding-goldDark"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {table.shape === "round" ? (
                              <Circle className="w-4 h-4 fill-current" />
                            ) : (
                              <Square className="w-4 h-4 fill-current" />
                            )}
                          </div>
                          <div className="truncate">
                            <h3 className="font-bold text-slate-900 text-xs truncate">
                              {table.name}
                            </h3>
                            <span className="text-[10px] text-slate-400">
                              {table.shape === "round" ? "Okrągły" : "Prostokątny"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isFull
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {tableGuests.length} / {table.capacity}
                          </span>

                          <button
                            onClick={() => handleOpenEditModal(table)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                            title="Edytuj stół"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTable(table.id, table.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                            title="Usuń stół"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Obszar droppable wewnątrz stołu */}
                      <Droppable droppableId={`table-${table.id}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 p-2.5 overflow-y-auto space-y-1.5 transition-colors ${
                              snapshot.isDraggingOver
                                ? isFull
                                  ? "bg-rose-50/50"
                                  : "bg-emerald-50/50"
                                : "bg-white"
                            }`}
                          >
                            {tableGuests.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-100 rounded-xl">
                                <p className="text-[11px] text-slate-400">
                                  Przeciągnij gości tutaj
                                </p>
                              </div>
                            ) : (
                              tableGuests.map((guest, index) => (
                                <Draggable
                                  key={guest.id}
                                  draggableId={`guest-${guest.id}`}
                                  index={index}
                                >
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      className={`p-2 bg-slate-50/80 border rounded-lg shadow-2xs select-none transition-all text-xs ${
                                        dragSnapshot.isDragging
                                          ? "border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/20"
                                          : guest.seating_notes
                                          ? "border-amber-300 dark:border-amber-700"
                                          : "border-slate-100 hover:border-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                          <span className="font-semibold text-slate-800 truncate">
                                            {guest.first_name} {guest.last_name}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          {guest.diet && guest.diet !== "standard" && (
                                            <Utensils
                                              className="w-3 h-3 text-amber-600"
                                              title={`Dieta: ${guest.diet}`}
                                            />
                                          )}
                                          {guest.needs_hotel === 1 && (
                                            <Hotel
                                              className="w-3 h-3 text-indigo-500"
                                              title={`Hotel${guest.room_number ? `: ${guest.room_number}` : ""}`}
                                            />
                                          )}
                                          {guest.needs_transport === 1 && (
                                            <Bus
                                              className="w-3 h-3 text-teal-500"
                                              title={`Bus${guest.transport_pickup ? `: ${guest.transport_pickup}` : ""}`}
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {guest.seating_notes && (
                                        <div className="mt-1 pl-5 flex items-start gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                          <MessageSquareWarning className="w-2.5 h-2.5 text-amber-600 shrink-0 mt-0.5" />
                                          <span className="leading-tight">{guest.seating_notes}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              ))
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DragDropContext>

      {/* Modal dodawania / edycji stołu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingTable ? "Edytuj Stół" : "Nowy Stół"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nazwa stołu *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="np. Stół Rodziny Pana Młodego"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pojemność (liczba miejsc) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kształt stołu
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, shape: "round" })}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.shape === "round"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Circle className="w-3.5 h-3.5" />
                    <span>Okrągły</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, shape: "rectangular" })
                    }
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.shape === "rectangular"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Prostokątny</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50"
                >
                  {formSubmitting
                    ? "Zapisuję..."
                    : editingTable
                    ? "Zapisz zmiany"
                    : "Dodaj stół"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};