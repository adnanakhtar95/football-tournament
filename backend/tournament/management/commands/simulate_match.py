import random
import time
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from tournament.models import Match, MatchEvent, Player
from tournament.services import (
    end_extra_time,
    end_extra_time_first_half,
    end_first_half,
    end_regulation,
    finish_match,
    get_shootout_state,
    pause_match,
    record_goal,
    record_match_event,
    record_shootout_kick,
    resume_match,
    set_extra_time,
    start_extra_time,
    start_extra_time_second_half,
    start_match,
    start_second_half,
)


class Command(BaseCommand):
    help = (
        "Simulate a realistic complete football match using "
        "the real match lifecycle."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "match_id",
            type=int,
            help="ID of the match to simulate.",
        )

        parser.add_argument(
            "--speed",
            type=float,
            default=4.0,
            help=(
                "Real seconds between simulated minutes. "
                "Use roughly 3-5 seconds for a 5-8 minute match."
            ),
        )

        parser.add_argument(
            "--scenario",
            choices=[
                "random",
                "normal",
                "extra-time",
                "penalties",
            ],
            default="random",
            help=(
                "Simulation scenario. extra-time and penalties "
                "require a knockout match."
            ),
        )

        parser.add_argument(
            "--seed",
            type=int,
            default=None,
            help="Optional random seed for reproducible simulation.",
        )

    # =========================================================
    # COMMAND ENTRY
    # =========================================================

    def handle(self, *args, **options):
        match_id = options["match_id"]
        self.speed = options["speed"]
        self.scenario = options["scenario"]

        if self.speed < 0:
            raise CommandError(
                "Speed cannot be negative."
            )

        if options["seed"] is not None:
            random.seed(options["seed"])

        try:
            self.match = (
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

        if self.match.status != Match.Status.SCHEDULED:
            raise CommandError(
                f"Match {match_id} is already "
                f"{self.match.status}."
            )

        if (
            self.scenario in (
                "extra-time",
                "penalties",
            )
            and not self.match.is_knockout
        ):
            raise CommandError(
                f"Scenario '{self.scenario}' "
                f"requires a knockout match."
            )

        if self.match.round.event.status != "active":
            raise CommandError(
                f'Event "{self.match.round.event.name}" '
                f"is not active."
            )

        self.home_players = list(
            Player.objects.filter(
                team_id=self.match.home_team_id,
                is_active=True,
            )
        )

        self.away_players = list(
            Player.objects.filter(
                team_id=self.match.away_team_id,
                is_active=True,
            )
        )

        if not self.home_players:
            raise CommandError(
                f"{self.match.home_team.name} "
                f"has no active players."
            )

        if not self.away_players:
            raise CommandError(
                f"{self.match.away_team.name} "
                f"has no active players."
            )

        # -----------------------------------------------------
        # SIMULATION STATE
        # -----------------------------------------------------

        self.yellow_cards = {}
        self.sent_off_players = set()

        self.stats = {
            "goals": 0,
            "fouls": 0,
            "yellow_cards": 0,
            "red_cards": 0,
            "penalties": 0,
            "penalties_scored": 0,
            "penalties_missed": 0,
            "pauses": 0,
            "shots": 0,
            "shots_on_target": 0,
        }

        # Hidden strength variation.
        self.team_strength = {
            self.match.home_team_id:
                random.uniform(0.94, 1.10),

            self.match.away_team_id:
                random.uniform(0.92, 1.08),
        }

        # Small home advantage.
        self.team_strength[
            self.match.home_team_id
        ] *= 1.04

        # Dynamic momentum.
        self.momentum = {
            self.match.home_team_id: 1.0,
            self.match.away_team_id: 1.0,
        }

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "============================================"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "       REALISTIC FOOTBALL SIMULATION"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "============================================"
            )
        )

        self.stdout.write(
            f"Event    : "
            f"{self.match.round.event.name}"
        )
        self.stdout.write(
            f"Round    : "
            f"{self.match.round.name}"
        )
        self.stdout.write(
            f"Match ID : "
            f"{self.match.id}"
        )
        self.stdout.write(
            f"Fixture  : "
            f"{self.match.home_team.name} vs "
            f"{self.match.away_team.name}"
        )
        self.stdout.write(
            f"Knockout : "
            f"{'Yes' if self.match.is_knockout else 'No'}"
        )
        self.stdout.write(
            f"Scenario : {self.scenario}"
        )
        self.stdout.write(
            f"Speed    : {self.speed}s/minute"
        )
        self.stdout.write("")

        try:
            self.simulate()
        except Exception as exc:
            raise CommandError(
                f"Simulation failed: {exc}"
            ) from exc

    # =========================================================
    # MAIN MATCH SIMULATION
    # =========================================================

    def simulate(self):
        self.match = start_match(
            self.match.id
        )

        self.stdout.write(
            self.style.SUCCESS(
                "0' KICK-OFF"
            )
        )

        # =====================================================
        # FIRST HALF
        # =====================================================

        for minute in range(1, 46):
            self.simulate_minute(
                minute
            )

        first_half_stoppage = min(
            8,
            random.randint(1, 3)
            + min(self.stats["pauses"], 2)
            + (
                1
                if self.stats["red_cards"] > 0
                else 0
            ),
        )

        self.set_clock(45)

        set_extra_time(
            self.match.id,
            first_half_stoppage,
        )

        self.stdout.write(
            self.style.WARNING(
                f"45' +{first_half_stoppage} "
                f"minutes added"
            )
        )

        for minute in range(
            46,
            46 + first_half_stoppage,
        ):
            self.simulate_minute(
                minute
            )

        self.set_clock(
            45 + first_half_stoppage
        )

        end_first_half(
            self.match.id
        )

        self.stdout.write(
            self.style.WARNING(
                f"{45 + first_half_stoppage}' "
                f"HALF-TIME"
            )
        )

        self.print_score()

        self.sleep_short()

        # =====================================================
        # SECOND HALF
        # =====================================================

        self.match = start_second_half(
            self.match.id
        )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "45' SECOND HALF STARTED"
            )
        )

        for minute in range(
            46,
            91,
        ):
            self.simulate_minute(
                minute
            )

        second_half_stoppage = min(
            10,
            random.randint(2, 5)
            + min(self.stats["pauses"], 3)
            + (
                1
                if self.stats["red_cards"] > 0
                else 0
            ),
        )

        self.set_clock(90)

        set_extra_time(
            self.match.id,
            second_half_stoppage,
        )

        self.stdout.write(
            self.style.WARNING(
                f"90' +{second_half_stoppage} "
                f"minutes added"
            )
        )

        for minute in range(
            91,
            91 + second_half_stoppage,
        ):
            self.simulate_minute(
                minute
            )

        # =====================================================
        # FORCED DEMO SCENARIOS
        # =====================================================

        if (
            self.match.is_knockout
            and self.scenario
            in (
                "extra-time",
                "penalties",
            )
        ):
            self.force_tie(
                90 + second_half_stoppage
            )

        elif (
            self.match.is_knockout
            and self.scenario == "normal"
        ):
            self.force_winner(
                90 + second_half_stoppage
            )

        self.set_clock(
            90 + second_half_stoppage
        )

        self.match = end_regulation(
            self.match.id
        )

        self.match.refresh_from_db()

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "REGULATION ENDED"
            )
        )

        self.print_score()

        # =====================================================
        # LEAGUE / GROUP MATCH
        # =====================================================

        if not self.match.is_knockout:
            finish_match(
                self.match.id
            )

            self.finish_output()
            return

        # =====================================================
        # KNOCKOUT WINNER AFTER REGULATION
        # =====================================================

        if (
            self.match.home_score
            != self.match.away_score
        ):
            finish_match(
                self.match.id
            )

            self.finish_output()
            return

        # =====================================================
        # EXTRA TIME
        # =====================================================

        self.simulate_extra_time()

    # =========================================================
    # SIMULATE ONE MINUTE
    # =========================================================

    def simulate_minute(
        self,
        minute,
        extra_time=False,
    ):
        self.set_clock(
            minute
        )

        if self.speed > 0:
            time.sleep(
                self.speed
            )

        self.match.refresh_from_db()

        # -----------------------------------------------------
        # MOMENTUM NORMALIZATION
        # -----------------------------------------------------

        for team_id in self.momentum:
            current = self.momentum[
                team_id
            ]

            if current > 1.0:
                current -= 0.015

            elif current < 1.0:
                current += 0.015

            self.momentum[
                team_id
            ] = max(
                0.75,
                min(
                    1.30,
                    current,
                ),
            )

        # -----------------------------------------------------
        # RANDOM MATCH PAUSE
        # -----------------------------------------------------

        pause_probability = (
            0.0035
            if extra_time
            else 0.0025
        )

        if (
            random.random()
            < pause_probability
        ):
            self.simulate_pause(
                minute
            )

        # -----------------------------------------------------
        # FOUL
        # -----------------------------------------------------

        foul_probability = (
            0.27
            if extra_time
            else 0.24
        )

        if (
            random.random()
            < foul_probability
        ):
            self.simulate_foul(
                minute
            )

        # -----------------------------------------------------
        # ATTACK
        # -----------------------------------------------------

        attack_probability = (
            0.22
            if extra_time
            else 0.20
        )

        if minute >= 60:
            attack_probability *= 1.05

        if minute >= 75:
            attack_probability *= 1.10

        if minute >= 85:
            attack_probability *= 1.12

        if (
            extra_time
            and minute >= 110
        ):
            attack_probability *= 1.10

        if (
            random.random()
            < attack_probability
        ):
            self.simulate_attack(
                minute,
                extra_time=extra_time,
            )

    # =========================================================
    # ATTACK ENGINE
    # =========================================================

    def simulate_attack(
        self,
        minute,
        extra_time=False,
    ):
        self.match.refresh_from_db()

        home_id = (
            self.match.home_team_id
        )
        away_id = (
            self.match.away_team_id
        )

        home_weight = (
            self.team_strength[
                home_id
            ]
            * self.momentum[
                home_id
            ]
        )

        away_weight = (
            self.team_strength[
                away_id
            ]
            * self.momentum[
                away_id
            ]
        )

        # -----------------------------------------------------
        # SCORE STATE
        # -----------------------------------------------------

        if minute >= 60:
            if (
                self.match.home_score
                < self.match.away_score
            ):
                home_weight *= 1.18
                away_weight *= 0.94

            elif (
                self.match.away_score
                < self.match.home_score
            ):
                away_weight *= 1.18
                home_weight *= 0.94

        if minute >= 80:
            if (
                self.match.home_score
                < self.match.away_score
            ):
                home_weight *= 1.12

            elif (
                self.match.away_score
                < self.match.home_score
            ):
                away_weight *= 1.12

        # -----------------------------------------------------
        # RED CARD EFFECT
        # -----------------------------------------------------

        home_reds = (
            self.red_cards_for_team(
                home_id
            )
        )

        away_reds = (
            self.red_cards_for_team(
                away_id
            )
        )

        home_weight *= max(
            0.55,
            1.0
            - (
                home_reds
                * 0.18
            ),
        )

        away_weight *= max(
            0.55,
            1.0
            - (
                away_reds
                * 0.18
            ),
        )

        attacking_team = (
            random.choices(
                [
                    home_id,
                    away_id,
                ],
                weights=[
                    max(
                        home_weight,
                        0.1,
                    ),
                    max(
                        away_weight,
                        0.1,
                    ),
                ],
                k=1,
            )[0]
        )

        self.stats[
            "shots"
        ] += 1

        attack_roll = (
            random.random()
        )

        # Attack breaks down.
        if attack_roll < 0.32:
            return

        # Shot off target.
        # if attack_roll < 0.56:
        #     if (
        #         random.random()
        #         < 0.20
        #     ):
        #         self.stdout.write(
        #             f"{minute}' CHANCE | "
        #             f"{self.team_name(attacking_team)} "
        #             f"fire wide."
        #         )

        #     return
        
                # Shot off target.
        if attack_roll < 0.56:
            if random.random() < 0.20:
                chance_text = random.choice(
                    [
                        "A dangerous effort goes wide.",
                        "The shot flashes just past the post.",
                        "A promising chance is fired over the bar.",
                        "A good opening is sent narrowly wide.",
                        "The attacker gets a sight of goal but misses the target.",
                    ]
                )

                record_match_event(
                    match_id=self.match.id,
                    team_id=attacking_team,
                    event_type=MatchEvent.EventType.CHANCE,
                    minute=minute,
                    note=chance_text,
                )

                self.stdout.write(
                    f"{minute}' CHANCE | "
                    f"{self.team_name(attacking_team)} | "
                    f"{chance_text}"
                )

            return
        

        # Shot on target.
        self.stats[
            "shots_on_target"
        ] += 1

        # Goal attempt.
        if attack_roll >= 0.72:
            goal_probability = 0.40

            if extra_time:
                goal_probability *= 0.93

            opponent = (
                self.other_team(
                    attacking_team
                )
            )

            if (
                self.red_cards_for_team(
                    opponent
                )
                > self.red_cards_for_team(
                    attacking_team
                )
            ):
                goal_probability *= 1.15

            if (
                random.random()
                < goal_probability
            ):
                self.score_open_play_goal(
                    attacking_team,
                    minute,
                )
                return

        # Saved/blocked attempt.
        if (
            random.random()
            < 0.24
        ):
            save_text = random.choice(
                [
                    "the goalkeeper makes the save.",
                    "the shot is brilliantly blocked.",
                    "the goalkeeper reacts quickly.",
                    "a dangerous effort is kept out.",
                ]
            )

            self.stdout.write(
                f"{minute}' SAVE | "
                f"{self.team_name(attacking_team)} - "
                f"{save_text}"
            )

        self.momentum[
            attacking_team
        ] = min(
            1.30,
            self.momentum[
                attacking_team
            ] + 0.04,
        )

    # =========================================================
    # OPEN PLAY GOAL
    # =========================================================

    def score_open_play_goal(
        self,
        team_id,
        minute,
    ):
        player = (
            self.choose_scorer(
                team_id
            )
        )

        goal_notes = [
            "A composed finish inside the penalty area.",
            "A powerful strike finds the back of the net.",
            "A brilliant counter-attack ends with a goal.",
            "A low finish beats the goalkeeper.",
            "A clinical finish after a flowing team move.",
            "A header is powered into the net.",
            "A loose ball falls perfectly and is buried.",
            "A curling effort leaves the goalkeeper helpless.",
            "A close-range finish after sustained pressure.",
            "A superb strike from distance.",
        ]

        note = random.choice(
            goal_notes
        )

        record_goal(
            match_id=self.match.id,
            team_id=team_id,
            minute=minute,
            player_id=player.id,
            player_name=player.full_name,
            note=note,
        )

        self.stats[
            "goals"
        ] += 1

        self.momentum[
            team_id
        ] = min(
            1.30,
            self.momentum[
                team_id
            ] + 0.12,
        )

        opponent = (
            self.other_team(
                team_id
            )
        )

        self.momentum[
            opponent
        ] = max(
            0.75,
            self.momentum[
                opponent
            ] - 0.06,
        )

        self.match.refresh_from_db()

        self.stdout.write(
            self.style.SUCCESS(
                f"{minute}' GOAL! | "
                f"{self.team_name(team_id)} | "
                f"{player.full_name} | "
                f"{self.match.home_score}-"
                f"{self.match.away_score}"
            )
        )

    # =========================================================
    # FOUL ENGINE
    # =========================================================

    def simulate_foul(

        self,

        minute,

    ):

        # Team committing the foul.

        team_id = random.choice(

            [

                self.match.home_team_id,

                self.match.away_team_id,

            ]

        )
        # Choose a realistic player to commit the foul.

        player = self.choose_card_player(

            team_id

        )
        self.stats["fouls"] += 1
        # -----------------------------------------------------

        # PENALTY POSSIBILITY

        # -----------------------------------------------------

        #

        # A foul inside the penalty area becomes a penalty.

        # We don't create a separate FOUL event here because

        # PENALTY_KICK already represents the important event.

        # -----------------------------------------------------
        if random.random() < 0.018:

            attacking_team = self.other_team(

                team_id

            )
            self.simulate_penalty(

                attacking_team,

                minute,

            )
            return
        severity = random.random()
        # -----------------------------------------------------

        # NORMAL FOUL

        # -----------------------------------------------------

        #

        # This is now a REAL MatchEvent and will:

        #

        # 1. Be stored in the database.

        # 2. Appear in match.events.

        # 3. Be returned through the API.

        # 4. Be broadcast through WebSocket.

        # -----------------------------------------------------
        if severity < 0.70:

            foul_note = random.choice(

                [

                    "Late challenge.",

                    "Shirt pull.",

                    "Trip in midfield.",

                    "Strong challenge.",

                    "Tactical foul.",

                    "Push from behind.",

                    "Clumsy challenge.",

                    "Blocks the opponent illegally.",

                    "Trips the opponent while challenging for the ball.",

                    "Mistimed sliding challenge.",

                    "Charges into the opponent.",

                    "Pulls the opponent back.",

                ]

            )
            record_match_event(

                match_id=self.match.id,

                team_id=team_id,

                event_type=MatchEvent.EventType.FOUL,

                minute=minute,

                player_id=player.id,

                player_name=player.full_name,

                note=foul_note,

            )
            self.stdout.write(

                f"{minute}' FOUL | "

                f"{self.team_name(team_id)} | "

                f"{player.full_name} | "

                f"{foul_note}"

            )
            return
        # -----------------------------------------------------

        # YELLOW CARD FOUL

        # -----------------------------------------------------

        #

        # Don't create both:

        #

        # FOUL

        # YELLOW_CARD

        #

        # for the same challenge. The yellow card event itself

        # already represents the disciplinary foul.

        # -----------------------------------------------------
        if severity < 0.955:

            self.give_yellow_card(

                team_id,

                player,

                minute,

            )
            return
        # -----------------------------------------------------

        # STRAIGHT RED CARD FOUL

        # -----------------------------------------------------
        self.give_red_card(

            team_id,

            player,

            minute,

            direct=True,

        )

    # =========================================================
    # YELLOW CARD
    # =========================================================

    def give_yellow_card(
        self,
        team_id,
        player,
        minute,
    ):
        if (
            player.id
            in self.sent_off_players
        ):
            return

        previous_yellows = (
            self.yellow_cards.get(
                player.id,
                0,
            )
        )

        # -----------------------------------------------------
        # SECOND YELLOW
        # -----------------------------------------------------

        if previous_yellows >= 1:
            record_match_event(
                match_id=self.match.id,
                team_id=team_id,
                event_type=(
                    MatchEvent.EventType.YELLOW_CARD
                ),
                minute=minute,
                player_id=player.id,
                player_name=player.full_name,
                note=(
                    "Second yellow card after "
                    "another reckless foul."
                ),
            )

            self.stats[
                "yellow_cards"
            ] += 1

            self.yellow_cards[
                player.id
            ] = 2

            self.stdout.write(
                self.style.WARNING(
                    f"{minute}' SECOND YELLOW | "
                    f"{self.team_name(team_id)} | "
                    f"{player.full_name}"
                )
            )

            self.give_red_card(
                team_id,
                player,
                minute,
                direct=False,
            )
            return

        notes = [
            "Booked for a late challenge.",
            "Yellow card for a tactical foul.",
            "Booked after stopping a promising attack.",
            "Yellow card for a reckless challenge.",
            "The referee reaches for the yellow card.",
            "Booked for persistent fouling.",
        ]

        record_match_event(
            match_id=self.match.id,
            team_id=team_id,
            event_type=(
                MatchEvent.EventType.YELLOW_CARD
            ),
            minute=minute,
            player_id=player.id,
            player_name=player.full_name,
            note=random.choice(
                notes
            ),
        )

        self.yellow_cards[
            player.id
        ] = 1

        self.stats[
            "yellow_cards"
        ] += 1

        self.stdout.write(
            self.style.WARNING(
                f"{minute}' YELLOW CARD | "
                f"{self.team_name(team_id)} | "
                f"{player.full_name}"
            )
        )

    # =========================================================
    # RED CARD
    # =========================================================

    def give_red_card(
        self,
        team_id,
        player,
        minute,
        direct=True,
    ):
        if (
            player.id
            in self.sent_off_players
        ):
            return

        if direct:
            note = random.choice(
                [
                    "Straight red card for serious foul play.",
                    "Sent off for denying a clear goalscoring opportunity.",
                    "Straight red after a dangerous challenge.",
                    "The referee shows a direct red card.",
                ]
            )
        else:
            note = (
                "Sent off after receiving "
                "a second yellow card."
            )

        record_match_event(
            match_id=self.match.id,
            team_id=team_id,
            event_type=(
                MatchEvent.EventType.RED_CARD
            ),
            minute=minute,
            player_id=player.id,
            player_name=player.full_name,
            note=note,
        )

        self.sent_off_players.add(
            player.id
        )

        self.stats[
            "red_cards"
        ] += 1

        self.momentum[
            team_id
        ] = max(
            0.75,
            self.momentum[
                team_id
            ] - 0.18,
        )

        self.stdout.write(
            self.style.ERROR(
                f"{minute}' RED CARD! | "
                f"{self.team_name(team_id)} | "
                f"{player.full_name}"
            )
        )

    # =========================================================
    # PENALTY DURING NORMAL PLAY
    # =========================================================

    def simulate_penalty(
        self,
        team_id,
        minute,
    ):
        player = (
            self.choose_penalty_taker(
                team_id
            )
        )

        self.stats[
            "penalties"
        ] += 1

        record_match_event(
            match_id=self.match.id,
            team_id=team_id,
            event_type=(
                MatchEvent.EventType.PENALTY_KICK
            ),
            minute=minute,
            player_id=player.id,
            player_name=player.full_name,
            note=(
                "Penalty awarded after "
                "a foul inside the area."
            ),
        )

        self.stdout.write(
            self.style.WARNING(
                f"{minute}' PENALTY! | "
                f"{self.team_name(team_id)} | "
                f"{player.full_name} steps up..."
            )
        )

        self.sleep_short()

        scored = (
            random.random()
            < 0.77
        )

        if scored:
            record_goal(
                match_id=self.match.id,
                team_id=team_id,
                minute=minute,
                player_id=player.id,
                player_name=player.full_name,
                note=(
                    "Scored from the penalty spot."
                ),
            )

            self.stats[
                "goals"
            ] += 1

            self.stats[
                "penalties_scored"
            ] += 1

            self.match.refresh_from_db()

            self.stdout.write(
                self.style.SUCCESS(
                    f"{minute}' PENALTY SCORED! | "
                    f"{player.full_name} | "
                    f"{self.match.home_score}-"
                    f"{self.match.away_score}"
                )
            )

            self.momentum[
                team_id
            ] = min(
                1.30,
                self.momentum[
                    team_id
                ] + 0.10,
            )

        else:
            self.stats[
                "penalties_missed"
            ] += 1

            miss_text = (
                random.choice(
                    [
                        "SAVED by the goalkeeper!",
                        "MISSED! The shot flies wide.",
                        "MISSED! It crashes against the post.",
                        "SAVED! The goalkeeper guesses correctly.",
                    ]
                )
            )

            self.stdout.write(
                self.style.ERROR(
                    f"{minute}' "
                    f"{miss_text} | "
                    f"{player.full_name}"
                )
            )

            self.momentum[
                team_id
            ] = max(
                0.75,
                self.momentum[
                    team_id
                ] - 0.08,
            )

    # =========================================================
    # MATCH PAUSE / RESUME
    # =========================================================

    def simulate_pause(
        self,
        minute,
    ):
        reasons = [
            "VAR review in progress",
            "Player receiving treatment",
            "Goalkeeper requires medical attention",
            "Referee pauses play after a collision",
            "Temporary equipment issue",
        ]

        reason = random.choice(
            reasons
        )

        self.stdout.write(
            self.style.WARNING(
                f"{minute}' MATCH PAUSED | "
                f"{reason}"
            )
        )

        pause_match(
            self.match.id
        )

        self.stats[
            "pauses"
        ] += 1

        if self.speed > 0:
            time.sleep(
                min(
                    self.speed
                    * random.uniform(
                        0.5,
                        1.5,
                    ),
                    2.0,
                )
            )

        resume_match(
            self.match.id
        )

        self.match.refresh_from_db()

        self.stdout.write(
            self.style.SUCCESS(
                f"{minute}' PLAY RESUMED"
            )
        )

        # Restore accelerated simulation clock.
        self.set_clock(
            minute
        )

    # =========================================================
    # EXTRA TIME
    # =========================================================

    def simulate_extra_time(self):
        self.match = (
            start_extra_time(
                self.match.id
            )
        )

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "90' EXTRA TIME STARTED"
            )
        )

        # -----------------------------------------------------
        # EXTRA TIME FIRST HALF
        # -----------------------------------------------------

        for minute in range(
            91,
            106,
        ):
            self.simulate_minute(
                minute,
                extra_time=True,
            )

        self.set_clock(
            105
        )

        end_extra_time_first_half(
            self.match.id
        )

        self.stdout.write(
            self.style.WARNING(
                "105' EXTRA-TIME HALF-TIME"
            )
        )

        self.print_score()
        self.sleep_short()

        # -----------------------------------------------------
        # EXTRA TIME SECOND HALF
        # -----------------------------------------------------

        self.match = (
            start_extra_time_second_half(
                self.match.id
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "105' EXTRA-TIME SECOND HALF STARTED"
            )
        )

        for minute in range(
            106,
            121,
        ):
            self.simulate_minute(
                minute,
                extra_time=True,
            )

        # Forced penalty scenario.
        if (
            self.scenario
            == "penalties"
        ):
            self.force_tie(
                120
            )

        # Forced ET winner.
        elif (
            self.scenario
            == "extra-time"
        ):
            self.force_winner(
                120
            )

        self.set_clock(
            120
        )

        self.match = end_extra_time(
            self.match.id
        )

        self.match.refresh_from_db()

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "EXTRA TIME ENDED"
            )
        )

        self.print_score()

        if (
            self.match.status
            == Match.Status.FINISHED
        ):
            self.finish_output()
            return

        if (
            self.match.phase
            == Match.Phase.PENALTY_SHOOTOUT
        ):
            self.simulate_penalty_shootout()
            return

        raise CommandError(
            f"Unexpected state after extra time: "
            f"{self.match.phase}"
        )

    # =========================================================
    # PENALTY SHOOTOUT
    # =========================================================

    def simulate_penalty_shootout(
        self,
    ):
        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "PENALTY SHOOTOUT STARTED"
            )
        )

        safety_counter = 0

        while True:
            self.match.refresh_from_db()

            state = (
                get_shootout_state(
                    self.match
                )
            )

            if state[
                "is_finished"
            ]:
                break

            team_id = state[
                "next_team_id"
            ]

            player = (
                self.choose_penalty_taker(
                    team_id
                )
            )

            # Around 76% conversion rate.
            scored = (
                random.random()
                < 0.76
            )

            result = (
                record_shootout_kick(
                    match_id=self.match.id,
                    team_id=team_id,
                    scored=scored,
                    player_id=player.id,
                    player_name=player.full_name,
                )
            )

            team_name = (
                self.team_name(
                    team_id
                )
            )

            if scored:
                result_text = "SCORED"
                style = self.style.SUCCESS
            else:
                result_text = "MISSED"
                style = self.style.ERROR

            self.stdout.write(
                style(
                    f"PENALTY | "
                    f"{team_name} | "
                    f"{player.full_name} | "
                    f"{result_text}"
                )
            )

            self.sleep_short()

            safety_counter += 1

            if safety_counter > 100:
                raise CommandError(
                    "Penalty shootout "
                    "exceeded safety limit."
                )

            if (
                result["shootout"][
                    "is_finished"
                ]
            ):
                break

        self.match.refresh_from_db()

        state = (
            get_shootout_state(
                self.match
            )
        )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "PENALTY SHOOTOUT FINISHED"
            )
        )

        self.stdout.write(
            f"Penalties: "
            f"{state['home_score']} - "
            f"{state['away_score']}"
        )

        self.finish_output()

    # =========================================================
    # AUTHORITATIVE CLOCK
    # =========================================================

    def set_clock(
        self,
        minute,
    ):
        """
        Move the authoritative server clock to a simulated
        football minute.

        Production services continue to calculate the clock
        normally. The management command accelerates time by
        backdating the active phase timestamp.
        """

        match = (
            Match.objects.get(
                pk=self.match.id
            )
        )

        now = timezone.now()

        # -----------------------------------------------------
        # FIRST HALF
        # -----------------------------------------------------

        if (
            match.phase
            == Match.Phase.FIRST_HALF
        ):
            match.started_at = (
                now
                - timedelta(
                    minutes=minute
                )
            )

            match.save(
                update_fields=[
                    "started_at",
                ]
            )

        # -----------------------------------------------------
        # SECOND HALF
        # -----------------------------------------------------

        elif (
            match.phase
            == Match.Phase.SECOND_HALF
        ):
            elapsed = max(
                0,
                minute - 45,
            )

            match.second_half_started_at = (
                now
                - timedelta(
                    minutes=elapsed
                )
            )

            match.second_half_pause_baseline_seconds = (
                match.total_paused_seconds
            )

            match.save(
                update_fields=[
                    "second_half_started_at",
                    "second_half_pause_baseline_seconds",
                ]
            )

        # -----------------------------------------------------
        # EXTRA TIME FIRST HALF
        # -----------------------------------------------------

        elif (
            match.phase
            == Match.Phase.EXTRA_TIME_FIRST_HALF
        ):
            elapsed = max(
                0,
                minute - 90,
            )

            match.extra_time_first_half_started_at = (
                now
                - timedelta(
                    minutes=elapsed
                )
            )

            match.extra_time_pause_baseline_seconds = (
                match.total_paused_seconds
            )

            match.save(
                update_fields=[
                    "extra_time_first_half_started_at",
                    "extra_time_pause_baseline_seconds",
                ]
            )

        # -----------------------------------------------------
        # EXTRA TIME SECOND HALF
        # -----------------------------------------------------

        elif (
            match.phase
            == Match.Phase.EXTRA_TIME_SECOND_HALF
        ):
            elapsed = max(
                0,
                minute - 105,
            )

            match.extra_time_second_half_started_at = (
                now
                - timedelta(
                    minutes=elapsed
                )
            )

            match.extra_time_second_half_pause_baseline_seconds = (
                match.total_paused_seconds
            )

            match.save(
                update_fields=[
                    "extra_time_second_half_started_at",
                    "extra_time_second_half_pause_baseline_seconds",
                ]
            )

        self.match.refresh_from_db()

    # =========================================================
    # FORCE TIE
    # =========================================================

    def force_tie(
        self,
        minute,
    ):
        self.match.refresh_from_db()

        while (
            self.match.home_score
            != self.match.away_score
        ):
            self.set_clock(
                minute
            )

            if (
                self.match.home_score
                < self.match.away_score
            ):
                team_id = (
                    self.match.home_team_id
                )
            else:
                team_id = (
                    self.match.away_team_id
                )

            player = (
                self.choose_scorer(
                    team_id
                )
            )

            record_goal(
                match_id=self.match.id,
                team_id=team_id,
                minute=minute,
                player_id=player.id,
                player_name=player.full_name,
                note=(
                    "Dramatic late equaliser."
                ),
            )

            self.stats[
                "goals"
            ] += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"{minute}' GOAL! | "
                    f"{self.team_name(team_id)} | "
                    f"{player.full_name} "
                    f"(EQUALISER)"
                )
            )

            self.match.refresh_from_db()

    # =========================================================
    # FORCE WINNER
    # =========================================================

    def force_winner(
        self,
        minute,
    ):
        self.match.refresh_from_db()

        if (
            self.match.home_score
            != self.match.away_score
        ):
            return

        self.set_clock(
            minute
        )

        team_id = random.choice(
            [
                self.match.home_team_id,
                self.match.away_team_id,
            ]
        )

        player = (
            self.choose_scorer(
                team_id
            )
        )

        record_goal(
            match_id=self.match.id,
            team_id=team_id,
            minute=minute,
            player_id=player.id,
            player_name=player.full_name,
            note=(
                "Dramatic late winning goal."
            ),
        )

        self.stats[
            "goals"
        ] += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{minute}' GOAL! | "
                f"{self.team_name(team_id)} | "
                f"{player.full_name} "
                f"(WINNER)"
            )
        )

        self.match.refresh_from_db()

    # =========================================================
    # TEAM / PLAYER HELPERS
    # =========================================================

    def other_team(
        self,
        team_id,
    ):
        if (
            team_id
            == self.match.home_team_id
        ):
            return (
                self.match.away_team_id
            )

        return (
            self.match.home_team_id
        )

    def red_cards_for_team(
        self,
        team_id,
    ):
        original_players = (
            self.home_players
            if team_id
            == self.match.home_team_id
            else self.away_players
        )

        return sum(
            1
            for player
            in original_players
            if player.id
            in self.sent_off_players
        )

    def players_for_team(
        self,
        team_id,
    ):
        if (
            team_id
            == self.match.home_team_id
        ):
            players = (
                self.home_players
            )

        elif (
            team_id
            == self.match.away_team_id
        ):
            players = (
                self.away_players
            )

        else:
            raise CommandError(
                "Invalid team selected "
                "during simulation."
            )

        available = [
            player
            for player
            in players
            if player.id
            not in self.sent_off_players
        ]

        if not available:
            raise CommandError(
                f"{self.team_name(team_id)} "
                f"has no available players."
            )

        return available

    # =========================================================
    # SCORER SELECTION
    # =========================================================

    def choose_scorer(
        self,
        team_id,
    ):
        players = (
            self.players_for_team(
                team_id
            )
        )

        weights = []

        for player in players:
            if (
                player.position
                == Player.Position.FORWARD
            ):
                weight = 6.5

            elif (
                player.position
                == Player.Position.MIDFIELDER
            ):
                weight = 3.5

            elif (
                player.position
                == Player.Position.DEFENDER
            ):
                weight = 1.2

            else:
                weight = 0.1

            weights.append(
                weight
            )

        return random.choices(
            players,
            weights=weights,
            k=1,
        )[0]

    # =========================================================
    # CARD PLAYER SELECTION
    # =========================================================

    def choose_card_player(
        self,
        team_id,
    ):
        players = (
            self.players_for_team(
                team_id
            )
        )

        weights = []

        for player in players:
            if (
                player.position
                == Player.Position.DEFENDER
            ):
                weight = 5.0

            elif (
                player.position
                == Player.Position.MIDFIELDER
            ):
                weight = 3.2

            elif (
                player.position
                == Player.Position.FORWARD
            ):
                weight = 1.4

            else:
                weight = 0.5

            # Previously booked players are slightly more
            # likely to be involved in another challenge.
            if (
                self.yellow_cards.get(
                    player.id,
                    0,
                )
                == 1
            ):
                weight *= 1.10

            weights.append(
                weight
            )

        return random.choices(
            players,
            weights=weights,
            k=1,
        )[0]

    # =========================================================
    # PENALTY TAKER
    # =========================================================

    def choose_penalty_taker(
        self,
        team_id,
    ):
        players = (
            self.players_for_team(
                team_id
            )
        )

        preferred = [
            player
            for player
            in players
            if player.position
            in (
                Player.Position.FORWARD,
                Player.Position.MIDFIELDER,
            )
        ]

        if preferred:
            weights = []

            for player in preferred:
                if (
                    player.position
                    == Player.Position.FORWARD
                ):
                    weights.append(
                        3
                    )
                else:
                    weights.append(
                        2
                    )

            return random.choices(
                preferred,
                weights=weights,
                k=1,
            )[0]

        return random.choice(
            players
        )

    # =========================================================
    # OUTPUT HELPERS
    # =========================================================

    def team_name(
        self,
        team_id,
    ):
        if (
            team_id
            == self.match.home_team_id
        ):
            return (
                self.match.home_team.name
            )

        return (
            self.match.away_team.name
        )

    def print_score(self):
        self.match.refresh_from_db()

        self.stdout.write(
            f"{self.match.home_team.name} "
            f"{self.match.home_score} - "
            f"{self.match.away_score} "
            f"{self.match.away_team.name}"
        )

    # =========================================================
    # FULL-TIME OUTPUT
    # =========================================================

    def finish_output(self):
        self.match.refresh_from_db()

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "============================================"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "                 FULL-TIME"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "============================================"
            )
        )

        self.print_score()

        self.stdout.write(
            f"Status : "
            f"{self.match.status}"
        )

        self.stdout.write(
            f"Phase  : "
            f"{self.match.phase}"
        )

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "------------- MATCH STATS ----------------"
            )
        )

        self.stdout.write(
            f"Goals             : "
            f"{self.stats['goals']}"
        )

        self.stdout.write(
            f"Shots             : "
            f"{self.stats['shots']}"
        )

        self.stdout.write(
            f"Shots on target   : "
            f"{self.stats['shots_on_target']}"
        )

        self.stdout.write(
            f"Fouls             : "
            f"{self.stats['fouls']}"
        )

        self.stdout.write(
            f"Yellow cards      : "
            f"{self.stats['yellow_cards']}"
        )

        self.stdout.write(
            f"Red cards         : "
            f"{self.stats['red_cards']}"
        )

        self.stdout.write(
            f"Penalties awarded : "
            f"{self.stats['penalties']}"
        )

        self.stdout.write(
            f"Penalty goals     : "
            f"{self.stats['penalties_scored']}"
        )

        self.stdout.write(
            f"Penalty misses    : "
            f"{self.stats['penalties_missed']}"
        )

        self.stdout.write(
            f"Match pauses      : "
            f"{self.stats['pauses']}"
        )

        self.stdout.write(
            self.style.WARNING(
                "------------------------------------------"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Simulation completed successfully."
            )
        )

        self.stdout.write("")

    def sleep_short(self):
        if self.speed > 0:
            time.sleep(
                min(
                    self.speed * 0.35,
                    1.5,
                )
            )
