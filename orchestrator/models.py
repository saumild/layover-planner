from pydantic import BaseModel, Field
from typing import Optional


class UserContext(BaseModel):
    city: str
    airport_iata: str
    layover_hours: float
    arrival_time: str           # HH:MM format
    departure_time: str         # HH:MM format
    personas: list[str]         # e.g. ["foodie", "hiker"]
    budget: str = "medium"      # "low" | "medium" | "high"

    @property
    def price_level_max(self) -> int:
        return {"low": 2, "medium": 3, "high": 4}.get(self.budget, 3)

    @property
    def effective_minutes(self) -> int:
        """Available minutes minus 90-min pre-departure buffer."""
        return max(0, int(self.layover_hours * 60) - 90)


class ItinerarySlot(BaseModel):
    time_start: str
    time_end: str
    place_name: str
    address: str
    activity_type: str
    travel_time_from_prev_minutes: int = 0
    duration_minutes: int
    budget_estimate: Optional[str] = None   # e.g. "$15-25" or "Free"
    rating: Optional[float] = None
    notes: str = ""


class Itinerary(BaseModel):
    city: str
    airport: str
    total_available_minutes: int
    warning: Optional[str] = None
    slots: list[ItinerarySlot] = Field(default_factory=list)
    total_budget_estimate: str = ""
