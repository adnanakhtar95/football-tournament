import random
import time

from django.core.management.base import BaseCommand, CommandError

from tournament.models import Match, MatchEvent
from tournament.services import (
    finish_match,
    record_goal,
    record_match_event,
    start_match,
)


class Command(BaseCommand):
    help = "Simulate a football match with live events."

    def add_arguments(self, parser):
        parser.add_argument(
            "match_id",
            type=int,
            help="ID of the match to simulate.",
        )
        parser.add_argument(
            "--speed",
            type=float,
            default=5,
            help="Number of real seconds between simulated minutes.",
        )

    def handle(self, *args, **options):
        match_id = options["match_id"]
        speed = options["speed"]

        if speed <= 0:
            raise CommandError("Speed must be greater than 0.")

        try:
            match = (
                Match.objects
                .select_related(
                    "home_team",
                    "away_team",
                    "round__event",
                )
                .get(pk=match_id)
            )
        except Match.DoesNotExist:
            raise CommandError(
                f"Match {match_id} does not exist."
            )

        if match.status != Match.Status.SCHEDULED:
            raise CommandError(
                f"Match {match_id} is already {match.status}."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting simulation: "
                f"{match.home_team.name} vs {match.away_team.name}"
            )
        )

        try:
            match = start_match(match.id)
        except Exception as exc:
            raise CommandError(str(exc))

        self.stdout.write(
            self.style.SUCCESS(
                "Match started."
            )
        )

        for minute in range(1, 91):
            time.sleep(speed)

            # Goal probability for each minute.
            if random.random() < 0.035:
                team_id = random.choice(
                    [
                        match.home_team_id,
                        match.away_team_id,
                    ]
                )

                player_name = random.choice(
                    [
                        "Ali Khan",
                        "Ahmed Raza",
                        "Usman Malik",
                        "Hamza Shah",
                        "Bilal Ahmed",
                    ]
                )

                record_goal(
                    match_id=match.id,
                    team_id=team_id,
                    minute=minute,
                    player_name=player_name,
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"{minute}' GOAL"
                    )
                )

            # Cards / penalty events.
            if random.random() < 0.025:
                team_id = random.choice(
                    [
                        match.home_team_id,
                        match.away_team_id,
                    ]
                )

                event_type = random.choice(
                    [
                        MatchEvent.EventType.YELLOW_CARD,
                        MatchEvent.EventType.RED_CARD,
                        MatchEvent.EventType.PENALTY_KICK,
                    ]
                )

                record_match_event(
                    match_id=match.id,
                    team_id=team_id,
                    event_type=event_type,
                    minute=minute,
                )

                self.stdout.write(
                    f"{minute}' {event_type}"
                )

            # Occasional reward.
            if random.random() < 0.01:
                team_id = random.choice(
                    [
                        match.home_team_id,
                        match.away_team_id,
                    ]
                )

                reward_points = random.choice(
                    [1, 2, 3]
                )

                record_match_event(
                    match_id=match.id,
                    team_id=team_id,
                    event_type=MatchEvent.EventType.REWARD,
                    minute=minute,
                    points=reward_points,
                    note="Simulation bonus",
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"{minute}' REWARD +{reward_points}"
                    )
                )

        finish_match(match.id)

        match.refresh_from_db()

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "Simulation finished."
            )
        )
        self.stdout.write(
            f"{match.home_team.name} "
            f"{match.home_score} - {match.away_score} "
            f"{match.away_team.name}"
        )