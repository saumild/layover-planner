from personas.base import PersonaConfig

SHOPPER = PersonaConfig(
    name="shopper",
    display_name="Shopper",
    activity_description="shopping experiences (markets, malls, boutiques, local goods)",
    place_types=["shopping_mall", "store", "clothing_store", "department_store"],
    keywords=["market", "boutique", "local crafts", "souvenir", "shopping district"],
    num_recommendations=4,
)
