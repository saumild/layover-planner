from personas.base import PersonaConfig, build_agent_tools
from personas.hiker import HIKER
from personas.foodie import FOODIE
from personas.culture import CULTURE
from personas.shopper import SHOPPER
from personas.relaxer import RELAXER

PERSONA_REGISTRY: dict[str, PersonaConfig] = {
    "hiker": HIKER,
    "foodie": FOODIE,
    "culture": CULTURE,
    "shopper": SHOPPER,
    "relaxer": RELAXER,
}
