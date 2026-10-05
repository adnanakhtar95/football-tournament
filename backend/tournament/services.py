from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Event, EventTeam, Match, MatchEvent, Player, Team



def broadcast_match_update(match, event_type, event=None):
    channel_layer = get_channel_layer()

    # data = {
    #     "type": "match_update",
    #     "event": event_type,
    #     "match_id": match.id,
    #     "status": match.status,
    #     "home_score": match.home_score,
    #     "away_score": match.away_score,
    # }
    
    data = {
        "type": "match_update",
        "event": event_type,
        "match_id": match.id,
        "status": match.status,
        "home_score": match.home_score,
        "away_score": match.away_score,

        # Advanced match controls
        "is_paused": match.is_paused,
        "paused_at": (
            match.paused_at.isoformat()
            if match.paused_at
            else None
        ),
        "total_paused_seconds": match.total_paused_seconds,
        "extra_time_minutes": match.extra_time_minutes,

        # Football match lifecycle
        "phase": match.phase,

        "clock_seconds": get_match_clock_seconds(match),

        "first_half_stoppage_minutes": (
            match.first_half_stoppage_minutes
        ),

        "second_half_stoppage_minutes": (
            match.second_half_stoppage_minutes
        ),

        "first_half_elapsed_seconds": (
            match.first_half_elapsed_seconds
        ),

        "first_half_ended_at": (
            match.first_half_ended_at.isoformat()
            if match.first_half_ended_at
            else None
        ),


      "second_half_started_at": (
    match.second_half_started_at.isoformat()
    if match.second_half_started_at
    else None
),

# Needed by the frontend to calculate second-half pause duration
"second_half_pause_baseline_seconds": (
    match.second_half_pause_baseline_seconds
),

"started_at": (
    match.started_at.isoformat()
    if match.started_at
    else None
),
        "ended_at": (
            match.ended_at.isoformat()
            if match.ended_at
            else None
        ),
    }


    if event is not None:
        data["match_event"] = {
            "id": event.id,
            "type": event.type,
            "team_id": event.team_id,
            "player_id": event.player_id,           
            "player_name": event.player_name,
            "minute": event.minute,
            "points": event.points,
            "note": event.note,
        }

    # 1. Broadcast to spectators watching this specific match.
    async_to_sync(channel_layer.group_send)(
        f"match_{match.id}",
        {
            "type": "match_update",
            "data": data,
        },
    )

    # 2. Broadcast to everyone watching the global live scoreboard.
    async_to_sync(channel_layer.group_send)(
        "live_scoreboard",
        {
            "type": "scoreboard_update",
            "data": data,
        },
    )


def get_match_clock_seconds(match, at_time=None):
    """
    Return football playing time in seconds.

    Half-time and temporary match suspensions
    are excluded from the playing clock.
    """
    now = at_time or timezone.now()

    if (
        match.status == Match.Status.SCHEDULED
        or not match.started_at
    ):
        return 0

    if match.phase == Match.Phase.HALF_TIME:
        return match.first_half_elapsed_seconds

    if match.phase == Match.Phase.FULL_TIME:
      return get_finished_clock_seconds(match)
    if match.phase == Match.Phase.FIRST_HALF:
        reference_time = (
            match.paused_at
            if match.is_paused and match.paused_at
            else now
        )

        elapsed = (
            reference_time - match.started_at
        ).total_seconds()

        return max(
            0,
            int(elapsed) - match.total_paused_seconds,
        )

    if match.phase in (
        Match.Phase.SECOND_HALF,
        Match.Phase.REGULATION_ENDED,
    ):
        if not match.second_half_started_at:
            return 45 * 60

        reference_time = (
            match.paused_at
            if match.is_paused and match.paused_at
            else now
        )

        elapsed = (
            reference_time - match.second_half_started_at
        ).total_seconds()

        second_half_pauses = max(
            0,
            match.total_paused_seconds
            - match.second_half_pause_baseline_seconds,
        )

        return (45 * 60) + max(
            0,
            int(elapsed) - second_half_pauses,
        )

    return 0


def get_finished_clock_seconds(match):
    """
    Calculate the frozen clock after the final whistle.
    """
    if not match.ended_at:
        return 0

    if not match.second_half_started_at:
        return match.first_half_elapsed_seconds

    elapsed = (
        match.ended_at - match.second_half_started_at
    ).total_seconds()

    second_half_pauses = max(
        0,
        match.total_paused_seconds
        - match.second_half_pause_baseline_seconds,
    )

    return (45 * 60) + max(
        0,
        int(elapsed) - second_half_pauses,
    )



def create_system_commentary(
    match,
    event_type,
    note="",
    at_time=None,
    minute_override=None,
):
    """
    Persist a match-wide commentary announcement.
    System events do not belong to either team.
    """

    if minute_override is not None:
        minute = minute_override
    else:
        elapsed_seconds = get_match_clock_seconds(
            match,
            at_time=at_time,
        )

        minute = elapsed_seconds // 60

    return MatchEvent.objects.create(
        match=match,
        team=None,
        player=None,
        type=event_type,
        player_name="",
        minute=minute,
        points=0,
        note=note,
    )

   

def validate_active_play(match):
    """
    Allow football actions only during an active playing half.
    """

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "This action requires a live match."
        )

    if match.phase not in (
        Match.Phase.FIRST_HALF,
        Match.Phase.SECOND_HALF,
    ):
        raise ValidationError(
            "Football actions are not allowed during "
            f"the {match.get_phase_display()} phase."
        )

    if match.is_paused:
        raise ValidationError(
            "The match is currently paused."
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
    match.phase = Match.Phase.FIRST_HALF
    match.started_at = timezone.now()


    match.save(
        update_fields=[
            "status",
             "phase",
            "started_at",
        ]
    )

    # transaction.on_commit(
    #     lambda: broadcast_match_update(
    #         match,
    #         "match_started",
    #     )
    # )
    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.MATCH_STARTED,
        note="The referee blows the whistle. Match kicked off!",
        at_time=match.started_at,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_started",
            commentary,
        )
    )

    return match


@transaction.atomic
def end_first_half(match_id):
    """
    End the first half and freeze the football clock.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can enter half-time."
        )

    if match.phase != Match.Phase.FIRST_HALF:
        raise ValidationError(
            "The match is not currently in its first half."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before ending the first half."
        )

    now = timezone.now()

    elapsed_seconds = get_match_clock_seconds(
        match,
        at_time=now,
    )

    match.first_half_elapsed_seconds = elapsed_seconds
    match.first_half_ended_at = now
    match.phase = Match.Phase.HALF_TIME

    match.save(
        update_fields=[
            "first_half_elapsed_seconds",
            "first_half_ended_at",
            "phase",
        ]
    )

    minute = elapsed_seconds // 60

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.HALF_TIME,
        note="The referee blows the half-time whistle.",
        minute_override=minute,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "half_time",
            commentary,
        )
    )

    return match


@transaction.atomic
def start_second_half(match_id):
    """
    Resume football from 45:00 after half-time.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can start the second half."
        )

    if match.phase != Match.Phase.HALF_TIME:
        raise ValidationError(
            "The match must be at half-time first."
        )

    now = timezone.now()

    match.phase = Match.Phase.SECOND_HALF
    match.second_half_started_at = now

    match.second_half_pause_baseline_seconds = (
        match.total_paused_seconds
    )
   # Clear the first half's legacy additional-time display.
   # The first-half stoppage field remains preserved.
    match.extra_time_minutes = 0
    match.save(
        update_fields=[
            "phase",
            "second_half_started_at",
            "second_half_pause_baseline_seconds",
            "extra_time_minutes",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.SECOND_HALF_STARTED,
        note="The referee starts the second half.",
        minute_override=45,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "second_half_started",
            commentary,
        )
    )

    return match



@transaction.atomic
def pause_match(match_id):
    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    
    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can be paused."
        )

    if match.phase not in (
        Match.Phase.FIRST_HALF,
        Match.Phase.SECOND_HALF,
    ):
        raise ValidationError(
            "Only an active playing half can be paused."
        )

    if match.is_paused:
       raise ValidationError(
        "This match is already paused."
    )
    match.is_paused = True
    match.paused_at = timezone.now()

    match.save(
        update_fields=[
            "is_paused",
            "paused_at",
        ]
    )
    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.MATCH_PAUSED,
        note="The match has been temporarily paused.",
        at_time=match.paused_at,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_paused",
            commentary,
        )
    )

    return match


@transaction.atomic
def resume_match(match_id):
    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can be resumed."
        )
   
    if match.phase not in (
        Match.Phase.FIRST_HALF,
        Match.Phase.SECOND_HALF,
    ):
        raise ValidationError(
            "Only a temporarily paused playing half "
            "can be resumed."
        )


    if not match.is_paused or match.paused_at is None:
        raise ValidationError(
            "This match is not currently paused."
        )

    now = timezone.now()

    paused_duration = max(
        0,
        int((now - match.paused_at).total_seconds()),
    )

    match.total_paused_seconds += paused_duration
    match.is_paused = False
    match.paused_at = None

    match.save(
        update_fields=[
            "total_paused_seconds",
            "is_paused",
            "paused_at",
        ]
    )

    # transaction.on_commit(
    #     lambda: broadcast_match_update(
    #         match,
    #         "match_resumed",
    #     )
    # )
    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.MATCH_RESUMED,
        note="The referee signals for play to resume.",
        at_time=now,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_resumed",
            commentary,
        )
    )

    return match


@transaction.atomic
def set_extra_time(match_id, minutes):
    """
    Set stoppage time for the currently active half.

    This is football stoppage time (+2, +4, etc.),
    NOT knockout extra time (the additional 30 minutes).
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Additional time can only be configured for live matches."
        )

    if match.phase not in (
        Match.Phase.FIRST_HALF,
        Match.Phase.SECOND_HALF,
    ):
        raise ValidationError(
            "Additional time can only be configured "
            "during an active playing half."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before changing additional time."
        )

    if isinstance(minutes, bool):
        raise ValidationError(
            "Additional time must be a valid integer."
        )

    try:
        minutes = int(minutes)
    except (TypeError, ValueError, OverflowError):
        raise ValidationError(
            "Additional time must be a valid integer."
        )

    if minutes < 0 or minutes > 30:
        raise ValidationError(
            "Additional time must be between 0 and 30 minutes."
        )

    # Determine which half receives the stoppage time.
    if match.phase == Match.Phase.FIRST_HALF:
        stoppage_field = "first_half_stoppage_minutes"
        half_name = "first half"
    else:
        stoppage_field = "second_half_stoppage_minutes"
        half_name = "second half"

    current_minutes = getattr(match, stoppage_field)

    # Avoid duplicate announcements.
    if current_minutes == minutes:
        return match

    # Update the correct half.
    setattr(match, stoppage_field, minutes)

    # Preserve the original field for backward compatibility
    # with existing Admin/scoreboard components.
    match.extra_time_minutes = minutes

    match.save(
        update_fields=[
            stoppage_field,
            "extra_time_minutes",
        ]
    )

    if minutes == 0:
        note = (
            f"Previously announced {half_name} "
            "additional time has been cancelled."
        )
    else:
        note = (
            f"+{minutes} minutes of additional time "
            f"announced for the {half_name}."
        )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.EXTRA_TIME,
        note=note,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "extra_time_updated",
            commentary,
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

    # Only live matches can be finished.
    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can be finished."
        )

    # NeW Prevent finishing a paused match.
    if match.is_paused:
        raise ValidationError(
            "Resume the match before finishing it."
        )


    if match.phase not in (
        Match.Phase.SECOND_HALF,
        Match.Phase.REGULATION_ENDED,
    ):
        raise ValidationError(
            "The match cannot be finished before "
            "the second half."
        )


    # Finish the match.
    match.status = Match.Status.FINISHED
    match.phase = Match.Phase.FULL_TIME
    match.ended_at = timezone.now()

    match.save(
        update_fields=[
            "status",
            "phase",
            "ended_at",
        ]
    )

    # Notify connected WebSocket clients.
    # transaction.on_commit(
    #     lambda: broadcast_match_update(
    #         match,
    #         "match_finished",
    #     )
    # )
    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.MATCH_FINISHED,
        note="The referee blows the final whistle. Full time!",
        at_time=match.ended_at,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "match_finished",
            commentary,
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
    player_id=None,
):
    match = (
        Match.objects
        .select_for_update()
        .select_related("home_team", "away_team")
        .get(pk=match_id)
    )

    # if match.status != Match.Status.LIVE:
    #     raise ValidationError(
    #         "Goals can only be recorded for live matches."
    #     )

    # # NEW: Prevent recording goals while the match is paused.
    # if match.is_paused:
    #     raise ValidationError(
    #         "Goals cannot be recorded while the match is paused."
    #     )
    validate_active_play(match)
    minute = get_match_clock_seconds(match) // 60
    try:
        team_id = int(team_id)
        minute = int(minute)
    except (TypeError, ValueError):
        raise ValidationError(
            "Team ID and minute must be valid integers."
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

    player = None

    if player_id not in (None, ""):
        try:
            player_id = int(player_id)
        except (TypeError, ValueError):
            raise ValidationError(
                "Player ID must be a valid integer."
            )

        try:
            player = Player.objects.get(pk=player_id)
        except Player.DoesNotExist:
            raise ValidationError(
                "The selected player does not exist."
            )

        if player.team_id != team_id:
            raise ValidationError(
                "The selected player does not belong "
                "to the scoring team."
            )

        if not player.is_active:
            raise ValidationError(
                "Cannot record a new goal for an inactive player."
            )

        # Always use the registered player's name when supplied.
        player_name = player.full_name

    event = MatchEvent.objects.create(
        match=match,
        team_id=team_id,
        player=player,
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
    player_id=None,
):
    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )
    
    validate_active_play(match)
    minute = get_match_clock_seconds(match) // 60
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