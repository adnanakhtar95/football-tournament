from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from tournament.models import (
    Event,
    EventTeam,
    Match,
    Round,
    Team,
)


class Command(BaseCommand):
    help = "Create demo football tournament data"

    def handle(self, *args, **options):
        now = timezone.now()

        event, _ = Event.objects.get_or_create(
            name="Islamabad Football Cup",
            defaults={
                "description": (
                    "Demo football tournament "
                    "for real-time match tracking."
                ),
                "start_date": now,
                "end_date": now + timedelta(days=30),
                "status": Event.Status.ACTIVE,
            },
        )

        teams_data = [
            ("Islamabad United", "ISL"),
            ("Lahore Lions", "LHR"),
            ("Karachi FC", "KHI"),
            ("Peshawar Stars", "PES"),
        ]

        teams = []

        for name, code in teams_data:
            team, _ = Team.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                },
            )

            teams.append(team)

            EventTeam.objects.get_or_create(
                event=event,
                team=team,
            )

        round_one, _ = Round.objects.get_or_create(
            event=event,
            order_number=1,
            defaults={
                "name": "Round 1",
            },
        )

        Round.objects.get_or_create(
            event=event,
            order_number=2,
            defaults={
                "name": "Semi Final",
            },
        )

        Round.objects.get_or_create(
            event=event,
            order_number=3,
            defaults={
                "name": "Final",
            },
        )

        Match.objects.get_or_create(
            round=round_one,
            home_team=teams[0],
            away_team=teams[1],
            defaults={
                "scheduled_at": now + timedelta(hours=1),
                "venue": "Jinnah Stadium",
            },
        )

        Match.objects.get_or_create(
            round=round_one,
            home_team=teams[2],
            away_team=teams[3],
            defaults={
                "scheduled_at": now + timedelta(hours=3),
                "venue": "Sports Complex",
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Demo tournament data created successfully."
            )
        )