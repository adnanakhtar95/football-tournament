from django.core.management.base import BaseCommand, CommandError

from tournament.models import Event, Match
from tournament.services import start_match
from django.core.management import call_command


class Command(BaseCommand):
    help = "Simulate all scheduled matches in an event."

    def add_arguments(self, parser):
        parser.add_argument(
            "event_id",
            type=int,
            help="ID of the event to simulate.",
        )
        parser.add_argument(
            "--speed",
            type=float,
            default=5,
            help="Number of real seconds between simulated minutes.",
        )

    def handle(self, *args, **options):
        event_id = options["event_id"]
        speed = options["speed"]

        if speed <= 0:
            raise CommandError("Speed must be greater than 0.")

        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            raise CommandError(
                f"Event {event_id} does not exist."
            )

        matches = (
            Match.objects
            .filter(
                round__event=event,
                status=Match.Status.SCHEDULED,
            )
            .order_by("scheduled_at")
        )

        if not matches.exists():
            raise CommandError(
                f"No scheduled matches found for event {event_id}."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting event simulation: {event.name}"
            )
        )

        for match in matches:
            self.stdout.write("")
            self.stdout.write(
                f"Simulating match {match.id}: "
                f"{match.home_team.name} vs "
                f"{match.away_team.name}"
            )

            call_command(
                "simulate_match",
                match.id,
                speed=speed,
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Event simulation completed: {event.name}"
            )
        )