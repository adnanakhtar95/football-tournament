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
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="rounds",
    )

    name = models.CharField(max_length=100)

    order_number = models.PositiveIntegerField()

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
        GOAL = "goal", "Goal"
        YELLOW_CARD = "yellow_card", "Yellow Card"
        RED_CARD = "red_card", "Red Card"
        PENALTY_KICK = "penalty_kick", "Penalty Kick"
        REWARD = "reward", "Reward"

    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name="events",
    )

    team = models.ForeignKey(
        Team,
        on_delete=models.PROTECT,
        related_name="match_events",
    )

    type = models.CharField(
        max_length=20,
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