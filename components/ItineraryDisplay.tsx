"use client";

import type { Itinerary, ItinerarySlot } from "@/lib/types";

const ACTIVITY_ICONS: Record<string, string> = {
  restaurant: "🍽️",
  food: "🍜",
  cafe: "☕",
  bakery: "🥐",
  park: "🌿",
  natural_feature: "🏔️",
  tourist_attraction: "📸",
  museum: "🏛️",
  art_gallery: "🎨",
  church: "⛪",
  shopping_mall: "🛍️",
  store: "🏪",
  spa: "🧴",
  lodging: "🛋️",
  default: "📍",
};

function getActivityIcon(activityType: string): string {
  const lower = activityType.toLowerCase();
  for (const [key, icon] of Object.entries(ACTIVITY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return ACTIVITY_ICONS.default;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="text-yellow-400 text-xs">
      {"★".repeat(full)}
      {half ? "½" : ""}
      <span className="text-slate-600">{"★".repeat(5 - full - (half ? 1 : 0))}</span>
      <span className="text-slate-400 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function SlotCard({ slot, index }: { slot: ItinerarySlot; index: number }) {
  const icon = getActivityIcon(slot.activity_type);

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 z-10">
          {index + 1}
        </div>
        <div className="w-0.5 bg-slate-700 flex-1 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4 hover:border-slate-600 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-white text-base leading-tight">
                {slot.place_name}
              </h3>
              <p className="text-slate-400 text-sm mt-0.5">{slot.address}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-indigo-300 font-mono text-sm font-medium">
              {slot.time_start} – {slot.time_end}
            </div>
            <div className="text-slate-500 text-xs mt-0.5">
              {slot.duration_minutes} min
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {slot.rating !== null && slot.rating !== undefined && (
            <StarRating rating={slot.rating} />
          )}
          {slot.budget_estimate && (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg px-2.5 py-0.5 text-xs font-medium">
              {slot.budget_estimate}
            </span>
          )}
          {slot.travel_time_from_prev_minutes > 0 && (
            <span className="text-slate-500 text-xs">
              🚌 {slot.travel_time_from_prev_minutes} min travel
            </span>
          )}
          <span className="bg-slate-700 text-slate-400 rounded-lg px-2.5 py-0.5 text-xs">
            {slot.activity_type}
          </span>
        </div>

        {slot.notes && (
          <p className="mt-3 text-slate-400 text-sm border-t border-slate-700 pt-3">
            {slot.notes}
          </p>
        )}
      </div>
    </div>
  );
}

interface Props {
  itinerary: Itinerary;
  onReset: () => void;
}

export default function ItineraryDisplay({ itinerary, onReset }: Props) {
  const hours = Math.floor(itinerary.total_available_minutes / 60);
  const mins = itinerary.total_available_minutes % 60;
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800 border border-indigo-500/20 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">
              ✈️ {itinerary.city}
            </h2>
            <p className="text-slate-400 mt-1">
              {itinerary.airport} · {duration} available · {itinerary.total_budget_estimate}
            </p>
          </div>
          <button
            onClick={onReset}
            className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition"
          >
            Plan Again
          </button>
        </div>

        {itinerary.warning && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-sm">
            ⚠️ {itinerary.warning}
          </div>
        )}
      </div>

      {/* No slots */}
      {itinerary.slots.length === 0 && !itinerary.warning && (
        <div className="text-center py-12 text-slate-500">
          No activities could be scheduled for this layover.
        </div>
      )}

      {/* Timeline */}
      {itinerary.slots.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
            Your Itinerary
          </h3>
          <div>
            {itinerary.slots.map((slot, i) => (
              <SlotCard key={i} slot={slot} index={i} />
            ))}
            {/* End marker */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-lg">
                  🛫
                </div>
              </div>
              <div className="flex-1 flex items-center pb-2">
                <p className="text-slate-500 text-sm">
                  Head back to the airport — allow 90 min before departure
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
