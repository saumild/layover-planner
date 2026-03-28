from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from orchestrator.models import Itinerary

console = Console()


def print_itinerary(itinerary: Itinerary) -> None:
    """Render the itinerary as a rich CLI display."""
    # Header
    console.print()
    header = Text()
    header.append(f"  Layover Itinerary: ", style="bold white")
    header.append(itinerary.city, style="bold cyan")
    header.append(f"  ({itinerary.airport})", style="dim white")
    console.print(Panel(header, border_style="cyan"))

    # Warning
    if itinerary.warning:
        console.print(Panel(
            Text(f"  {itinerary.warning}", style="yellow"),
            border_style="yellow",
            title="[yellow]Notice[/yellow]",
        ))

    if not itinerary.slots:
        console.print(
            Panel("[dim]No activities scheduled — enjoy the terminal![/dim]", border_style="dim")
        )
        return

    # Stats bar
    console.print(
        f"  [dim]Available:[/dim] [bold]{itinerary.total_available_minutes} min[/bold]"
        f"   [dim]Est. Total Cost:[/dim] [bold green]{itinerary.total_budget_estimate}[/bold green]",
        highlight=False,
    )
    console.print()

    # Itinerary table
    table = Table(
        box=box.ROUNDED,
        show_header=True,
        header_style="bold magenta",
        border_style="dim",
        expand=True,
    )

    table.add_column("Time", style="cyan bold", no_wrap=True, min_width=11)
    table.add_column("Activity", style="white bold", min_width=20)
    table.add_column("Location", style="white dim", min_width=25)
    table.add_column("Duration", justify="right", min_width=9)
    table.add_column("Budget", justify="right", style="green", min_width=10)
    table.add_column("Rating", justify="center", min_width=7)
    table.add_column("Notes", style="dim", min_width=20)

    for slot in itinerary.slots:
        time_str = f"{slot.time_start}–{slot.time_end}"
        travel_note = ""
        if slot.travel_time_from_prev_minutes > 0:
            travel_note = f"[dim](+{slot.travel_time_from_prev_minutes}m travel)[/dim]\n"
        duration_str = f"{slot.duration_minutes}m"
        rating_str = f"{slot.rating:.1f} ★" if slot.rating else "—"
        budget_str = slot.budget_estimate or "—"

        table.add_row(
            time_str,
            f"{travel_note}[bold]{slot.place_name}[/bold]\n[dim]{slot.activity_type}[/dim]",
            slot.address,
            duration_str,
            budget_str,
            rating_str,
            slot.notes,
        )

    console.print(table)
    console.print()


def print_loading(message: str) -> None:
    console.print(f"[dim]{message}[/dim]")
