from personas.base import PersonaConfig

RELAXER = PersonaConfig(
    name="relaxer",
    display_name="Relaxation Seeker",
    activity_description="relaxation and wellness activities (spas, lounges, quiet gardens, wellness centers)",
    place_types=["spa", "beauty_salon", "lodging", "park"],
    keywords=["day spa", "airport lounge", "wellness center", "quiet garden", "hotel day pass"],
    num_recommendations=4,
)
