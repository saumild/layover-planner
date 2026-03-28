from dataclasses import dataclass, field


@dataclass
class PersonaConfig:
    name: str
    display_name: str
    activity_description: str
    place_types: list[str]          # Google Maps place types to search
    keywords: list[str]             # Optional search keywords
    num_recommendations: int = 4

    def as_tool_description(self) -> str:
        return (
            f"Find {self.activity_description} recommendations for the layover. "
            f"Searches for: {', '.join(self.place_types)}."
        )


def build_agent_tools() -> list[str]:
    """MCP tool names available to all persona agents."""
    return [
        "get_airport_coordinates",
        "search_nearby_places",
        "get_travel_time",
        "get_place_details",
    ]
