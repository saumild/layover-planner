import os
import googlemaps
from functools import lru_cache


class MapsClient:
    def __init__(self):
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
        self.client = googlemaps.Client(key=api_key) if api_key else None
        self._airport_cache: dict[str, dict] = {}

    def _require_client(self):
        if self.client is None:
            raise RuntimeError("GOOGLE_MAPS_API_KEY not set")

    def get_airport_coordinates(self, iata_code: str) -> dict:
        if iata_code in self._airport_cache:
            return self._airport_cache[iata_code]

        self._require_client()
        results = self.client.geocode(f"{iata_code} airport")
        if not results:
            raise ValueError(f"Could not find airport: {iata_code}")

        r = results[0]
        data = {
            "place_id": r["place_id"],
            "name": r["formatted_address"],
            "lat": r["geometry"]["location"]["lat"],
            "lng": r["geometry"]["location"]["lng"],
        }
        self._airport_cache[iata_code] = data
        return data

    def search_nearby_places(
        self,
        location: tuple[float, float],
        place_type: str,
        radius_meters: int = 10000,
        max_results: int = 10,
        price_level_max: int = 4,
        keyword: str = "",
    ) -> list[dict]:
        self._require_client()
        params = {
            "location": location,
            "radius": radius_meters,
            "type": place_type,
        }
        if keyword:
            params["keyword"] = keyword

        response = self.client.places_nearby(**params)
        results = response.get("results", [])[:max_results]

        places = []
        for r in results:
            price = r.get("price_level", 0)
            if price > price_level_max:
                continue
            places.append({
                "place_id": r["place_id"],
                "name": r["name"],
                "address": r.get("vicinity", ""),
                "rating": r.get("rating"),
                "user_ratings_total": r.get("user_ratings_total", 0),
                "price_level": price,
                "types": r.get("types", []),
                "lat": r["geometry"]["location"]["lat"],
                "lng": r["geometry"]["location"]["lng"],
                "open_now": r.get("opening_hours", {}).get("open_now"),
            })
        return places

    def get_travel_time(
        self,
        origin_place_id: str,
        dest_place_id: str,
        mode: str = "transit",
    ) -> dict:
        self._require_client()
        directions = self.client.directions(
            origin=f"place_id:{origin_place_id}",
            destination=f"place_id:{dest_place_id}",
            mode=mode,
        )
        if not directions:
            return {"duration_minutes": 60, "distance_km": 0, "mode": mode}

        leg = directions[0]["legs"][0]
        return {
            "duration_minutes": round(leg["duration"]["value"] / 60),
            "distance_km": round(leg["distance"]["value"] / 1000, 1),
            "mode": mode,
        }

    def get_place_details(self, place_id: str) -> dict:
        self._require_client()
        fields = [
            "name", "formatted_address", "rating", "user_ratings_total",
            "price_level", "opening_hours", "website", "formatted_phone_number",
            "types", "editorial_summary",
        ]
        result = self.client.place(place_id, fields=fields).get("result", {})
        hours = result.get("opening_hours", {})
        return {
            "place_id": place_id,
            "name": result.get("name", ""),
            "address": result.get("formatted_address", ""),
            "rating": result.get("rating"),
            "user_ratings_total": result.get("user_ratings_total", 0),
            "price_level": result.get("price_level", 0),
            "open_now": hours.get("open_now"),
            "weekday_text": hours.get("weekday_text", []),
            "website": result.get("website", ""),
            "phone": result.get("formatted_phone_number", ""),
            "types": result.get("types", []),
            "summary": result.get("editorial_summary", {}).get("overview", ""),
        }
