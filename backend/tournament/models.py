from django.core.exceptions import ValidationError
from django.db import models


class Event(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name


class Team(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    logo = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Player(models.Model):
    class Position(models.TextChoices):
        GOALKEEPER = "GK", "Goalkeeper"
        DEFENDER = "DF", "Defender"
        MIDFIELDER = "MF", "Midfielder"
        FORWARD = "FW", "Forward"

    team = models.ForeignKey(
        Team,
        on_delete=models.PROTECT,
        related_name="players",
    )

    full_name = models.CharField(max_length=100)

    jersey_number = models.PositiveSmallIntegerField()

    position = models.CharField(
        max_length=2,
        choices=Position.choices,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["team__name", "jersey_number"]

        constraints = [
            models.UniqueConstraint(
                fields=["team", "jersey_number"],
                name="unique_player_jersey_per_team",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    jersey_number__gte=1,
                    jersey_number__lte=99,
                ),
                name="valid_player_jersey_number",
            ),
        ]

    def __str__(self):
        return (
            f"{self.full_name} "
            f"(#{self.jersey_number} - {self.team.code})"
        )


class EventTeam(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="event_teams",
    )

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="event_teams",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event", "team"],
                name="unique_team_per_event",
            )
        ]

    def __str__(self):
        return f"{self.event.name} - {self.team.name}"


class Round(models.Model):
    class RoundType(models.TextChoices):
        GROUP = "group", "Group / League"
        KNOCKOUT = "knockout", "Knockout"

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="rounds",
    )

    name = models.CharField(max_length=100)

    order_number = models.PositiveIntegerField()

    round_type = models.CharField(
        max_length=20,
        choices=RoundType.choices,
        default=RoundType.GROUP,
    )

    class Meta:
        ordering = ["order_number"]

        constraints = [
            models.UniqueConstraint(
                fields=["event", "order_number"],
                name="unique_round_order_per_event",
            )
        ]

    def __str__(self):
        return f"{self.event.name} - {self.name}"


class Match(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        LIVE = "live", "Live"
        FINISHED = "finished", "Finished"
    
    class Phase(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        FIRST_HALF = "first_half", "First Half"
        HALF_TIME = "half_time", "Half Time"
        SECOND_HALF = "second_half", "Second Half"
        REGULATION_ENDED = "regulation_ended", "Regulation Ended"
        FULL_TIME = "full_time", "Full Time"
        EXTRA_TIME_FIRST_HALF = (
            "extra_time_first_half",
            "Extra Time - First Half",
        )

        EXTRA_TIME_INTERVAL = (
            "extra_time_interval",
            "Extra Time Interval",
        )

        EXTRA_TIME_SECOND_HALF = (
            "extra_time_second_half",
            "Extra Time - Second Half",
        )

        PENALTY_SHOOTOUT = (
            "penalty_shootout",
            "Penalty Shootout",
        )

    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        related_name="matches",
    )

    home_team = models.ForeignKey(
        Team,
        on_delete=models.PROTECT,
        related_name="home_matches",
    )

    away_team = models.ForeignKey(
        Team,
        on_delete=models.PROTECT,
        related_name="away_matches",
    )

    scheduled_at = models.DateTimeField()

    venue = models.CharField(
        max_length=200,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    ended_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    home_score = models.PositiveIntegerField(default=0)
    away_score = models.PositiveIntegerField(default=0)

    # Advanced match controls
    is_paused = models.BooleanField(default=False)

    paused_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    total_paused_seconds = models.PositiveIntegerField(default=0)

    extra_time_minutes = models.PositiveSmallIntegerField(default=0)
    # Knockout match configuration
    is_knockout = models.BooleanField(
        default=False,
        help_text="Enable knockout extra time and penalty shootouts.",
    )

    # Football match lifecycle
    phase = models.CharField(
        max_length=25,
        choices=Phase.choices,
        default=Phase.NOT_STARTED,
    )

    # First-half tracking
    first_half_ended_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    first_half_elapsed_seconds = models.PositiveIntegerField(
        default=0,
    )

    first_half_stoppage_minutes = models.PositiveSmallIntegerField(
        default=0,
    )

    # Second-half tracking
    second_half_started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    second_half_stoppage_minutes = models.PositiveSmallIntegerField(
        default=0,
    )

    # Snapshot of accumulated pause time when
    # the second half begins.
    second_half_pause_baseline_seconds = (
        models.PositiveIntegerField(default=0)
    )
    # Knockout extra-time tracking
    regulation_elapsed_seconds = models.PositiveIntegerField(
        default=90 * 60,
    )

    extra_time_first_half_started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    extra_time_first_half_elapsed_seconds = models.PositiveIntegerField(
        default=0,
    )

    extra_time_first_half_ended_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    extra_time_second_half_started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    extra_time_pause_baseline_seconds = models.PositiveIntegerField(
        default=0,
    )

    extra_time_second_half_pause_baseline_seconds = (
        models.PositiveIntegerField(default=0)
    )

    extra_time_elapsed_seconds = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        ordering = ["scheduled_at"]

    def clean(self):
        if (
            self.home_team_id
            and self.away_team_id
            and self.home_team_id == self.away_team_id
        ):
            raise ValidationError(
                "A team cannot play against itself."
            )

    def __str__(self):
        return f"{self.home_team.name} vs {self.away_team.name}"




class MatchEvent(models.Model):
    class EventType(models.TextChoices):
        # Existing football events
        GOAL = "goal", "Goal"
        FOUL = "foul", "Foul"
        YELLOW_CARD = "yellow_card", "Yellow Card"
        RED_CARD = "red_card", "Red Card"
        PENALTY_KICK = "penalty_kick", "Penalty Kick"
        REWARD = "reward", "Reward"

        # Automatically generated commentary announcements
        MATCH_STARTED = "match_started", "Match Started"
        MATCH_PAUSED = "match_paused", "Match Paused"
        MATCH_RESUMED = "match_resumed", "Match Resumed"
        EXTRA_TIME = "extra_time", "Extra Time"
        MATCH_FINISHED = "match_finished", "Match Finished"
        HALF_TIME = "half_time", "Half Time"
        SECOND_HALF_STARTED = (
            "second_half_started",
            "Second Half Started",
        )
        REGULATION_ENDED = (
            "regulation_ended",
            "Regulation Ended",
        )
        EXTRA_TIME_STARTED = (
            "extra_time_started",
            "Extra Time Started",
        )

        EXTRA_TIME_HALF_TIME = (
            "extra_time_half_time",
            "Extra Time Half Time",
        )

        EXTRA_TIME_SECOND_HALF_STARTED = (
            "et_second_half_started",
            "Extra Time Second Half Started",
        )

        EXTRA_TIME_ENDED = (
            "extra_time_ended",
            "Extra Time Ended",
        )

        PENALTY_SHOOTOUT_STARTED = (
            "shootout_started",
            "Penalty Shootout Started",
        )

        PENALTY_SHOOTOUT_FINISHED = (
            "shootout_finished",
            "Penalty Shootout Finished",
        )



    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name="events",
    )

    team = models.ForeignKey(
        Team,
        on_delete=models.PROTECT,
        related_name="match_events",
        null=True,
        blank=True,
    )

    type = models.CharField(
        max_length=30,
        choices=EventType.choices,
    )
    
    player = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        related_name="match_events",
        null=True,
        blank=True,
        help_text="Optional registered player associated with this event.",
    )
    player_name = models.CharField(
        max_length=100,
        blank=True,
    )


    minute = models.PositiveIntegerField()

    points = models.IntegerField(
        default=0,
        help_text="Used primarily for rewards.",
    )

    note = models.TextField(blank=True)

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["minute", "created_at"]

    def __str__(self):
        return (
            f"{self.match} - "
            f"{self.get_type_display()} - "
            f"{self.minute}'"
        )


class PenaltyShootoutKick(models.Model):
    """
    Represents an individual penalty shootout attempt.

    Shootout goals are tracked separately from
    regular match goals.
    """

    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name="shootout_kicks",
    )

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="shootout_kicks",
    )

    player = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shootout_kicks",
    )

    player_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    kick_number = models.PositiveIntegerField()

    scored = models.BooleanField(
        default=False,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["created_at", "id"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "match",
                    "team",
                    "kick_number",
                ],
                name="unique_team_shootout_kick",
            ),
        ]

    def __str__(self):
        result = "Scored" if self.scored else "Missed"

        return (
            f"Match {self.match_id} - "
            f"Team {self.team_id} - "
            f"Kick {self.kick_number}: {result}"
        )
