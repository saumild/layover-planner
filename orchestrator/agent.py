"""
Parent orchestrator agent.

Uses the Anthropic SDK directly with tool use + sub-agent pattern:
- The orchestrator has access to one tool per persona ("ask_hiker", "ask_foodie", etc.)
- Each persona tool triggers a focused sub-agent call that uses the Maps MCP tools
- The orchestrator receives all persona recommendations and synthesizes the final itinerary
"""
import json
import os
import subprocess
import tempfile
import time
from datetime import datetime, timedelta

import anthropic

from orchestrator.models import UserContext, Itinerary
from orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT, PERSONA_SYSTEM_PROMPT_TEMPLATE
from personas import PERSONA_REGISTRY
from personas.base import PersonaConfig


def _compute_return_by(arrival_time: str, effective_minutes: int) -> str:
    """Calculate the latest time the traveler can be back at the airport."""
    try:
        t = datetime.strptime(arrival_time, "%H:%M")
        # Add effective minutes (already has 90-min buffer baked in)
        # Return-by = departure_time - 90min = arrival + effective_minutes
        return_by = t + timedelta(minutes=effective_minutes)
        return return_by.strftime("%H:%M")
    except ValueError:
        return "unknown"


def _build_persona_tool(persona: PersonaConfig, context: UserContext) -> dict:
    """Build an Anthropic tool definition for a persona sub-agent."""
    return {
        "name": f"ask_{persona.name}",
        "description": (
            f"Ask the {persona.display_name} specialist to find the best "
            f"{persona.activity_description} near {context.airport_iata} airport. "
            f"Returns a JSON list of recommendations with timing and budget info."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "special_request": {
                    "type": "string",
                    "description": "Any specific preference or constraint to pass to the specialist (optional).",
                }
            },
            "required": [],
        },
    }


def _run_persona_agent(
    persona: PersonaConfig,
    context: UserContext,
    special_request: str = "",
    maps_tools: list[dict] | None = None,
) -> list[dict]:
    """Run a persona sub-agent synchronously. Returns list of recommendation dicts."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    return_by = _compute_return_by(context.arrival_time, context.effective_minutes)

    system_prompt = PERSONA_SYSTEM_PROMPT_TEMPLATE.format(
        persona_type=persona.display_name,
        airport_iata=context.airport_iata,
        effective_minutes=context.effective_minutes,
        budget=context.budget,
        price_level_max=context.price_level_max,
        arrival_time=context.arrival_time,
        return_by=return_by,
        num_recommendations=persona.num_recommendations,
        activity_description=persona.activity_description,
    )

    user_prompt = (
        f"Find the best {persona.activity_description} for a traveler with a "
        f"{context.layover_hours:.1f}-hour layover at {context.airport_iata} in {context.city}. "
        f"Arrival: {context.arrival_time}, must return by: {return_by}. "
        f"Budget: {context.budget}."
    )
    if special_request:
        user_prompt += f"\nSpecial request: {special_request}"

    if not maps_tools:
        # Minimal fallback: no maps tools, ask model to use general knowledge
        maps_tools = []

    messages = [{"role": "user", "content": user_prompt}]
    recommendations = []

    for _ in range(15):  # max turns
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=system_prompt,
            tools=maps_tools,
            messages=messages,
        )

        # Collect assistant message content
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            # Extract JSON from final text block
            for block in response.content:
                if hasattr(block, "text"):
                    try:
                        text = block.text.strip()
                        if text.startswith("["):
                            recommendations = json.loads(text)
                        elif text.startswith("{"):
                            parsed = json.loads(text)
                            if "recommendations" in parsed:
                                recommendations = parsed["recommendations"]
                    except json.JSONDecodeError:
                        pass
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = _call_maps_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })
            if tool_results:
                messages.append({"role": "user", "content": tool_results})

    return recommendations


def _call_maps_tool(tool_name: str, tool_input: dict) -> dict | list:
    """Call a maps tool via the MCP server as a subprocess."""
    import sys
    script = f"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath('{__file__}')) + '/..')
from dotenv import load_dotenv
load_dotenv()
from mcp_server.maps_client import MapsClient
import json

client = MapsClient()
tool_name = {json.dumps(tool_name)}
tool_input = {json.dumps(tool_input)}

try:
    if tool_name == 'get_airport_coordinates':
        result = client.get_airport_coordinates(tool_input['iata_code'])
    elif tool_name == 'search_nearby_places':
        airport = client.get_airport_coordinates(tool_input['airport_iata'])
        result = client.search_nearby_places(
            location=(airport['lat'], airport['lng']),
            place_type=tool_input['place_type'],
            radius_meters=tool_input.get('radius_meters', 10000),
            max_results=tool_input.get('max_results', 10),
            price_level_max=tool_input.get('price_level_max', 4),
            keyword=tool_input.get('keyword', ''),
        )
    elif tool_name == 'get_travel_time':
        result = client.get_travel_time(
            origin_place_id=tool_input['origin_place_id'],
            dest_place_id=tool_input['destination_place_id'],
            mode=tool_input.get('mode', 'transit'),
        )
    elif tool_name == 'get_place_details':
        result = client.get_place_details(tool_input['place_id'])
    else:
        result = {{"error": f"Unknown tool: {{tool_name}}"}}
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
"""
    try:
        result = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return json.loads(result.stdout.strip())
    except Exception as e:
        return {"error": str(e)}


def _build_maps_tools() -> list[dict]:
    """Build Anthropic tool definitions for the Maps MCP tools."""
    return [
        {
            "name": "get_airport_coordinates",
            "description": "Resolve an IATA airport code to its place_id and lat/lng coordinates. Call this first.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "iata_code": {"type": "string", "description": "IATA airport code, e.g. 'JFK'"}
                },
                "required": ["iata_code"],
            },
        },
        {
            "name": "search_nearby_places",
            "description": (
                "Search for places of a given type near an airport. "
                "place_type options: restaurant, museum, park, art_gallery, spa, "
                "shopping_mall, tourist_attraction, natural_feature, food, cafe, bakery"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "airport_iata": {"type": "string"},
                    "place_type": {"type": "string"},
                    "radius_meters": {"type": "integer", "default": 10000},
                    "max_results": {"type": "integer", "default": 10},
                    "price_level_max": {"type": "integer", "default": 4},
                    "keyword": {"type": "string", "default": ""},
                },
                "required": ["airport_iata", "place_type"],
            },
        },
        {
            "name": "get_travel_time",
            "description": "Get travel time between two places by their place_id.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "origin_place_id": {"type": "string"},
                    "destination_place_id": {"type": "string"},
                    "mode": {"type": "string", "enum": ["transit", "driving", "walking", "bicycling"], "default": "transit"},
                },
                "required": ["origin_place_id", "destination_place_id"],
            },
        },
        {
            "name": "get_place_details",
            "description": "Get full details for a place including opening hours.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "place_id": {"type": "string"}
                },
                "required": ["place_id"],
            },
        },
    ]


def run_orchestrator(context: UserContext) -> Itinerary:
    """Run the parent orchestrator agent and return a structured Itinerary."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    maps_tools = _build_maps_tools()

    # Short layover: skip field trip, recommend terminal activities
    if context.effective_minutes < 90:
        return Itinerary(
            city=context.city,
            airport=context.airport_iata,
            total_available_minutes=context.effective_minutes,
            warning=(
                f"Only {context.effective_minutes} minutes available after the 90-minute departure buffer. "
                "Recommend staying in the terminal."
            ),
            slots=[],
            total_budget_estimate="$0-20 (terminal)",
        )

    # Build persona tools for the orchestrator
    requested_personas = [
        PERSONA_REGISTRY[p] for p in context.personas if p in PERSONA_REGISTRY
    ]
    if not requested_personas:
        requested_personas = [PERSONA_REGISTRY["foodie"]]

    persona_tools = [_build_persona_tool(p, context) for p in requested_personas]

    user_prompt = f"""Plan a layover itinerary with these details:
- City: {context.city}
- Airport: {context.airport_iata}
- Layover: {context.layover_hours:.1f} hours ({context.effective_minutes} minutes after 90-min buffer)
- Arrival: {context.arrival_time} | Departure: {context.departure_time}
- Persona preferences: {', '.join(p.display_name for p in requested_personas)}
- Budget: {context.budget}

Use the persona specialist tools to gather recommendations, then synthesize into a time-ordered itinerary.
"""

    messages = [{"role": "user", "content": user_prompt}]
    final_itinerary = None

    for _ in range(20):  # max orchestrator turns
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=8192,
            system=ORCHESTRATOR_SYSTEM_PROMPT,
            tools=persona_tools,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    try:
                        text = block.text.strip()
                        if text.startswith("{"):
                            data = json.loads(text)
                            final_itinerary = Itinerary.model_validate(data)
                    except (json.JSONDecodeError, Exception):
                        pass
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    # Determine which persona to invoke
                    persona_name = block.name.replace("ask_", "")
                    persona = PERSONA_REGISTRY.get(persona_name)
                    if persona:
                        special_request = block.input.get("special_request", "")
                        recs = _run_persona_agent(
                            persona=persona,
                            context=context,
                            special_request=special_request,
                            maps_tools=maps_tools,
                        )
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(recs),
                        })
                    else:
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps({"error": f"Unknown persona: {persona_name}"}),
                        })
            if tool_results:
                messages.append({"role": "user", "content": tool_results})

    if final_itinerary is None:
        # Fallback: empty itinerary with warning
        final_itinerary = Itinerary(
            city=context.city,
            airport=context.airport_iata,
            total_available_minutes=context.effective_minutes,
            warning="Could not generate itinerary. Please try again.",
            slots=[],
            total_budget_estimate="unknown",
        )

    return final_itinerary
