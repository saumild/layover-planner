export interface UserContext {
  city: string;
  airport_code: string;
  arrival_time: string; // HH:MM
  departure_time: string; // HH:MM
  personas: string[];
  budget: "low" | "medium" | "high";
  special_requests?: string;
}

export interface ItinerarySlot {
  time_start: string;
  time_end: string;
  place_name: string;
  address: string;
  activity_type: string;
  travel_time_from_prev_minutes: number;
  duration_minutes: number;
  budget_estimate: string | null;
  rating: number | null;
  notes: string;
}

export interface Itinerary {
  city: string;
  airport: string;
  total_available_minutes: number;
  warning: string | null;
  slots: ItinerarySlot[];
  total_budget_estimate: string;
}

export interface Recommendation {
  place_name: string;
  address: string;
  activity_type: string;
  travel_time_minutes: number;
  suggested_duration_minutes: number;
  budget_estimate: string;
  rating: number | null;
  notes: string;
  why_it_fits: string;
}

export type ProgressEvent =
  | { type: "progress"; message: string }
  | { type: "result"; data: Itinerary }
  | { type: "error"; message: string };
