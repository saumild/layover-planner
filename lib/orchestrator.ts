import Anthropic from "@anthropic-ai/sdk";
import { PERSONAS, BUDGET_TO_PRICE_LEVEL } from "./personas";
import {
  getAirportCoordinates,
  searchNearbyPlaces,
  getTravelTime,
  getPlaceDetails,
} from "./maps";
import type { UserContext, Itinerary, Recommendation } from "./types";

const anthropic = new Anthropic();

// ─── Maps tools definition (used by persona sub-agents) ───────────────────────
const MAPS_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_airport_coordinates",
    description:
      "Get the latitude/longitude coordinates and address of an airport by its IATA code.",
    input_schema: {
      type: "object" as const,
      properties: {
        airport_code: {
          type: "string",
          description: "IATA airport code, e.g. JFK, LAX, SIN",
        },
      },
      required: ["airport_code"],
    },
  },
  {
    name: "search_nearby_places",
    description:
      "Search for places of interest near a location using Google Maps.",
    input_schema: {
      type: "object" as const,
      properties: {
        location: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["lat", "lng"],
          description: "Center point for the search",
        },
        place_types: {
          type: "array",
          items: { type: "string" },
          description:
            "Google Maps place types to search for, e.g. ['restaurant', 'cafe']",
        },
        radius: {
          type: "number",
          description: "Search radius in meters (default 5000)",
        },
        max_price_level: {
          type: "number",
          description: "Maximum price level 1-4 (1=cheap, 4=expensive)",
        },
      },
      required: ["location", "place_types"],
    },
  },
  {
    name: "get_travel_time",
    description:
      "Get travel time in minutes between two locations via transit or driving.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["lat", "lng"],
        },
        destination: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["lat", "lng"],
        },
        mode: {
          type: "string",
          enum: ["transit", "driving"],
          description: "Travel mode (default: transit)",
        },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "get_place_details",
    description: "Get detailed information about a specific place by place_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        place_id: {
          type: "string",
          description: "Google Maps place_id",
        },
      },
      required: ["place_id"],
    },
  },
];

// ─── Execute a Maps tool call ─────────────────────────────────────────────────
async function executeMapsToolCall(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  maxPriceLevel: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  switch (name) {
    case "get_airport_coordinates":
      return await getAirportCoordinates(input.airport_code);

    case "search_nearby_places":
      return await searchNearbyPlaces(
        input.location,
        input.place_types,
        input.radius ?? 5000,
        input.max_price_level ?? maxPriceLevel
      );

    case "get_travel_time":
      return await getTravelTime(
        input.origin,
        input.destination,
        input.mode ?? "transit"
      );

    case "get_place_details":
      return await getPlaceDetails(input.place_id);

    default:
      throw new Error(`Unknown Maps tool: ${name}`);
  }
}

// ─── Run a single persona sub-agent ──────────────────────────────────────────
async function runPersonaAgent(
  persona: string,
  userContext: UserContext,
  specialRequest: string,
  onProgress: (msg: string) => void
): Promise<Recommendation[]> {
  const personaConfig = PERSONAS[persona];
  const maxPriceLevel = BUDGET_TO_PRICE_LEVEL[userContext.budget];

  onProgress(`${personaConfig.icon} Finding ${personaConfig.display_name} spots in ${userContext.city}...`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Find layover activities for a traveler in ${userContext.city} (airport: ${userContext.airport_code}).
Layover window: ${userContext.arrival_time} – ${userContext.departure_time}
Budget: ${userContext.budget} (max price level: ${maxPriceLevel})
${specialRequest ? `Special request: ${specialRequest}` : ""}

Use the Maps tools to find real places, check travel times, and return 3-4 feasible recommendations as a JSON array.`,
    },
  ];

  // Agent loop: keep going until end_turn or max iterations
  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: personaConfig.system_prompt,
      messages,
      tools: MAPS_TOOLS,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          return JSON.parse(match[0]) as Recommendation[];
        } catch {
          return [];
        }
      }
      return [];
    }

    if (response.stop_reason === "tool_use") {
      const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        let result: unknown;
        try {
          result = await executeMapsToolCall(
            block.name,
            block.input as Record<string, unknown>,
            maxPriceLevel
          );
        } catch (err) {
          result = { error: String(err) };
        }

        toolResultContent.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResultContent });
    }
  }

  return [];
}

// ─── Calculate effective layover minutes ─────────────────────────────────────
function calcEffectiveMinutes(arrival: string, departure: string): number {
  const [ah, am] = arrival.split(":").map(Number);
  const [dh, dm] = departure.split(":").map(Number);
  let total = (dh * 60 + dm) - (ah * 60 + am);
  if (total < 0) total += 24 * 60; // overnight layover
  return Math.max(0, total - 90); // subtract 90-min pre-departure buffer
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export async function runOrchestrator(
  userContext: UserContext,
  onProgress: (msg: string) => void
): Promise<Itinerary> {
  const effectiveMinutes = calcEffectiveMinutes(
    userContext.arrival_time,
    userContext.departure_time
  );

  onProgress(`Planning your ${userContext.city} layover (${effectiveMinutes} effective minutes)...`);

  if (effectiveMinutes < 60) {
    return {
      city: userContext.city,
      airport: userContext.airport_code,
      total_available_minutes: effectiveMinutes,
      warning:
        "Your layover is too short to leave the airport. Consider airport lounges or terminal dining.",
      slots: [],
      total_budget_estimate: "N/A",
    };
  }

  // Build persona tools for the orchestrator
  const personaTools: Anthropic.Tool[] = userContext.personas.map((p) => {
    const cfg = PERSONAS[p];
    return {
      name: `ask_${p}`,
      description: `Ask the ${cfg.display_name} specialist to find ${cfg.description} near the airport.`,
      input_schema: {
        type: "object" as const,
        properties: {
          special_request: {
            type: "string",
            description: "Any specific preference for this persona",
          },
        },
        required: [],
      },
    };
  });

  const orchestratorSystemPrompt = `You are a layover itinerary planner. Your job is to:
1. Call each persona specialist tool provided to get activity recommendations
2. Synthesize the results into a single, time-ordered JSON itinerary
3. Account for travel time, activity duration, and the 90-minute pre-departure buffer
4. Ensure no time overlaps and the schedule is realistic

Layover details:
- City: ${userContext.city}
- Airport: ${userContext.airport_code}
- Arrival: ${userContext.arrival_time}
- Departure: ${userContext.departure_time}
- Effective minutes available: ${effectiveMinutes}
- Budget: ${userContext.budget}

Return ONLY a valid JSON object (no markdown) with this exact structure:
{
  "city": "...",
  "airport": "...",
  "total_available_minutes": ${effectiveMinutes},
  "warning": null,
  "slots": [
    {
      "time_start": "HH:MM",
      "time_end": "HH:MM",
      "place_name": "...",
      "address": "...",
      "activity_type": "...",
      "travel_time_from_prev_minutes": 0,
      "duration_minutes": 60,
      "budget_estimate": "$10-20",
      "rating": 4.5,
      "notes": "..."
    }
  ],
  "total_budget_estimate": "$50-80 total"
}`;

  const orchestratorMessages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Plan a layover itinerary for ${userContext.city} (${userContext.airport_code}), ${userContext.arrival_time}–${userContext.departure_time}.
Interests: ${userContext.personas.join(", ")}. Budget: ${userContext.budget}.
${userContext.special_requests ? `Special requests: ${userContext.special_requests}` : ""}

Call each persona tool, then synthesize into the final JSON itinerary.`,
    },
  ];

  // Orchestrator agent loop
  for (let i = 0; i < 15; i++) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      system: orchestratorSystemPrompt,
      messages: orchestratorMessages,
      tools: personaTools,
    });

    orchestratorMessages.push({
      role: "assistant",
      content: response.content,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as Itinerary;
        } catch {
          // fall through to error
        }
      }
      throw new Error("Orchestrator did not return valid JSON itinerary");
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const persona = block.name.replace("ask_", "");
        const input = block.input as { special_request?: string };

        let recommendations: Recommendation[] = [];
        try {
          recommendations = await runPersonaAgent(
            persona,
            userContext,
            input.special_request ?? "",
            onProgress
          );
          onProgress(`Got ${recommendations.length} ${PERSONAS[persona]?.display_name} recommendations`);
        } catch (err) {
          onProgress(`Warning: ${persona} specialist encountered an issue`);
          recommendations = [];
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(recommendations),
        });
      }

      orchestratorMessages.push({ role: "user", content: toolResults });
      onProgress("Synthesizing your personalized itinerary...");
    }
  }

  throw new Error("Orchestrator exceeded maximum iterations");
}
