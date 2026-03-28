from personas.base import PersonaConfig

HIKER = PersonaConfig(
    name="hiker",
    display_name="Outdoor Explorer",
    activity_description="outdoor and nature activities (parks, trails, viewpoints, nature reserves)",
    place_types=["park", "natural_feature", "campground", "tourist_attraction"],
    keywords=["hiking trail", "nature park", "viewpoint", "garden", "waterfront walk"],
    num_recommendations=4,
)
