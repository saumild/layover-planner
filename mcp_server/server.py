"""
Maps MCP server — wraps Google Maps Places API via FastMCP.
Launched as a stdio subprocess by the orchestrator.

Run directly for testing:
  python -m mcp_server.server
"""
import os
import sys

# Add project root to path when run as a module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from fastmcp import FastMCP
from mcp_server.maps_client import MapsClient

mcp = FastMCP("maps-places")
_client = MapsClient()


@mcp.tool()
def get_airport_coordinates(iata_code: str) -> dict:
    """Resolve an IATA airport code to its place_id and lat/lng coordinates.
    Always call this first before searching for places near an airport.

    Args:
        iata_code: IATA airport code, e.g. "JFK", "NRT", "LHR"

    Returns:
        dict with place_id, name, lat, lng
    """
    return _client.get_airport_coordinates(iata_code.upper())


@mcp.tool()
def search_nearby_places(
    airport_iata: str,
    place_type: str,
    radius_meters: int = 10000,
    max_results: int = 10,
    price_level_max: int = 4,
    keyword: str = "",
) -> list[dict]:
    """Search for places of a given type near an airport.

    Args:
        airport_iata: IATA airport code, e.g. "JFK"
        place_type: Google Maps place type — e.g. "restaurant", "museum", "park",
                    "art_gallery", "spa", "shopping_mall", "tourist_attraction",
                    "natural_feature", "food"
        radius_meters: Search radius in meters (default 10km)
        max_results: Maximum number of results to return (default 10)
        price_level_max: Maximum price level 0-4 (0=free, 4=very expensive)
        keyword: Optional keyword to filter results, e.g. "ramen", "hiking trail"

    Returns:
        List of places with place_id, name, address, rating, price_level, open_now
    """
    airport = _client.get_airport_coordinates(airport_iata.upper())
    location = (airport["lat"], airport["lng"])
    return _client.search_nearby_places(
        location=location,
        place_type=place_type,
        radius_meters=radius_meters,
        max_results=max_results,
        price_level_max=price_level_max,
        keyword=keyword,
    )


@mcp.tool()
def get_travel_time(
    origin_place_id: str,
    destination_place_id: str,
    mode: str = "transit",
) -> dict:
    """Get travel time and distance between two places by place_id.

    Args:
        origin_place_id: Google Maps place_id of origin (e.g. the airport)
        destination_place_id: Google Maps place_id of destination
        mode: Travel mode — "transit", "driving", "walking", or "bicycling"

    Returns:
        dict with duration_minutes, distance_km, mode
    """
    return _client.get_travel_time(
        origin_place_id=origin_place_id,
        dest_place_id=destination_place_id,
        mode=mode,
    )


@mcp.tool()
def get_place_details(place_id: str) -> dict:
    """Get full details for a place including opening hours, website, phone.

    Args:
        place_id: Google Maps place_id

    Returns:
        dict with name, address, rating, price_level, open_now, weekday_text,
        website, phone, types, summary
    """
    return _client.get_place_details(place_id)


if __name__ == "__main__":
    mcp.run(transport="stdio")
