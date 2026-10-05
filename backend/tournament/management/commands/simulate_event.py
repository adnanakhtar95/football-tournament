import random
import time

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from tournament.models import Event, Match


class Command(BaseCommand):
    help = (
        "Simulate every scheduled match in an event using realistic "
        "football scenarios including goals, fouls, cards, penalties, "
        "extra time, and penalty shootouts. "
        "Reward events are never generated automatically."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "event_id",
            type=int,
            help="ID of the event to simulate.",
        )

        parser.add_argument(
            "--speed",
            type=float,
            default=1.0,
            help=(
                "Real seconds per simulated football minute. "
                "Example: 0.15 runs a match quickly."
            ),
        )

        parser.add_argument(
            "--seed",
            type=int,
            default=None,
            help=(
                "Optional random seed. Use the same seed to reproduce "
                "the same tournament scenario selection."
            ),
        )

        parser.add_argument(
            "--match-break",
            type=float,
            default=2.0,
            help=(
                "Real seconds to wait between completed matches."
            ),
        )

        parser.add_argument(
            "--knockout-drama",
            action="store_true",
            help=(
                "Increase the probability of knockout matches going "
                "to extra time or penalties."
            ),
        )

        parser.add_argument(
            "--stop-on-error",
            action="store_true",
            help=(
                "Stop the entire tournament simulation if one match fails."
            ),
        )

    def handle(self, *args, **options):
        event_id = options["event_id"]
        speed = options["speed"]
        seed = options["seed"]
        match_break = options["match_break"]
        knockout_drama = options["knockout_drama"]
        stop_on_error = options["stop_on_error"]

        # =========================================================
        # VALIDATION
        # =========================================================

        if speed <= 0:
            raise CommandError(
                "Speed must be greater than 0."
            )

        if match_break < 0:
            raise CommandError(
                "Match break cannot be negative."
            )

        try:
            event = Event.objects.get(
                pk=event_id
            )
        except Event.DoesNotExist:
            raise CommandError(
                f"Event {event_id} does not exist."
            )

        if event.status != Event.Status.ACTIVE:
            raise CommandError(
                f'Event "{event.name}" is not active. '
                "Activate it before running the simulation."
            )

        # =========================================================
        # RANDOM GENERATOR
        # =========================================================

        rng = random.Random(seed)

        # =========================================================
        # LOAD SCHEDULED MATCHES
        # =========================================================

        matches = list(
            Match.objects
            .filter(
                round__event=event,
                status=Match.Status.SCHEDULED,
            )
            .select_related(
                "round",
                "home_team",
                "away_team",
            )
            .order_by(
                "round__order_number",
                "scheduled_at",
                "id",
            )
        )

        if not matches:
            raise CommandError(
                f"No scheduled matches found for event {event_id}."
            )

        # =========================================================
        # MATCH COUNTS
        # =========================================================

        total_matches = len(matches)

        group_matches = sum(
            1
            for match in matches
            if not match.is_knockout
        )

        knockout_matches = (
            total_matches - group_matches
        )

        # =========================================================
        # EVENT HEADER
        # =========================================================

        self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS("=" * 72)
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"TOURNAMENT SIMULATION: {event.name}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS("=" * 72)
        )

        self.stdout.write(
            f"Event ID         : {event.id}"
        )

        self.stdout.write(
            f"Total matches    : {total_matches}"
        )

        self.stdout.write(
            f"Group / League   : {group_matches}"
        )

        self.stdout.write(
            f"Knockout matches : {knockout_matches}"
        )

        self.stdout.write(
            f"Simulation speed : {speed:g}s / football minute"
        )

        self.stdout.write(
            "Match events     : Goals, fouls, cards and penalties"
        )

        self.stdout.write(
            "Reward events    : DISABLED during simulation"
        )

        if seed is not None:
            self.stdout.write(
                f"Random seed      : {seed}"
            )

        if knockout_drama:
            self.stdout.write(
                self.style.WARNING(
                    "Knockout drama   : ENABLED"
                )
            )
        else:
            self.stdout.write(
                "Knockout drama   : Standard"
            )

        self.stdout.write("")

        # =========================================================
        # STATISTICS
        # =========================================================

        completed = 0
        failed = 0

        group_random_count = 0
        regulation_count = 0
        extra_time_count = 0
        penalty_count = 0

        current_round_id = None

        # =========================================================
        # SIMULATE EVERY MATCH
        # =========================================================

        for index, match in enumerate(
            matches,
            start=1,
        ):
            # -----------------------------------------------------
            # ROUND HEADER
            # -----------------------------------------------------

            if current_round_id != match.round_id:
                current_round_id = match.round_id

                self.stdout.write("")

                self.stdout.write(
                    self.style.WARNING(
                        "-" * 72
                    )
                )

                self.stdout.write(
                    self.style.WARNING(
                        f"ROUND: {match.round.name}"
                    )
                )

                self.stdout.write(
                    self.style.WARNING(
                        "-" * 72
                    )
                )

            # -----------------------------------------------------
            # CHOOSE MATCH SCENARIO
            # -----------------------------------------------------

            scenario = self.choose_scenario(
                match=match,
                rng=rng,
                knockout_drama=knockout_drama,
            )

            if scenario == "random":
                group_random_count += 1

            elif scenario == "normal":
                regulation_count += 1

            elif scenario == "extra-time":
                extra_time_count += 1

            elif scenario == "penalties":
                penalty_count += 1

            # -----------------------------------------------------
            # UNIQUE MATCH SEED
            # -----------------------------------------------------

            match_seed = rng.randint(
                1,
                2_147_483_647,
            )

            # -----------------------------------------------------
            # MATCH HEADER
            # -----------------------------------------------------

            self.stdout.write("")

            self.stdout.write(
                self.style.SUCCESS(
                    f"[{index}/{total_matches}] "
                    f"{match.home_team.name} "
                    f"vs "
                    f"{match.away_team.name}"
                )
            )

            self.stdout.write(
                f"Match ID  : {match.id}"
            )

            self.stdout.write(
                f"Round     : {match.round.name}"
            )

            self.stdout.write(
                "Type      : "
                + (
                    "Knockout"
                    if match.is_knockout
                    else "Group / League"
                )
            )

            self.stdout.write(
                f"Scenario  : {self.scenario_label(scenario)}"
            )

            self.stdout.write(
                f"Seed      : {match_seed}"
            )

            self.stdout.write("")

            # -----------------------------------------------------
            # RUN MATCH SIMULATOR
            # -----------------------------------------------------
            #
            # IMPORTANT:
            #
            # simulate_match is responsible for generating:
            #
            #   GOAL
            #   FOUL
            #   YELLOW_CARD
            #   RED_CARD
            #   PENALTY_KICK
            #
            # It must NEVER automatically generate REWARD.
            #
            # REWARD remains available to the manual admin system.
            #
            # -----------------------------------------------------

            try:
                call_command(
                    "simulate_match",
                    match.id,
                    speed=speed,
                    scenario=scenario,
                    seed=match_seed,
                )

                completed += 1

                # -------------------------------------------------
                # REFRESH FINAL MATCH RESULT
                # -------------------------------------------------

                match.refresh_from_db()

                self.stdout.write("")

                self.stdout.write(
                    self.style.SUCCESS(
                        "RESULT: "
                        f"{match.home_team.name} "
                        f"{match.home_score} - "
                        f"{match.away_score} "
                        f"{match.away_team.name}"
                    )
                )

                # -------------------------------------------------
                # PENALTY SHOOTOUT RESULT
                # -------------------------------------------------

                if (
                    match.is_knockout
                    and match.shootout_kicks.exists()
                ):
                    home_penalties = (
                        match.shootout_kicks
                        .filter(
                            team=match.home_team,
                            scored=True,
                        )
                        .count()
                    )

                    away_penalties = (
                        match.shootout_kicks
                        .filter(
                            team=match.away_team,
                            scored=True,
                        )
                        .count()
                    )

                    self.stdout.write(
                        self.style.WARNING(
                            "SHOOTOUT: "
                            f"{match.home_team.name} "
                            f"{home_penalties} - "
                            f"{away_penalties} "
                            f"{match.away_team.name}"
                        )
                    )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Match {match.id} completed successfully."
                    )
                )

            # -----------------------------------------------------
            # MATCH FAILURE
            # -----------------------------------------------------

            except Exception as exc:
                failed += 1

                self.stderr.write("")

                self.stderr.write(
                    self.style.ERROR(
                        f"FAILED MATCH {match.id}: {exc}"
                    )
                )

                if stop_on_error:
                    raise CommandError(
                        "Event simulation stopped because "
                        f"match {match.id} failed."
                    ) from exc

            # -----------------------------------------------------
            # BREAK BETWEEN MATCHES
            # -----------------------------------------------------

            if (
                index < total_matches
                and match_break > 0
            ):
                self.stdout.write(
                    f"Next fixture in {match_break:g}s..."
                )

                time.sleep(match_break)

        # =========================================================
        # EVENT SUMMARY
        # =========================================================

        self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS("=" * 72)
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"EVENT SIMULATION COMPLETE: {event.name}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS("=" * 72)
        )

        self.stdout.write(
            f"Scheduled matches : {total_matches}"
        )

        self.stdout.write(
            f"Completed         : {completed}"
        )

        self.stdout.write(
            f"Failed            : {failed}"
        )

        self.stdout.write("")

        self.stdout.write(
            f"Group simulations : {group_random_count}"
        )

        self.stdout.write(
            f"Regulation wins   : {regulation_count}"
        )

        self.stdout.write(
            f"Extra-time paths  : {extra_time_count}"
        )

        self.stdout.write(
            f"Penalty shootouts : {penalty_count}"
        )

        self.stdout.write("")

        self.stdout.write(
            "Automatic rewards : 0"
        )

        self.stdout.write("")

        # =========================================================
        # FINAL STATUS
        # =========================================================

        if failed:
            self.stdout.write(
                self.style.WARNING(
                    f"Simulation completed with {failed} "
                    f"failed match{'es' if failed != 1 else ''}."
                )
            )

            self.stdout.write(
                self.style.WARNING(
                    "Check the errors above for the failed fixtures."
                )
            )

        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "All scheduled matches were simulated successfully."
                )
            )

        self.stdout.write("")

    # =============================================================
    # SCENARIO SELECTION
    # =============================================================

    def choose_scenario(
        self,
        *,
        match,
        rng,
        knockout_drama,
    ):
        """
        Choose the simulation path for a match.

        Group / league:
            random
                Natural result.
                Draws are allowed.

        Knockout:
            normal
                A winner must be produced during regulation.

            extra-time
                Regulation ends level.
                A winner is produced during extra time.

            penalties
                Regulation ends level.
                Extra time also ends level.
                Winner is decided by penalty shootout.
        """

        # ---------------------------------------------------------
        # GROUP / LEAGUE MATCH
        # ---------------------------------------------------------

        if not match.is_knockout:
            return "random"

        roll = rng.random()

        # ---------------------------------------------------------
        # KNOCKOUT DRAMA MODE
        #
        # 45% regulation
        # 30% extra time
        # 25% penalties
        # ---------------------------------------------------------

        if knockout_drama:
            if roll < 0.45:
                return "normal"

            if roll < 0.75:
                return "extra-time"

            return "penalties"

        # ---------------------------------------------------------
        # STANDARD KNOCKOUT MODE
        #
        # 70% regulation
        # 20% extra time
        # 10% penalties
        # ---------------------------------------------------------

        if roll < 0.70:
            return "normal"

        if roll < 0.90:
            return "extra-time"

        return "penalties"

    # =============================================================
    # DISPLAY HELPERS
    # =============================================================

    def scenario_label(self, scenario):
        labels = {
            "random": "Natural / Random",
            "normal": "Regulation Winner",
            "extra-time": "Extra-Time Winner",
            "penalties": "Penalty Shootout",
        }

        return labels.get(
            scenario,
            scenario,
        )