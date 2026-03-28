"use client";

import { useState } from "react";
import type { UserContext } from "@/lib/types";

const PERSONAS = [
  { key: "foodie", icon: "🍜", label: "Food Explorer", desc: "Restaurants, markets, cuisine" },
  { key: "hiker", icon: "🥾", label: "Outdoor Explorer", desc: "Parks, trails, nature" },
  { key: "culture", icon: "🏛️", label: "Culture Seeker", desc: "Museums, galleries, landmarks" },
  { key: "shopper", icon: "🛍️", label: "Shopper", desc: "Markets, malls, boutiques" },
  { key: "relaxer", icon: "🧘", label: "Relaxation Seeker", desc: "Spas, lounges, wellness" },
];

const BUDGETS = [
  { key: "low", label: "$", desc: "Budget-friendly" },
  { key: "medium", label: "$$", desc: "Mid-range" },
  { key: "high", label: "$$$", desc: "Premium" },
];

interface Props {
  onSubmit: (ctx: UserContext) => void;
  loading: boolean;
}

export default function LayoverForm({ onSubmit, loading }: Props) {
  const [city, setCity] = useState("");
  const [airportCode, setAirportCode] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [personas, setPersonas] = useState<string[]>(["foodie"]);
  const [budget, setBudget] = useState<"low" | "medium" | "high">("medium");
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState("");

  function togglePersona(key: string) {
    setPersonas((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!city.trim()) return setError("Please enter a city name.");
    if (!airportCode.trim() || airportCode.length < 3)
      return setError("Please enter a valid IATA airport code (e.g. JFK).");
    if (!arrivalTime) return setError("Please enter your arrival time.");
    if (!departureTime) return setError("Please enter your departure time.");
    if (!personas.length) return setError("Please select at least one interest.");

    onSubmit({
      city: city.trim(),
      airport_code: airportCode.trim().toUpperCase(),
      arrival_time: arrivalTime,
      departure_time: departureTime,
      personas,
      budget,
      special_requests: specialRequests.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* City & Airport */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            City
          </label>
          <input
            type="text"
            placeholder="e.g. Tokyo"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Airport Code
          </label>
          <input
            type="text"
            placeholder="e.g. NRT"
            value={airportCode}
            onChange={(e) => setAirportCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Times */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Arrival Time
          </label>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Departure Time
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Personas */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Your Interests
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PERSONAS.map((p) => {
            const selected = personas.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePersona(p.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selected
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="text-sm font-medium leading-tight">{p.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
                </div>
                {selected && (
                  <span className="ml-auto text-indigo-400 text-xs">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Budget
        </label>
        <div className="flex gap-3">
          {BUDGETS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBudget(b.key as "low" | "medium" | "high")}
              className={`flex-1 py-3 rounded-xl border font-medium transition-all ${
                budget === b.key
                  ? "border-indigo-500 bg-indigo-500/10 text-white"
                  : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              <div className="text-lg">{b.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{b.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Special Requests */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Special Requests{" "}
          <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <textarea
          placeholder="e.g. vegetarian only, no crowded places, close to the terminal..."
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all text-base"
      >
        {loading ? "Planning your layover..." : "Plan My Layover ✈️"}
      </button>
    </form>
  );
}
