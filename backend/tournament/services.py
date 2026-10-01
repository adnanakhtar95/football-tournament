from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Event, EventTeam, Match, MatchEvent, Team


def broadcast_match_update(match, event_type, event=None):
    channel_layer = get_channel_layer()

    data = {
        "type": "match_update",
        "event": event_type,
        "match_id": match.id,
        "status": match.status,
        "home_score": match.home_score,
        "away_score": match.away_score,
    }

    if event is not None:
        data["match_event"] = {
            "id": event.id,
            "type": event.type,
            "team_id": event.team_id,
            "player_name": event.player_name,
            "minute": event.minute,
            "points": event.points,
            "note": event.note,
        }

    async_to_sync(channel_layer.group_send)(
        f"match_{match.id}",
        {
            "type": "match_update",
            "data": data,
        },
    )


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

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_started",
        )
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

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_finished",
        )
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

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "goal_scored",
            event,
        )
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

    event = MatchEvent.objects.create(
        match=match,
        team_id=team_id,
        type=event_type,
        player_name=player_name,
        minute=minute,
        points=points,
        note=note,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_event",
            event,
        )
    )

    return event


def validate_match_teams(
    round_id,
    home_team_id,
    away_team_id,
    exclude_match_id=None,
):
    if home_team_id == away_team_id:
        raise ValidationError(
            "A team cannot play against itself."
        )

    from django.db.models import Q

    from .models import Round

    round_obj = Round.objects.get(pk=round_id)
    event_id = round_obj.event_id

    event_team_ids = set(
        EventTeam.objects
        .filter(event_id=event_id)
        .values_list("team_id", flat=True)
    )

    if home_team_id not in event_team_ids:
        raise ValidationError(
            "Home team is not registered for this event."
        )

    if away_team_id not in event_team_ids:
        raise ValidationError(
            "Away team is not registered for this event."
        )

    existing_matches = (
        Match.objects
        .filter(round_id=round_id)
        .filter(
            Q(home_team_id__in=[home_team_id, away_team_id])
            | Q(away_team_id__in=[home_team_id, away_team_id])
        )
    )

    if exclude_match_id is not None: 
        existing_matches = existing_matches.exclude(
            pk=exclude_match_id
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


def get_event_standings(event_id):
    teams = (
        Team.objects
        .filter(event_teams__event_id=event_id)
        .distinct()
    )

    standings = []

    for team in teams:
        matches = Match.objects.filter(
            round__event_id=event_id,
            status=Match.Status.FINISHED,
        ).filter(
            home_team=team
        ) | Match.objects.filter(
            round__event_id=event_id,
            status=Match.Status.FINISHED,
            away_team=team,
        )

        played = matches.count()

        wins = 0
        draws = 0
        losses = 0
        goals_for = 0
        goals_against = 0

        for match in matches:
            if match.home_team_id == team.id:
                goals_for += match.home_score
                goals_against += match.away_score

                if match.home_score > match.away_score:
                    wins += 1
                elif match.home_score == match.away_score:
                    draws += 1
                else:
                    losses += 1

            else:
                goals_for += match.away_score
                goals_against += match.home_score

                if match.away_score > match.home_score:
                    wins += 1
                elif match.away_score == match.home_score:
                    draws += 1
                else:
                    losses += 1

        reward_points = MatchEvent.objects.filter(
            match__in=matches,
            team_id=team.id,
            type=MatchEvent.EventType.REWARD,
        ).values_list(
            "points",
            flat=True,
        )

        reward_total = sum(reward_points)

        goal_difference = goals_for - goals_against
        points = (wins * 3) + draws + reward_total

        standings.append({
            "team_id": team.id,
            "team": team.name,
            "played": played,
            "won": wins,
            "drawn": draws,
            "lost": losses,
            "goals_for": goals_for,
            "goals_against": goals_against,
            "goal_difference": goal_difference,
            "reward_points": reward_total,
            "points": points,
        })

    standings.sort(
        key=lambda row: (
            -row["points"],
            -row["goal_difference"],
            -row["goals_for"],
            row["team"],
        )
    )

    return standings