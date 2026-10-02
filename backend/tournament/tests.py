from django.test import TestCase

# Create your tests here.

from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .models import (
    Event,
    EventTeam,
    Match,
    MatchEvent,
    Round,
    Team,
)

from .services import (
    add_team_to_event,
    finish_match,
    get_event_standings,
    record_goal,
    record_match_event,
    start_match,
    validate_match_teams,
)


class TournamentTestBase(TestCase):
    """
    Shared test data.

    Django creates a separate test database, so these
    records do not affect the development database.
    """

    def setUp(self):
        now = timezone.now()

        self.event = Event.objects.create(
            name="Automated Test Tournament",
            description="Tournament used for automated tests.",
            start_date=now,
            end_date=now + timezone.timedelta(days=7),
            status=Event.Status.ACTIVE,
        )

        self.home_team = Team.objects.create(
            name="Home FC",
            code="HFC",
        )

        self.away_team = Team.objects.create(
            name="Away FC",
            code="AFC",
        )

        self.third_team = Team.objects.create(
            name="Third FC",
            code="TFC",
        )

        self.unregistered_team = Team.objects.create(
            name="Unregistered FC",
            code="UFC",
        )

        for team in (
            self.home_team,
            self.away_team,
            self.third_team,
        ):
            EventTeam.objects.create(
                event=self.event,
                team=team,
            )

        self.round = Round.objects.create(
            event=self.event,
            name="Round 1",
            order_number=1,
        )

        self.match = Match.objects.create(
            round=self.round,
            home_team=self.home_team,
            away_team=self.away_team,
            scheduled_at=now + timezone.timedelta(hours=2),
            venue="Test Stadium",
        )

    def start_test_match(self):
        """
        Start the match without requiring Redis.
        """

        with patch("tournament.services.broadcast_match_update"):
            return start_match(self.match.id)

    def finish_test_match(self):
        """
        Finish the match without requiring Redis.
        """

        with patch("tournament.services.broadcast_match_update"):
            return finish_match(self.match.id)


class MatchModelTests(TournamentTestBase):

    def test_match_is_scheduled_by_default(self):
        self.assertEqual(
            self.match.status,
            Match.Status.SCHEDULED,
        )

        self.assertEqual(self.match.home_score, 0)
        self.assertEqual(self.match.away_score, 0)

        self.assertIsNone(self.match.started_at)
        self.assertIsNone(self.match.ended_at)

    def test_team_cannot_play_against_itself(self):
        self.match.away_team = self.home_team

        with self.assertRaises(ValidationError):
            self.match.full_clean()

    def test_event_team_cannot_be_registered_twice(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                EventTeam.objects.create(
                    event=self.event,
                    team=self.home_team,
                )

    def test_round_order_must_be_unique_per_event(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Round.objects.create(
                    event=self.event,
                    name="Duplicate Round",
                    order_number=1,
                )


class MatchValidationTests(TournamentTestBase):

    def test_valid_match_teams(self):
        validate_match_teams(
            round_id=self.round.id,
            home_team_id=self.home_team.id,
            away_team_id=self.away_team.id,
            exclude_match_id=self.match.id,
        )

    def test_same_team_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_match_teams(
                round_id=self.round.id,
                home_team_id=self.home_team.id,
                away_team_id=self.home_team.id,
            )

    def test_unregistered_team_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_match_teams(
                round_id=self.round.id,
                home_team_id=self.home_team.id,
                away_team_id=self.unregistered_team.id,
            )

    def test_team_cannot_play_twice_in_same_round(self):
        with self.assertRaises(ValidationError):
            validate_match_teams(
                round_id=self.round.id,
                home_team_id=self.home_team.id,
                away_team_id=self.third_team.id,
            )

    def test_existing_match_can_be_excluded_during_edit(self):
        validate_match_teams(
            round_id=self.round.id,
            home_team_id=self.home_team.id,
            away_team_id=self.away_team.id,
            exclude_match_id=self.match.id,
        )


class MatchLifecycleTests(TournamentTestBase):

    def test_scheduled_match_can_start(self):
        self.start_test_match()

        self.match.refresh_from_db()

        self.assertEqual(
            self.match.status,
            Match.Status.LIVE,
        )

        self.assertIsNotNone(self.match.started_at)

    def test_match_cannot_start_twice(self):
        self.start_test_match()

        with self.assertRaises(ValidationError):
            start_match(self.match.id)

    def test_draft_event_match_cannot_start(self):
        self.event.status = Event.Status.DRAFT
        self.event.save(update_fields=["status"])

        with self.assertRaises(ValidationError):
            start_match(self.match.id)

        self.match.refresh_from_db()

        self.assertEqual(
            self.match.status,
            Match.Status.SCHEDULED,
        )

    def test_scheduled_match_cannot_finish(self):
        with self.assertRaises(ValidationError):
            finish_match(self.match.id)

    def test_live_match_can_finish(self):
        self.start_test_match()
        self.finish_test_match()

        self.match.refresh_from_db()

        self.assertEqual(
            self.match.status,
            Match.Status.FINISHED,
        )

        self.assertIsNotNone(self.match.ended_at)

    def test_finished_match_cannot_finish_again(self):
        self.start_test_match()
        self.finish_test_match()

        with self.assertRaises(ValidationError):
            finish_match(self.match.id)

    def test_start_schedules_realtime_broadcast(self):
        with patch(
            "tournament.services.broadcast_match_update"
        ) as broadcast:

            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                start_match(self.match.id)

            self.assertEqual(len(callbacks), 1)

            broadcast.assert_called_once()

            args = broadcast.call_args.args

            self.assertEqual(args[0].id, self.match.id)
            self.assertEqual(args[1], "match_started")

    def test_finish_schedules_realtime_broadcast(self):
        self.start_test_match()

        with patch(
            "tournament.services.broadcast_match_update"
        ) as broadcast:

            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                finish_match(self.match.id)

            self.assertEqual(len(callbacks), 1)

            broadcast.assert_called_once()

            args = broadcast.call_args.args

            self.assertEqual(args[0].id, self.match.id)
            self.assertEqual(args[1], "match_finished")


class GoalTests(TournamentTestBase):

    def setUp(self):
        super().setUp()
        self.start_test_match()

    def test_home_goal_increases_home_score(self):
        with patch("tournament.services.broadcast_match_update"):
            event = record_goal(
                match_id=self.match.id,
                team_id=self.home_team.id,
                minute=12,
                player_name="Adnan",
            )

        self.match.refresh_from_db()

        self.assertEqual(self.match.home_score, 1)
        self.assertEqual(self.match.away_score, 0)

        self.assertEqual(
            event.type,
            MatchEvent.EventType.GOAL,
        )

        self.assertEqual(event.player_name, "Adnan")
        self.assertEqual(event.minute, 12)

    def test_away_goal_increases_away_score(self):
        with patch("tournament.services.broadcast_match_update"):
            record_goal(
                match_id=self.match.id,
                team_id=self.away_team.id,
                minute=30,
                player_name="Qasim",
            )

        self.match.refresh_from_db()

        self.assertEqual(self.match.home_score, 0)
        self.assertEqual(self.match.away_score, 1)

    def test_unrelated_team_cannot_score(self):
        with self.assertRaises(ValidationError):
            record_goal(
                match_id=self.match.id,
                team_id=self.third_team.id,
                minute=15,
            )

        self.match.refresh_from_db()

        self.assertEqual(self.match.home_score, 0)
        self.assertEqual(self.match.away_score, 0)

    def test_invalid_goal_minute_is_rejected(self):
        for minute in (-1, 121):
            with self.subTest(minute=minute):
                with self.assertRaises(ValidationError):
                    record_goal(
                        match_id=self.match.id,
                        team_id=self.home_team.id,
                        minute=minute,
                    )

    def test_finished_match_cannot_receive_goal(self):
        self.finish_test_match()

        with self.assertRaises(ValidationError):
            record_goal(
                match_id=self.match.id,
                team_id=self.home_team.id,
                minute=80,
            )

    def test_goal_schedules_realtime_broadcast(self):
        with patch(
            "tournament.services.broadcast_match_update"
        ) as broadcast:

            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                event = record_goal(
                    match_id=self.match.id,
                    team_id=self.home_team.id,
                    minute=25,
                    player_name="Ali",
                )

            self.assertEqual(len(callbacks), 1)

            broadcast.assert_called_once()

            args = broadcast.call_args.args

            self.assertEqual(args[0].id, self.match.id)
            self.assertEqual(args[1], "goal_scored")
            self.assertEqual(args[2].id, event.id)


class MatchEventTests(TournamentTestBase):

    def setUp(self):
        super().setUp()
        self.start_test_match()

    def test_yellow_card_can_be_recorded(self):
        with patch("tournament.services.broadcast_match_update"):
            event = record_match_event(
                match_id=self.match.id,
                team_id=self.home_team.id,
                event_type=MatchEvent.EventType.YELLOW_CARD,
                minute=45,
                player_name="Qasim",
            )

        self.assertEqual(
            event.type,
            MatchEvent.EventType.YELLOW_CARD,
        )

        self.assertEqual(event.minute, 45)

    def test_reward_points_are_stored(self):
        with patch("tournament.services.broadcast_match_update"):
            event = record_match_event(
                match_id=self.match.id,
                team_id=self.home_team.id,
                event_type=MatchEvent.EventType.REWARD,
                minute=60,
                points=2,
                note="Fair play bonus",
            )

        self.assertEqual(event.points, 2)
        self.assertEqual(event.note, "Fair play bonus")

    def test_goal_type_is_rejected_by_generic_event_service(self):
        with self.assertRaises(ValidationError):
            record_match_event(
                match_id=self.match.id,
                team_id=self.home_team.id,
                event_type=MatchEvent.EventType.GOAL,
                minute=10,
            )

    def test_invalid_event_minute_is_rejected(self):
        with self.assertRaises(ValidationError):
            record_match_event(
                match_id=self.match.id,
                team_id=self.home_team.id,
                event_type=MatchEvent.EventType.YELLOW_CARD,
                minute=121,
            )

    def test_unrelated_team_cannot_receive_event(self):
        with self.assertRaises(ValidationError):
            record_match_event(
                match_id=self.match.id,
                team_id=self.third_team.id,
                event_type=MatchEvent.EventType.RED_CARD,
                minute=20,
            )

    def test_finished_match_cannot_receive_event(self):
        self.finish_test_match()

        with self.assertRaises(ValidationError):
            record_match_event(
                match_id=self.match.id,
                team_id=self.home_team.id,
                event_type=MatchEvent.EventType.REWARD,
                minute=90,
                points=2,
            )


class StandingsTests(TournamentTestBase):

    def test_scheduled_match_does_not_count_in_standings(self):
        standings = get_event_standings(self.event.id)

        for row in standings:
            self.assertEqual(row["played"], 0)
            self.assertEqual(row["points"], 0)

    def test_finished_match_updates_standings_and_rewards(self):
        self.start_test_match()

        with patch("tournament.services.broadcast_match_update"):
            record_goal(
                match_id=self.match.id,
                team_id=self.home_team.id,
                minute=10,
            )

            record_goal(
                match_id=self.match.id,
                team_id=self.home_team.id,
                minute=25,
            )

            record_goal(
                match_id=self.match.id,
                team_id=self.away_team.id,
                minute=40,
            )

            record_match_event(
                match_id=self.match.id,
                team_id=self.home_team.id,
                event_type=MatchEvent.EventType.REWARD,
                minute=60,
                points=2,
                note="Simulation bonus",
            )

        self.finish_test_match()

        standings = get_event_standings(self.event.id)

        by_team = {
            row["team_id"]: row
            for row in standings
        }

        home = by_team[self.home_team.id]
        away = by_team[self.away_team.id]

        # Home wins 2-1:
        # 3 points for winning + 2 reward points.
        self.assertEqual(home["played"], 1)
        self.assertEqual(home["won"], 1)
        self.assertEqual(home["drawn"], 0)
        self.assertEqual(home["lost"], 0)

        self.assertEqual(home["goals_for"], 2)
        self.assertEqual(home["goals_against"], 1)
        self.assertEqual(home["goal_difference"], 1)

        self.assertEqual(home["reward_points"], 2)
        self.assertEqual(home["points"], 5)

        self.assertEqual(away["played"], 1)
        self.assertEqual(away["lost"], 1)
        self.assertEqual(away["points"], 0)

        # The winning team should appear first.
        self.assertEqual(
            standings[0]["team_id"],
            self.home_team.id,
        )

    def test_draw_awards_one_point_to_each_team(self):
        self.start_test_match()
        self.finish_test_match()

        standings = get_event_standings(self.event.id)

        by_team = {
            row["team_id"]: row
            for row in standings
        }

        for team in (self.home_team, self.away_team):
            row = by_team[team.id]

            self.assertEqual(row["played"], 1)
            self.assertEqual(row["drawn"], 1)
            self.assertEqual(row["points"], 1)


class EventEnrollmentTests(TournamentTestBase):

    def test_add_team_to_event_is_idempotent(self):
        first, first_created = add_team_to_event(
            self.event.id,
            self.unregistered_team.id,
        )

        second, second_created = add_team_to_event(
            self.event.id,
            self.unregistered_team.id,
        )

        self.assertTrue(first_created)
        self.assertFalse(second_created)

        self.assertEqual(first.id, second.id)

        self.assertEqual(
            EventTeam.objects.filter(
                event=self.event,
                team=self.unregistered_team,
            ).count(),
            1,
        )
