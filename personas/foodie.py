from personas.base import PersonaConfig

FOODIE = PersonaConfig(
    name="foodie",
    display_name="Food Explorer",
    activity_description="local food and dining experiences (restaurants, food markets, street food)",
    place_types=["restaurant", "food", "cafe", "bakery"],
    keywords=["local cuisine", "food market", "street food", "specialty restaurant"],
    num_recommendations=4,
)
