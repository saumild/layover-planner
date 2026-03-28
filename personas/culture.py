from personas.base import PersonaConfig

CULTURE = PersonaConfig(
    name="culture",
    display_name="Culture Seeker",
    activity_description="cultural and historical experiences (museums, galleries, landmarks)",
    place_types=["museum", "art_gallery", "tourist_attraction", "church", "hindu_temple"],
    keywords=["museum", "gallery", "historical site", "landmark", "temple"],
    num_recommendations=4,
)
