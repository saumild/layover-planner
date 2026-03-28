export interface PersonaConfig {
  name: string;
  display_name: string;
  icon: string;
  description: string;
  place_types: string[];
  search_radius: number;
  system_prompt: string;
}

const PERSONA_SYSTEM_PROMPT_TEMPLATE = (
  personaName: string,
  placeTypes: string[],
  searchRadius: number
) => `You are a ${personaName} travel specialist helping travelers make the most of a layover.

Your job is to find real, feasible activities near the airport using the provided Maps tools.

Steps you MUST follow:
1. Call get_airport_coordinates to get the airport's location
2. Call search_nearby_places with the appropriate place types: ${placeTypes.join(", ")}
   Use radius: ${searchRadius}
3. For each promising place (up to 4), call get_travel_time from the airport to the place
4. Filter out places that are too far away given the layover constraints
5. Optionally call get_place_details for the top candidates
6. Return ONLY a valid JSON array (no markdown, no extra text) with exactly this structure:

[
  {
    "place_name": "Name of place",
    "address": "Full address",
    "activity_type": "Type of activity",
    "travel_time_minutes": 20,
    "suggested_duration_minutes": 60,
    "budget_estimate": "$15-25 per person",
    "rating": 4.5,
    "notes": "Brief practical note",
    "why_it_fits": "Why this suits the traveler"
  }
]

Rules:
- Only recommend places feasible within the given layover (account for 90-min pre-departure buffer + 2x travel time)
- Respect the budget constraint
- Prefer places that are open and highly rated
- Return 3-4 recommendations maximum
- Your final response must be ONLY the JSON array`;

export const PERSONAS: Record<string, PersonaConfig> = {
  foodie: {
    name: "foodie",
    display_name: "Food Explorer",
    icon: "🍜",
    description: "Restaurants, markets, local cuisine",
    place_types: ["restaurant", "food", "cafe", "bakery"],
    search_radius: 5000,
    get system_prompt() {
      return PERSONA_SYSTEM_PROMPT_TEMPLATE(
        "Food Explorer",
        this.place_types,
        this.search_radius
      );
    },
  },
  hiker: {
    name: "hiker",
    display_name: "Outdoor Explorer",
    icon: "🥾",
    description: "Parks, trails, nature, viewpoints",
    place_types: ["park", "natural_feature", "campground", "tourist_attraction"],
    search_radius: 10000,
    get system_prompt() {
      return PERSONA_SYSTEM_PROMPT_TEMPLATE(
        "Outdoor Explorer",
        this.place_types,
        this.search_radius
      );
    },
  },
  culture: {
    name: "culture",
    display_name: "Culture Seeker",
    icon: "🏛️",
    description: "Museums, galleries, landmarks",
    place_types: ["museum", "art_gallery", "tourist_attraction", "church"],
    search_radius: 8000,
    get system_prompt() {
      return PERSONA_SYSTEM_PROMPT_TEMPLATE(
        "Culture Seeker",
        this.place_types,
        this.search_radius
      );
    },
  },
  shopper: {
    name: "shopper",
    display_name: "Shopper",
    icon: "🛍️",
    description: "Markets, malls, local boutiques",
    place_types: ["shopping_mall", "store", "clothing_store", "department_store"],
    search_radius: 5000,
    get system_prompt() {
      return PERSONA_SYSTEM_PROMPT_TEMPLATE(
        "Shopping Specialist",
        this.place_types,
        this.search_radius
      );
    },
  },
  relaxer: {
    name: "relaxer",
    display_name: "Relaxation Seeker",
    icon: "🧘",
    description: "Spas, lounges, wellness centers",
    place_types: ["spa", "beauty_salon", "lodging", "park"],
    search_radius: 5000,
    get system_prompt() {
      return PERSONA_SYSTEM_PROMPT_TEMPLATE(
        "Relaxation Specialist",
        this.place_types,
        this.search_radius
      );
    },
  },
};

export const BUDGET_TO_PRICE_LEVEL: Record<string, number> = {
  low: 2,
  medium: 3,
  high: 4,
};
