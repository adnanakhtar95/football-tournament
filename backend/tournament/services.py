from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import EventTeam, Match, MatchEvent


@transaction.atomic
def start_match(match_id):
    match = (
        Match.objects
        .select_for_update()
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
        .get(pk=match_id)
    )

    if match.status != Match.Status.SCHEDULED:
        raise ValidationError(
            "Only scheduled matches can be started."
        )

    if match.round.event.status != Event.Status.ACTIVE:
        raise ValidationError(
            "The event must be active before a match can start."
        )

    match.status = Match.Status.LIVE
    match.started_at = timezone.now()

    match.save(
        update_fields=[
            "status",
            "started_at",
        ]
    )

    return match


@transaction.atomic
def finish_match(match_id):
    match = (
        Match.objects
        .select_for_update()
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can be finished."
        )

    match.status = Match.Status.FINISHED
    match.ended_at = timezone.now()

    match.save(
        update_fields=[
            "status",
            "ended_at",
        ]
    )

    return match


@transaction.atomic
def record_goal(
    match_id,
    team_id,
    minute,
    player_name="",
    note="",
):
    match = (
        Match.objects
        .select_for_update()
        .select_related(
            "home_team",
            "away_team",
        )
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Goals can only be recorded for live matches."
        )

    if team_id not in (
        match.home_team_id,
        match.away_team_id,
    ):
        raise ValidationError(
            "The selected team is not playing in this match."
        )

    if minute < 0 or minute > 120:
        raise ValidationError(
            "Minute must be between 0 and 120."
        )

    event = MatchEvent.objects.create(
        match=match,
        team_id=team_id,
        type=MatchEvent.EventType.GOAL,
        player_name=player_name,
        minute=minute,
        note=note,
    )

    if team_id == match.home_team_id:
        match.home_score += 1
    else:
        match.away_score += 1

    match.save(
        update_fields=[
            "home_score",
            "away_score",
        ]
    )

    return event


@transaction.atomic
def record_match_event(
    match_id,
    team_id,
    event_type,
    minute,
    player_name="",
    points=0,
    note="",
):
    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Match events can only be recorded for live matches."
        )

    if team_id not in (
        match.home_team_id,
        match.away_team_id,
    ):
        raise ValidationError(
            "The selected team is not playing in this match."
        )

    valid_types = {
        MatchEvent.EventType.YELLOW_CARD,
        MatchEvent.EventType.RED_CARD,
        MatchEvent.EventType.PENALTY_KICK,
        MatchEvent.EventType.REWARD,
    }

    if event_type not in valid_types:
        raise ValidationError(
            "Unsupported match event type."
        )

    if minute < 0 or minute > 120:
        raise ValidationError(
            "Minute must be between 0 and 120."
        )

    return MatchEvent.objects.create(
        match=match,
        team_id=team_id,
        type=event_type,
        player_name=player_name,
        minute=minute,
        points=points,
        note=note,
    )


def validate_match_teams(
    round_id,
    home_team_id,
    away_team_id,
):
    if home_team_id == away_team_id:
        raise ValidationError(
            "A team cannot play against itself."
        )

    # Get the round so we can determine its event.
    from .models import Round

    round_obj = Round.objects.get(pk=round_id)
    event_id = round_obj.event_id

    # Both teams must belong to the event.
    event_team_ids = set(
        EventTeam.objects.filter(
            event_id=event_id
        ).values_list(
            "team_id",
            flat=True,
        )
    )

    if home_team_id not in event_team_ids:
        raise ValidationError(
            "Home team is not registered for this event."
        )

    if away_team_id not in event_team_ids:
        raise ValidationError(
            "Away team is not registered for this event."
        )

    # A team cannot play twice in the same round.
    existing_matches = Match.objects.filter(
        round_id=round_id
    ).filter(
        home_team_id__in=[
            home_team_id,
            away_team_id,
        ]
    ).filter(
        away_team_id__in=[
            home_team_id,
            away_team_id,
        ]
    )

    if existing_matches.exists():
        raise ValidationError(
            "One of these teams already has a match in this round."
        )


def add_team_to_event(event_id, team_id):
    return EventTeam.objects.get_or_create(
        event_id=event_id,
        team_id=team_id,
    )