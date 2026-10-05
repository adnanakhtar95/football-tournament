from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tournament.models import (
    Event,
    EventTeam,
    Match,
    Player,
    Round,
    Team,
)


class Command(BaseCommand):
    help = "Create a rich football tournament demo dataset."

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()

        self.stdout.write("Creating football demo universe...")

        # =========================================================
        # TEAMS
        # =========================================================

        teams_data = [
            ("Islamabad United", "ISL"),
            ("Lahore Lions", "LHR"),
            ("Karachi Kings FC", "KHI"),
            ("Peshawar Stars", "PES"),
            ("Rawalpindi Rangers", "RWP"),
            ("Quetta Warriors", "QTA"),
            ("Multan Falcons", "MUL"),
            ("Faisalabad Wolves", "FSD"),
            ("Sialkot Stallions", "SKT"),
            ("Gujranwala Titans", "GUJ"),
            ("Abbottabad Eagles", "ABT"),
            ("Hyderabad Royals", "HYD"),
        ]

        teams = {}

        for name, code in teams_data:
            team, _ = Team.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                },
            )

            teams[code] = team

        # =========================================================
        # PLAYERS
        # 11 registered players per team
        # =========================================================

        first_names = [
            "Ali",
            "Ahmed",
            "Usman",
            "Hamza",
            "Bilal",
            "Hassan",
            "Saad",
            "Zain",
            "Fahad",
            "Daniyal",
            "Talha",
        ]

        last_names = {
            "ISL": "Khan",
            "LHR": "Raza",
            "KHI": "Ahmed",
            "PES": "Afridi",
            "RWP": "Malik",
            "QTA": "Baloch",
            "MUL": "Shah",
            "FSD": "Butt",
            "SKT": "Sheikh",
            "GUJ": "Awan",
            "ABT": "Abbasi",
            "HYD": "Siddiqui",
        }

        positions = [
            Player.Position.GOALKEEPER,
            Player.Position.DEFENDER,
            Player.Position.DEFENDER,
            Player.Position.DEFENDER,
            Player.Position.DEFENDER,
            Player.Position.MIDFIELDER,
            Player.Position.MIDFIELDER,
            Player.Position.MIDFIELDER,
            Player.Position.FORWARD,
            Player.Position.FORWARD,
            Player.Position.FORWARD,
        ]

        jersey_numbers = [
            1,
            2,
            4,
            5,
            6,
            8,
            10,
            11,
            7,
            9,
            17,
        ]

        for code, team in teams.items():
            for index in range(11):
                Player.objects.update_or_create(
                    team=team,
                    jersey_number=jersey_numbers[index],
                    defaults={
                        "full_name": (
                            f"{first_names[index]} "
                            f"{last_names[code]}"
                        ),
                        "position": positions[index],
                        "is_active": True,
                    },
                )

        # =========================================================
        # EVENT 1
        # Islamabad Champions Cup
        # Main active tournament
        # =========================================================

        champions_cup, _ = Event.objects.update_or_create(
            name="Islamabad Champions Cup 2026",
            defaults={
                "description": (
                    "The flagship national football competition "
                    "featuring group-stage football followed by "
                    "knockout rounds."
                ),
                "start_date": now - timedelta(days=2),
                "end_date": now + timedelta(days=20),
                "status": Event.Status.ACTIVE,
            },
        )

        champions_codes = [
            "ISL",
            "LHR",
            "KHI",
            "PES",
            "RWP",
            "QTA",
            "MUL",
            "FSD",
        ]

        self.attach_teams(
            champions_cup,
            champions_codes,
            teams,
        )

        group_round = self.create_round(
            champions_cup,
            "Group Stage",
            1,
            Round.RoundType.GROUP,
        )

        quarter_final = self.create_round(
            champions_cup,
            "Quarter Finals",
            2,
            Round.RoundType.KNOCKOUT,
        )

        semi_final = self.create_round(
            champions_cup,
            "Semi Finals",
            3,
            Round.RoundType.KNOCKOUT,
        )

        final = self.create_round(
            champions_cup,
            "Grand Final",
            4,
            Round.RoundType.KNOCKOUT,
        )

        # ---------------------------------------------------------
        # Group fixtures
        # ---------------------------------------------------------

        group_matches = [
            ("ISL", "LHR", "Jinnah Stadium"),
            ("KHI", "PES", "Sports Complex"),
            ("RWP", "QTA", "Army Football Ground"),
            ("MUL", "FSD", "Jinnah Stadium"),

            ("ISL", "KHI", "Sports Complex"),
            ("LHR", "PES", "Jinnah Stadium"),
            ("RWP", "MUL", "Army Football Ground"),
            ("QTA", "FSD", "Sports Complex"),

            ("ISL", "PES", "Jinnah Stadium"),
            ("LHR", "KHI", "Sports Complex"),
            ("RWP", "FSD", "Army Football Ground"),
            ("QTA", "MUL", "Jinnah Stadium"),

            ("ISL", "RWP", "Jinnah Stadium"),
            ("LHR", "QTA", "Sports Complex"),
            ("KHI", "MUL", "Army Football Ground"),
            ("PES", "FSD", "Jinnah Stadium"),

            ("ISL", "QTA", "Sports Complex"),
            ("LHR", "MUL", "Jinnah Stadium"),
            ("KHI", "FSD", "Army Football Ground"),
            ("PES", "RWP", "Sports Complex"),
        ]

        self.create_matches(
            group_round,
            group_matches,
            teams,
            now,
            start_hours=1,
            knockout=False,
        )

        # ---------------------------------------------------------
        # Quarter finals
        # ---------------------------------------------------------

        quarter_matches = [
            ("ISL", "FSD", "Jinnah Stadium"),
            ("LHR", "MUL", "Sports Complex"),
            ("KHI", "QTA", "Jinnah Stadium"),
            ("PES", "RWP", "Sports Complex"),
        ]

        self.create_matches(
            quarter_final,
            quarter_matches,
            teams,
            now,
            start_hours=60,
            knockout=True,
        )

        # ---------------------------------------------------------
        # Semi finals
        #
        # Seeded teams are intentional for demo purposes.
        # Later tournament progression can replace this with
        # automatically advancing winners.
        # ---------------------------------------------------------

        semi_matches = [
            ("ISL", "PES", "Jinnah Stadium"),
            ("LHR", "KHI", "Sports Complex"),
        ]

        self.create_matches(
            semi_final,
            semi_matches,
            teams,
            now,
            start_hours=90,
            knockout=True,
        )

        # ---------------------------------------------------------
        # Grand Final
        # ---------------------------------------------------------

        self.create_matches(
            final,
            [
                (
                    "ISL",
                    "KHI",
                    "Jinnah Stadium - Main Arena",
                ),
            ],
            teams,
            now,
            start_hours=120,
            knockout=True,
        )

        # =========================================================
        # EVENT 2
        # Pakistan Elite League
        # =========================================================

        elite_league, _ = Event.objects.update_or_create(
            name="Pakistan Elite League 2026",
            defaults={
                "description": (
                    "A league-format competition featuring clubs "
                    "from major football cities across Pakistan."
                ),
                "start_date": now + timedelta(days=35),
                "end_date": now + timedelta(days=70),
                "status": Event.Status.DRAFT,
            },
        )

        elite_codes = [
            "ISL",
            "LHR",
            "KHI",
            "PES",
            "SKT",
            "GUJ",
            "ABT",
            "HYD",
        ]

        self.attach_teams(
            elite_league,
            elite_codes,
            teams,
        )

        elite_round = self.create_round(
            elite_league,
            "League Phase",
            1,
            Round.RoundType.GROUP,
        )

        elite_matches = [
            ("ISL", "SKT", "Jinnah Stadium"),
            ("LHR", "GUJ", "Punjab Stadium"),
            ("KHI", "HYD", "National Stadium Ground"),
            ("PES", "ABT", "Qayyum Stadium"),

            ("SKT", "LHR", "Sialkot Football Ground"),
            ("GUJ", "KHI", "Gujranwala Stadium"),
            ("HYD", "PES", "Niaz Stadium Ground"),
            ("ABT", "ISL", "Abbottabad Football Ground"),

            ("ISL", "GUJ", "Jinnah Stadium"),
            ("LHR", "HYD", "Punjab Stadium"),
            ("KHI", "ABT", "National Stadium Ground"),
            ("PES", "SKT", "Qayyum Stadium"),
        ]

        self.create_matches(
            elite_round,
            elite_matches,
            teams,
            now,
            start_hours=24 * 35,
            knockout=False,
        )

        # =========================================================
        # EVENT 3
        # Capital Super Cup
        # Small knockout tournament
        # =========================================================

        super_cup, _ = Event.objects.update_or_create(
            name="Capital Super Cup 2026",
            defaults={
                "description": (
                    "A fast-paced knockout cup designed to showcase "
                    "extra time and penalty shootout functionality."
                ),
                "start_date": now + timedelta(days=10),
                "end_date": now + timedelta(days=15),
                "status": Event.Status.ACTIVE,
            },
        )

        super_codes = [
            "ISL",
            "RWP",
            "LHR",
            "PES",
        ]

        self.attach_teams(
            super_cup,
            super_codes,
            teams,
        )

        super_semi = self.create_round(
            super_cup,
            "Semi Finals",
            1,
            Round.RoundType.KNOCKOUT,
        )

        super_final = self.create_round(
            super_cup,
            "Final",
            2,
            Round.RoundType.KNOCKOUT,
        )

        self.create_matches(
            super_semi,
            [
                (
                    "ISL",
                    "PES",
                    "Jinnah Stadium",
                ),
                (
                    "RWP",
                    "LHR",
                    "Army Football Ground",
                ),
            ],
            teams,
            now,
            start_hours=240,
            knockout=True,
        )

        self.create_matches(
            super_final,
            [
                (
                    "ISL",
                    "LHR",
                    "Jinnah Stadium - Main Arena",
                ),
            ],
            teams,
            now,
            start_hours=300,
            knockout=True,
        )

        # =========================================================
        # SUMMARY
        # =========================================================

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "========================================="
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                " FOOTBALL DEMO DATABASE READY"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "========================================="
            )
        )

        self.stdout.write(
            f"Events  : {Event.objects.count()}"
        )

        self.stdout.write(
            f"Teams   : {Team.objects.count()}"
        )

        self.stdout.write(
            f"Players : {Player.objects.count()}"
        )

        self.stdout.write(
            f"Rounds  : {Round.objects.count()}"
        )

        self.stdout.write(
            f"Matches : {Match.objects.count()}"
        )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "Demo football universe created successfully."
            )
        )

    # =============================================================
    # HELPERS
    # =============================================================

    def attach_teams(
        self,
        event,
        team_codes,
        teams,
    ):
        for code in team_codes:
            EventTeam.objects.get_or_create(
                event=event,
                team=teams[code],
            )

    def create_round(
        self,
        event,
        name,
        order_number,
        round_type,
    ):
        round_obj, _ = Round.objects.update_or_create(
            event=event,
            order_number=order_number,
            defaults={
                "name": name,
                "round_type": round_type,
            },
        )

        return round_obj

    def create_matches(
        self,
        round_obj,
        fixtures,
        teams,
        base_time,
        start_hours,
        knockout,
    ):
        for index, fixture in enumerate(fixtures):
            home_code, away_code, venue = fixture

            scheduled_at = (
                base_time
                + timedelta(
                    hours=start_hours + (index * 3)
                )
            )

            Match.objects.update_or_create(
                round=round_obj,
                home_team=teams[home_code],
                away_team=teams[away_code],
                defaults={
                    "scheduled_at": scheduled_at,
                    "venue": venue,
                    "is_knockout": knockout,
                    "status": Match.Status.SCHEDULED,
                    "phase": Match.Phase.NOT_STARTED,
                    "home_score": 0,
                    "away_score": 0,
                },
            )