import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Heart,
  CheckCircle2,
  XCircle,
  Hotel,
  Utensils,
  AlertCircle,
  Bus,
} from "lucide-react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const PublicRsvp = () => {
  const { token } = useParams();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${API_BASE_URL}/guests/rsvp/${token}`);
        setGuests(res.data);
      } catch (err) {
        console.error(err);
        setError("Nie znaleziono zaproszenia lub podany link jest nieaktywny.");
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchInvite();
  }, [token]);

  const handleGuestChange = (id, field, value) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      guests: guests.map((g) => ({
        id: g.id,
        rsvp_status: g.rsvp_status,
        diet: g.diet || "standard",
        needs_hotel: g.needs_hotel || 0,
        needs_transport: g.needs_transport || 0,
        transport_pickup: g.needs_transport === 1 ? (g.transport_pickup || "").trim() || null : null,
        transport_return_time: g.needs_transport === 1 ? (g.transport_return_time || "").trim() || null : null,
      })),
    };

    try {
      await axios.post(`${API_BASE_URL}/guests/rsvp/${token}`, payload);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Wystąpił problem z przesłaniem odpowiedzi. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-500">
            Wczytywanie zaproszenia weselnego...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-rose-100 shadow-md text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Brak zaproszenia</h2>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-100 shadow-lg text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Dziękujemy!</h2>
          <p className="text-sm text-slate-600 mt-2">
            Twoja odpowiedź na zaproszenie weselne została pomyślnie zapisana.
          </p>
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-slate-700">
            Cieszymy się na wspólne chwile! Jeśli zmienisz plany, możesz w każdej chwili zaktualizować swój wybór, korzystając z tego samego linku.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Heart className="w-6 h-6 fill-emerald-600 text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Potwierdzenie Przybycia
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Będziemy zaszczyceni Waszą obecnością. Prosimy o potwierdzenie udziału oraz preferencji organizacyjnych.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {guests.map((g) => (
            <div
              key={g.id}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-slate-900 text-base">
                  {g.first_name} {g.last_name}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {g.age_category === "adult" && "Osoba dorosła"}
                  {g.age_category === "child" && "Dziecko"}
                  {g.age_category === "toddler" && "Maluch"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Czy będziesz z nami?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleGuestChange(g.id, "rsvp_status", "confirmed")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      g.rsvp_status === "confirmed"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Będę obecny(a)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGuestChange(g.id, "rsvp_status", "declined")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      g.rsvp_status === "declined"
                        ? "bg-rose-50 border-rose-500 text-rose-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Niestety nie</span>
                  </button>
                </div>
              </div>

              {g.rsvp_status === "confirmed" && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-slate-500" />
                      <span>Preferencje dietetyczne</span>
                    </label>
                    <select
                      value={g.diet}
                      onChange={(e) => handleGuestChange(g.id, "diet", e.target.value)}
                      className="w-full text-sm py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="standard">Standardowa (tradycyjna)</option>
                      <option value="wege">Wegetariańska</option>
                      <option value="wegan">Wegańska</option>
                      <option value="bezglutenowa">Bezglutenowa</option>
                      <option value="bez laktozy">Bez laktozy</option>
                    </select>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={g.needs_hotel === 1}
                        onChange={(e) =>
                          handleGuestChange(g.id, "needs_hotel", e.target.checked ? 1 : 0)
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Hotel className="w-4 h-4 text-indigo-600" />
                        <span>Potrzebuję noclegu w hotelu</span>
                      </div>
                    </label>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={g.needs_transport === 1}
                        onChange={(e) =>
                          handleGuestChange(g.id, "needs_transport", e.target.checked ? 1 : 0)
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Bus className="w-4 h-4 text-teal-600" />
                        <span>Chcę skorzystać ze zorganizowanego transportu (Bus)</span>
                      </div>
                    </label>

                    {g.needs_transport === 1 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/70">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Skąd Cię odebrać? (przystanek / miasto)
                          </label>
                          <input
                            type="text"
                            value={g.transport_pickup || ""}
                            onChange={(e) =>
                              handleGuestChange(g.id, "transport_pickup", e.target.value)
                            }
                            placeholder="np. Centrum / Kościół"
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Preferowana godzina powrotu
                          </label>
                          <select
                            value={g.transport_return_time || ""}
                            onChange={(e) =>
                              handleGuestChange(g.id, "transport_return_time", e.target.value)
                            }
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
                          >
                            <option value="">Dowolny kurs</option>
                            <option value="01:00">Kurs ok. 01:00</option>
                            <option value="03:00">Kurs ok. 03:00</option>
                            <option value="04:30">Kurs końcowy ok. 04:30</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-colors text-sm disabled:opacity-50"
          >
            {submitting ? "Przesyłanie odpowiedzi..." : "Prześlij Odpowiedź"}
          </button>
        </form>
      </div>
    </div>
  );
};