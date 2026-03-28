"""
Layover Optimizer — CLI entry point.

Usage:
  python main.py
  python main.py --city "Tokyo" --airport NRT --hours 6 --arrival 10:30 --departure 16:30 --personas foodie culture --budget medium
"""
import argparse
import os
import sys

from dotenv import load_dotenv
load_dotenv()

from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
from rich import print as rprint

from orchestrator.models import UserContext
from orchestrator.agent import run_orchestrator
from output.formatters import print_itinerary, print_loading
from personas import PERSONA_REGISTRY

console = Console()

VALID_PERSONAS = list(PERSONA_REGISTRY.keys())
VALID_BUDGETS = ["low", "medium", "high"]

PERSONA_DESCRIPTIONS = {
    "hiker": "Outdoor Explorer (parks, trails, nature)",
    "foodie": "Food Explorer (restaurants, markets, local cuisine)",
    "culture": "Culture Seeker (museums, galleries, landmarks)",
    "shopper": "Shopper (markets, malls, boutiques)",
    "relaxer": "Relaxation Seeker (spas, lounges, wellness)",
}


def _validate_time(t: str) -> str:
    from datetime import datetime
    try:
        datetime.strptime(t, "%H:%M")
        return t
    except ValueError:
        raise argparse.ArgumentTypeError(f"Time must be HH:MM format, got: {t}")


def _interactive_collect() -> UserContext:
    """Collect user inputs interactively via rich prompts."""
    console.print()
    console.print(Panel(
        "[bold cyan]Layover Optimizer[/bold cyan]\n[dim]Make the most of your time between flights.[/dim]",
        border_style="cyan",
    ))
    console.print()

    city = Prompt.ask("[bold]City[/bold] (e.g. Tokyo, New York, London)")
    airport_iata = Prompt.ask("[bold]Airport IATA code[/bold] (e.g. NRT, JFK, LHR)").upper()
    layover_hours_str = Prompt.ask("[bold]Layover duration[/bold] (hours, e.g. 5.5)", default="4")
    arrival_time = Prompt.ask("[bold]Arrival time[/bold] (HH:MM, 24h)", default="09:00")
    departure_time = Prompt.ask("[bold]Departure time[/bold] (HH:MM, 24h)", default="13:00")

    console.print("\n[bold]Personas[/bold] — choose one or more:")
    for key, desc in PERSONA_DESCRIPTIONS.items():
        console.print(f"  [cyan]{key}[/cyan] — {desc}")
    personas_raw = Prompt.ask(
        "\nEnter persona(s), space-separated",
        default="foodie",
    )
    personas = [p.strip().lower() for p in personas_raw.split() if p.strip().lower() in VALID_PERSONAS]
    if not personas:
        console.print("[yellow]No valid personas selected, defaulting to foodie.[/yellow]")
        personas = ["foodie"]

    budget = Prompt.ask(
        "\n[bold]Budget[/bold]",
        choices=VALID_BUDGETS,
        default="medium",
    )

    return UserContext(
        city=city,
        airport_iata=airport_iata,
        layover_hours=float(layover_hours_str),
        arrival_time=arrival_time,
        departure_time=departure_time,
        personas=personas,
        budget=budget,
    )


def _args_to_context(args: argparse.Namespace) -> UserContext:
    return UserContext(
        city=args.city,
        airport_iata=args.airport.upper(),
        layover_hours=args.hours,
        arrival_time=args.arrival,
        departure_time=args.departure,
        personas=[p.lower() for p in args.personas if p.lower() in VALID_PERSONAS],
        budget=args.budget,
    )


def main():
    parser = argparse.ArgumentParser(description="Layover Optimizer")
    parser.add_argument("--city", help="City name")
    parser.add_argument("--airport", help="IATA airport code")
    parser.add_argument("--hours", type=float, help="Layover duration in hours")
    parser.add_argument("--arrival", help="Arrival time HH:MM")
    parser.add_argument("--departure", help="Departure time HH:MM")
    parser.add_argument("--personas", nargs="+", default=[], help=f"Personas: {VALID_PERSONAS}")
    parser.add_argument("--budget", choices=VALID_BUDGETS, default="medium")
    args = parser.parse_args()

    # Check required API key
    if not os.environ.get("ANTHROPIC_API_KEY"):
        console.print("[red]Error: ANTHROPIC_API_KEY not set. Add it to your .env file.[/red]")
        sys.exit(1)

    # Collect inputs
    if args.city and args.airport and args.hours and args.arrival and args.departure:
        context = _args_to_context(args)
    else:
        context = _interactive_collect()

    # Summary confirmation
    console.print()
    console.print("[bold]Planning your layover:[/bold]")
    console.print(f"  City: [cyan]{context.city}[/cyan]  |  Airport: [cyan]{context.airport_iata}[/cyan]")
    console.print(f"  Layover: [cyan]{context.layover_hours}h[/cyan]  |  {context.arrival_time} → {context.departure_time}")
    console.print(f"  Personas: [cyan]{', '.join(context.personas)}[/cyan]  |  Budget: [cyan]{context.budget}[/cyan]")
    console.print(f"  Effective time (after 90m buffer): [cyan]{context.effective_minutes} min[/cyan]")
    console.print()

    # Run
    print_loading("Consulting persona specialists and searching for places...")
    itinerary = run_orchestrator(context)
    print_itinerary(itinerary)


if __name__ == "__main__":
    main()
