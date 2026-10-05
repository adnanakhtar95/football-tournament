from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Event, EventTeam, Match, MatchEvent,PenaltyShootoutKick, Player, Team




def broadcast_match_update(match, event_type, event=None):
    """
    Broadcast match updates to:

    1. Individual match spectators
    2. Global live scoreboard

    Supports:
    - Normal football matches
    - Knockout matches
    - Extra time (90–120 minutes)
    - Penalty shootouts
    """

    channel_layer = get_channel_layer()

    # -----------------------------------------
    # BASE MATCH DATA
    # -----------------------------------------

    data = {
        "type": "match_update",
        "event": event_type,
        "match_id": match.id,

        "status": match.status,
        "phase": match.phase,

        "home_score": match.home_score,
        "away_score": match.away_score,

        # Knockout identification
        "is_knockout": match.is_knockout,

        # -------------------------------------
        # AUTHORITATIVE FOOTBALL CLOCK
        # -------------------------------------

        "clock_seconds": get_match_clock_seconds(match),

        "regulation_elapsed_seconds": (
            match.regulation_elapsed_seconds
        ),

        # -------------------------------------
        # EXISTING ADVANCED MATCH CONTROLS
        # -------------------------------------

        "is_paused": match.is_paused,

        "paused_at": (
            match.paused_at.isoformat()
            if match.paused_at
            else None
        ),

        "total_paused_seconds": (
            match.total_paused_seconds
        ),

        # Existing stoppage-time functionality
        "extra_time_minutes": match.extra_time_minutes,

        "first_half_stoppage_minutes": (
            match.first_half_stoppage_minutes
        ),

        "second_half_stoppage_minutes": (
            match.second_half_stoppage_minutes
        ),

        # -------------------------------------
        # NORMAL FOOTBALL LIFECYCLE
        # -------------------------------------

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

        "second_half_pause_baseline_seconds": (
            match.second_half_pause_baseline_seconds
        ),

        # -------------------------------------
        # KNOCKOUT EXTRA-TIME LIFECYCLE
        # -------------------------------------

        "extra_time_first_half_started_at": (
            match.extra_time_first_half_started_at.isoformat()
            if match.extra_time_first_half_started_at
            else None
        ),

        "extra_time_first_half_elapsed_seconds": (
            match.extra_time_first_half_elapsed_seconds
        ),

        "extra_time_first_half_ended_at": (
            match.extra_time_first_half_ended_at.isoformat()
            if match.extra_time_first_half_ended_at
            else None
        ),

        "extra_time_pause_baseline_seconds": (
            match.extra_time_pause_baseline_seconds
        ),

        "extra_time_second_half_started_at": (
            match.extra_time_second_half_started_at.isoformat()
            if match.extra_time_second_half_started_at
            else None
        ),

        "extra_time_second_half_pause_baseline_seconds": (
            match.extra_time_second_half_pause_baseline_seconds
        ),

        "extra_time_elapsed_seconds": (
            match.extra_time_elapsed_seconds
        ),

       
        # MATCH TIMESTAMPS
        

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

    # =========================================
    # PENALTY SHOOTOUT INFORMATION
    # =========================================

    if match.is_knockout:

        # Calculate the current shootout score,
        # winner and next shooting team.
        shootout_state = get_shootout_state(match)

        data["shootout"] = shootout_state

        # Include individual penalty attempts.
        kicks = (
            PenaltyShootoutKick.objects
            .filter(match=match)
            .order_by("created_at", "id")
        )

        data["shootout_kicks"] = [
            {
                "id": kick.id,
                "team_id": kick.team_id,
                "player_id": kick.player_id,
                "player_name": kick.player_name,
                "kick_number": kick.kick_number,
                "scored": kick.scored,
                "created_at": kick.created_at.isoformat(),
            }
            for kick in kicks
        ]

    else:

        # Consistent payload for normal matches.
        data["shootout"] = None
        data["shootout_kicks"] = []

    # =========================================
    # OPTIONAL MATCH COMMENTARY EVENT
    # =========================================

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

    # =========================================
    # CHANNEL LAYER SAFETY
    # =========================================

    if channel_layer is None:
        return

    
    # 1. INDIVIDUAL MATCH BROADCAST
   

    async_to_sync(channel_layer.group_send)(
        f"match_{match.id}",
        {
            "type": "match_update",
            "data": data,
        },
    )

    # =========================================
    # 2. GLOBAL LIVE SCOREBOARD BROADCAST
    # =========================================

    async_to_sync(channel_layer.group_send)(
        "live_scoreboard",
        {
            "type": "scoreboard_update",
            "data": data,
        },
    )


def get_match_clock_seconds(match, at_time=None):
    """
    Return the football playing clock in seconds.

    Regulation:
        First half: 0:00 onwards
        Half-time: frozen
        Second half: 45:00 onwards
        Regulation ended: frozen

    Knockout:
        ET first half: 90:00 onwards
        ET interval: frozen
        ET second half: 105:00 onwards
        Penalty shootout: frozen
    """

    now = at_time or timezone.now()

    if (
        match.status == Match.Status.SCHEDULED
        or not match.started_at
    ):
        return 0

    if match.phase == Match.Phase.FULL_TIME:
        return get_finished_clock_seconds(match)

    
    # REGULATION FIRST HALF
 

    if match.phase == Match.Phase.FIRST_HALF:
        reference_time = (
            match.paused_at
            if match.is_paused and match.paused_at
            else now
        )

        elapsed = int(
            (reference_time - match.started_at).total_seconds()
        )

        return max(
            0,
            elapsed - match.total_paused_seconds
        )

   
    # REGULATION HALF-TIME
   

    if match.phase == Match.Phase.HALF_TIME:
        return match.first_half_elapsed_seconds

    
    # REGULATION SECOND HALF
   

    if match.phase == Match.Phase.SECOND_HALF:
        if not match.second_half_started_at:
            return 45 * 60

        reference_time = (
            match.paused_at
            if match.is_paused and match.paused_at
            else now
        )

        elapsed = int(
            (
                reference_time - match.second_half_started_at
            ).total_seconds()
        )

        paused_seconds = max(
            0,
            match.total_paused_seconds
            - match.second_half_pause_baseline_seconds
        )

        return (45 * 60) + max(
            0,
            elapsed - paused_seconds
        )

   
    # REGULATION ENDED
    

    if match.phase == Match.Phase.REGULATION_ENDED:
        return match.regulation_elapsed_seconds


    # EXTRA TIME - FIRST HALF
   

    if match.phase == Match.Phase.EXTRA_TIME_FIRST_HALF:
        if not match.extra_time_first_half_started_at:
            return 90 * 60

        reference_time = (
            match.paused_at
            if match.is_paused and match.paused_at
            else now
        )

        elapsed = int(
            (
                reference_time
                - match.extra_time_first_half_started_at
            ).total_seconds()
        )

        paused_seconds = max(
            0,
            match.total_paused_seconds
            - match.extra_time_pause_baseline_seconds
        )

        return (90 * 60) + max(
            0,
            elapsed - paused_seconds
        )

    
    # EXTRA TIME INTERVAL
    

    if match.phase == Match.Phase.EXTRA_TIME_INTERVAL:
        return (
            (90 * 60)
            + match.extra_time_first_half_elapsed_seconds
        )

    
    # EXTRA TIME - SECOND HALF
   

    if match.phase == Match.Phase.EXTRA_TIME_SECOND_HALF:
        if not match.extra_time_second_half_started_at:
            return 105 * 60

        reference_time = (
            match.paused_at
            if match.is_paused and match.paused_at
            else now
        )

        elapsed = int(
            (
                reference_time
                - match.extra_time_second_half_started_at
            ).total_seconds()
        )

        paused_seconds = max(
            0,
            match.total_paused_seconds
            - match.extra_time_second_half_pause_baseline_seconds
        )

        return (105 * 60) + max(
            0,
            elapsed - paused_seconds
        )

    
    # PENALTY SHOOTOUT
    

    if match.phase == Match.Phase.PENALTY_SHOOTOUT:
        return match.extra_time_elapsed_seconds

    return 0


def get_finished_clock_seconds(match):
    """
    Return the authoritative frozen clock after the final whistle.

    Normal/group-stage:
        Uses the regulation snapshot saved by finish_match().
        Minimum official full-time clock is 90:00.

    Knockout:
        Regulation finish uses regulation snapshot.
        Extra-time / penalties use extra-time snapshot.
    """

    if not match.ended_at:
        return 0

    
    # MATCH COMPLETED AFTER EXTRA TIME
    
    if match.extra_time_second_half_started_at:

        if match.extra_time_elapsed_seconds > 0:
            return max(
                match.extra_time_elapsed_seconds,
                120 * 60,
            )

        # Safety fallback if an ET snapshot was not saved.
        elapsed = int(
            (
                match.ended_at
                - match.extra_time_second_half_started_at
            ).total_seconds()
        )

        paused_seconds = max(
            0,
            match.total_paused_seconds
            - match.extra_time_second_half_pause_baseline_seconds
        )

        return max(
            (105 * 60) + max(
                0,
                elapsed - paused_seconds
            ),
            120 * 60,
        )

    
    # KNOCKOUT FINISHED IN REGULATION
    

    if match.is_knockout:
        return max(
            match.regulation_elapsed_seconds,
            90 * 60,
        )

    
    # NORMAL / GROUP-STAGE MATCH
   
    return max(
        match.regulation_elapsed_seconds,
        90 * 60,
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
    Allow football actions only during an active
    regulation or knockout extra-time playing half.
    """

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "This action requires a live match."
        )

    allowed_phases = (
        Match.Phase.FIRST_HALF,
        Match.Phase.SECOND_HALF,
        Match.Phase.EXTRA_TIME_FIRST_HALF,
        Match.Phase.EXTRA_TIME_SECOND_HALF,
    )

    if match.phase not in allowed_phases:
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
def end_regulation(match_id):
    """
    End regulation time and freeze the clock.

    This does not finish the match.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can end regulation."
        )

    if match.phase != Match.Phase.SECOND_HALF:
        raise ValidationError(
            "Regulation can only end during the second half."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before ending regulation."
        )

    now = timezone.now()

    # Capture the actual playing time before changing phase.
    elapsed_seconds = get_match_clock_seconds(
        match,
        at_time=now,
    )

    match.regulation_elapsed_seconds = elapsed_seconds
    match.phase = Match.Phase.REGULATION_ENDED
    match.extra_time_minutes = 0

    match.save(
        update_fields=[
            "regulation_elapsed_seconds",
            "phase",
            "extra_time_minutes",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.REGULATION_ENDED,
        note="The referee blows the whistle. Regulation time has ended.",
        minute_override=elapsed_seconds // 60,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "regulation_ended",
            commentary,
        )
    )

    return match


@transaction.atomic
def start_extra_time(match_id):
    """
    Start the first 15-minute extra-time half.

    Allowed only for tied knockout matches
    after regulation has ended.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can start extra time."
        )

    if not match.is_knockout:
        raise ValidationError(
            "Extra time is only available for knockout matches."
        )

    if match.phase != Match.Phase.REGULATION_ENDED:
        raise ValidationError(
            "Regulation must end before extra time can start."
        )

    if match.home_score != match.away_score:
        raise ValidationError(
            "Extra time is only required when the score is tied."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before starting extra time."
        )

    now = timezone.now()

    match.phase = Match.Phase.EXTRA_TIME_FIRST_HALF

    match.extra_time_first_half_started_at = now

    # Record the existing pause duration so that earlier
    # regulation pauses do not affect the extra-time clock.
    match.extra_time_pause_baseline_seconds = (
        match.total_paused_seconds
    )

    match.extra_time_first_half_elapsed_seconds = 0
    match.extra_time_elapsed_seconds = 0
    match.extra_time_minutes = 0

    match.save(
        update_fields=[
            "phase",
            "extra_time_first_half_started_at",
            "extra_time_pause_baseline_seconds",
            "extra_time_first_half_elapsed_seconds",
            "extra_time_elapsed_seconds",
            "extra_time_minutes",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.EXTRA_TIME_STARTED,
        note="Extra time begins. The first 15-minute half is underway.",
        minute_override=90,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "extra_time_started",
            commentary,
        )
    )

    return match


@transaction.atomic
def end_extra_time_first_half(match_id):
    """
    End the first 15-minute extra-time half
    and freeze the match clock.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can enter the extra-time interval."
        )

    if match.phase != Match.Phase.EXTRA_TIME_FIRST_HALF:
        raise ValidationError(
            "The match is not in the first extra-time half."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before ending this half."
        )

    now = timezone.now()

    # Capture the current match clock before changing phase.
    elapsed_seconds = get_match_clock_seconds(
        match,
        at_time=now,
    )
    # Extra-time first half officially reaches at least 105:00.
# This also allows fast admin/testing without waiting 15 real minutes.
    elapsed_seconds = max(
       elapsed_seconds,
       105 * 60,
     )

    # Store elapsed time within the first extra-time half.
    match.extra_time_first_half_elapsed_seconds = max(
        0,
        elapsed_seconds - (90 * 60)
    )

    match.extra_time_first_half_ended_at = now
    match.phase = Match.Phase.EXTRA_TIME_INTERVAL

    match.save(
        update_fields=[
            "extra_time_first_half_elapsed_seconds",
            "extra_time_first_half_ended_at",
            "phase",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.EXTRA_TIME_HALF_TIME,
        note="The first extra-time half has ended.",
        minute_override=elapsed_seconds // 60,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "extra_time_half_time",
            commentary,
        )
    )

    return match

@transaction.atomic
def start_extra_time_second_half(match_id):
    """
    Start the second 15-minute extra-time half.

    The match clock resumes from 105:00,
    excluding previous pauses and the ET interval.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can start the second extra-time half."
        )

    if not match.is_knockout:
        raise ValidationError(
            "Extra time is only available for knockout matches."
        )

    if match.phase != Match.Phase.EXTRA_TIME_INTERVAL:
        raise ValidationError(
            "The match must be at the extra-time interval first."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before starting the second extra-time half."
        )

    now = timezone.now()

    # Start the second ET half.
    match.phase = Match.Phase.EXTRA_TIME_SECOND_HALF
    match.extra_time_second_half_started_at = now

    # Exclude pauses accumulated during regulation
    # and the first extra-time half.
    match.extra_time_second_half_pause_baseline_seconds = (
        match.total_paused_seconds
    )

    match.extra_time_minutes = 0

    match.save(
        update_fields=[
            "phase",
            "extra_time_second_half_started_at",
            "extra_time_second_half_pause_baseline_seconds",
            "extra_time_minutes",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.EXTRA_TIME_SECOND_HALF_STARTED,
        note="The second extra-time half begins. Fifteen minutes remain.",
        minute_override=105,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            "extra_time_second_half_started",
            commentary,
        )
    )

    return match

@transaction.atomic
def end_extra_time(match_id):
    """
    End the second extra-time half.

    If scores are tied:
        Move to penalty shootout.

    If a team is leading:
        Finish the knockout match.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can end extra time."
        )

    if not match.is_knockout:
        raise ValidationError(
            "Extra time is only available for knockout matches."
        )

    if match.phase != Match.Phase.EXTRA_TIME_SECOND_HALF:
        raise ValidationError(
            "The match must be in the second extra-time half."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before ending extra time."
        )

    now = timezone.now()

    # Capture the final playing time BEFORE changing phase.
    elapsed_seconds = get_match_clock_seconds(
        match,
        at_time=now,
    )
    elapsed_seconds = max(
      elapsed_seconds,
      120 * 60,
     )
    # Preserve the final extra-time clock.
    match.extra_time_elapsed_seconds = elapsed_seconds
    match.extra_time_minutes = 0

    if match.home_score == match.away_score:

        # Still tied after 120 minutes.
        # The penalty shootout will decide the winner.
        match.phase = Match.Phase.PENALTY_SHOOTOUT

        event_type = (
            MatchEvent.EventType.PENALTY_SHOOTOUT_STARTED
        )

        broadcast_type = "penalty_shootout_started"

        note = (
            "Extra time has ended with the scores level. "
            "The match will be decided by a penalty shootout."
        )

    else:

        # A team is leading after extra time.
        # The knockout match has a winner.
        match.status = Match.Status.FINISHED
        match.phase = Match.Phase.FULL_TIME
        match.ended_at = now

        event_type = MatchEvent.EventType.EXTRA_TIME_ENDED

        broadcast_type = "extra_time_ended"

        note = (
            "Extra time has ended. "
            "The referee blows the final whistle."
        )

    match.save(
        update_fields=[
            "extra_time_elapsed_seconds",
            "extra_time_minutes",
            "status",
            "phase",
            "ended_at",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=event_type,
        note=note,
        minute_override=elapsed_seconds // 60,
    )

    transaction.on_commit(
        lambda: broadcast_match_update(
            match,
            broadcast_type,
            commentary,
        )
    )

    return match


def get_shootout_state(match):
    """
    Calculate penalty shootout scores, progress,
    and whether a winner has been decided.

    Supports:
    - Initial five kicks per team
    - Early mathematical victory
    - Sudden death
    """

    kicks = list(
        PenaltyShootoutKick.objects
        .filter(match=match)
        .order_by("created_at", "id")
    )

    home_kicks = [
        kick for kick in kicks
        if kick.team_id == match.home_team_id
    ]

    away_kicks = [
        kick for kick in kicks
        if kick.team_id == match.away_team_id
    ]

    home_taken = len(home_kicks)
    away_taken = len(away_kicks)

    home_score = sum(
        1 for kick in home_kicks if kick.scored
    )

    away_score = sum(
        1 for kick in away_kicks if kick.scored
    )

    winner_id = None

    # Initial five kicks:
    # Check whether either team has an unreachable lead.
    if home_taken <= 5 and away_taken <= 5:

        home_remaining = 5 - home_taken
        away_remaining = 5 - away_taken

        if home_score > away_score + away_remaining:
            winner_id = match.home_team_id

        elif away_score > home_score + home_remaining:
            winner_id = match.away_team_id

    # Sudden death:
    # A winner exists only after both teams have taken
    # the same number of kicks beyond the initial five.
    if (
        winner_id is None
        and home_taken >= 5
        and away_taken >= 5
        and home_taken == away_taken
    ):
        if home_score > away_score:
            winner_id = match.home_team_id

        elif away_score > home_score:
            winner_id = match.away_team_id

    # Home team shoots first.
    # Kick order: Home 1, Away 1, Home 2, Away 2...
    next_team_id = (
        match.home_team_id
        if len(kicks) % 2 == 0
        else match.away_team_id
    )

    return {
        "home_score": home_score,
        "away_score": away_score,
        "home_taken": home_taken,
        "away_taken": away_taken,
        "winner_id": winner_id,
        "is_finished": winner_id is not None,
        "next_team_id": (
            None if winner_id is not None else next_team_id
        ),
    }


@transaction.atomic
def record_shootout_kick(
    match_id,
    team_id,
    scored,
    player_id=None,
    player_name="",
):
    """
    Record an individual penalty shootout attempt.

    Rules:
    - Match must be in PENALTY_SHOOTOUT phase.
    - Home team takes the first penalty.
    - Teams alternate after every attempt.
    - Maximum five initial kicks per team.
    - Sudden death continues if required.
    - Match automatically finishes when a winner exists.
    """

    match = (
        Match.objects
        .select_for_update()
        .get(pk=match_id)
    )

    if match.status != Match.Status.LIVE:
        raise ValidationError(
            "Only live matches can record penalty kicks."
        )

    if not match.is_knockout:
        raise ValidationError(
            "Penalty shootouts are only available for knockout matches."
        )

    if match.phase != Match.Phase.PENALTY_SHOOTOUT:
        raise ValidationError(
            "The match is not in the penalty shootout phase."
        )

    if match.is_paused:
        raise ValidationError(
            "Resume the match before recording a penalty."
        )

    # -----------------------------------
    # VALIDATE INPUT
    # -----------------------------------

    try:
        team_id = int(team_id)
    except (TypeError, ValueError):
        raise ValidationError(
            "A valid team ID is required."
        )

    if type(scored) is not bool:
        raise ValidationError(
            "scored must be a boolean (true or false)."
        )

    if team_id not in (
        match.home_team_id,
        match.away_team_id,
    ):
        raise ValidationError(
            "The selected team does not belong to this match."
        )

    # -----------------------------------
    # GET CURRENT SHOOTOUT STATE
    # -----------------------------------

    state = get_shootout_state(match)

    if state["is_finished"]:
        raise ValidationError(
            "The penalty shootout has already finished."
        )

    if team_id != state["next_team_id"]:
        raise ValidationError(
            "It is not this team's turn to take a penalty."
        )

    is_home_team = (
        team_id == match.home_team_id
    )

    kick_number = (
        state["home_taken"] + 1
        if is_home_team
        else state["away_taken"] + 1
    )

    # -----------------------------------
    # OPTIONAL PLAYER VALIDATION
    # -----------------------------------

    player = None

    if player_id is not None:

        try:
            player_id = int(player_id)
        except (TypeError, ValueError):
            raise ValidationError(
                "A valid player ID is required."
            )

        player = Player.objects.filter(
            pk=player_id,
        ).first()

        if player is None:
            raise ValidationError(
                "The selected player does not exist."
            )

        # Note: Player/team membership validation can
        # be added here using your existing roster
        # relationship once we connect the API.

    # -----------------------------------
    # CREATE THE PENALTY RECORD
    # -----------------------------------

    kick = PenaltyShootoutKick.objects.create(
        match=match,
        team_id=team_id,
        player=player,
        player_name=player_name or "",
        kick_number=kick_number,
        scored=scored,
    )

    # Recalculate after saving the new kick.
    updated_state = get_shootout_state(match)

    result = "scored" if scored else "missed"

    commentary = create_system_commentary(
        match=match,
        event_type=(
            MatchEvent.EventType.PENALTY_KICK
        ),
        note=(
            f"Penalty shootout: Team {team_id} "
            f"{result} kick {kick_number}. "
            f"Score: "
            f"{updated_state['home_score']}-"
            f"{updated_state['away_score']}."
        ),
        minute_override=120,
    )

    # -----------------------------------
    # AUTOMATIC WINNER DETECTION
    # -----------------------------------

    if updated_state["is_finished"]:

        winner_id = updated_state["winner_id"]

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

        final_commentary = create_system_commentary(
            match=match,
            event_type=(
                MatchEvent.EventType.PENALTY_SHOOTOUT_FINISHED
            ),
            note=(
                f"Penalty shootout finished. "
                f"Team {winner_id} wins "
                f"{updated_state['home_score']}-"
                f"{updated_state['away_score']} on penalties."
            ),
            minute_override=120,
        )

        transaction.on_commit(
            lambda: broadcast_match_update(
                match,
                "penalty_shootout_finished",
                final_commentary,
            )
        )

    else:

        transaction.on_commit(
            lambda: broadcast_match_update(
                match,
                "penalty_shootout_kick",
                commentary,
            )
        )

    return {
        "kick": kick,
        "shootout": updated_state,
        "match": match,
    }



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
        Match.Phase.EXTRA_TIME_FIRST_HALF,
        Match.Phase.EXTRA_TIME_SECOND_HALF,
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
        Match.Phase.EXTRA_TIME_FIRST_HALF,
        Match.Phase.EXTRA_TIME_SECOND_HALF,
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
    """
    Finish a match safely.

    Normal match:
        Can finish during the second half
        or after regulation ends.

    Knockout match:
        Must end regulation first.
        Cannot finish with tied scores.
        Tied matches must proceed through extra time
        and, if necessary, penalty shootouts.

    Matches completed by end_extra_time() are
    already marked FINISHED and must not be finished again.
    """

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

    if match.is_paused:
        raise ValidationError(
            "Resume the match before finishing it."
        )

    # -----------------------------------
    # NORMAL MATCH
    # -----------------------------------

    if not match.is_knockout:

        if match.phase not in (
            Match.Phase.SECOND_HALF,
            Match.Phase.REGULATION_ENDED,
        ):
            raise ValidationError(
                "A normal match can only finish during "
                "the second half or after regulation."
            )

    # -----------------------------------
    # KNOCKOUT MATCH
    # -----------------------------------

    else:

        if match.phase != Match.Phase.REGULATION_ENDED:
            raise ValidationError(
                "A knockout match must end regulation "
                "before it can be finished."
            )

        if match.home_score == match.away_score:
            raise ValidationError(
                "The knockout match is tied. "
                "Start extra time instead."
            )

    now = timezone.now()

    # Capture the clock BEFORE switching to FULL_TIME.
    # This prevents the clock from continuing after the whistle.
    final_clock = get_match_clock_seconds(
        match,
        at_time=now,
    )
    if not match.is_knockout:
        final_clock = max(final_clock, 90 * 60)

    



    # Save the regulation clock snapshot.
    match.regulation_elapsed_seconds = final_clock

    match.status = Match.Status.FINISHED
    match.phase = Match.Phase.FULL_TIME
    match.ended_at = now

    match.save(
        update_fields=[
            "regulation_elapsed_seconds",
            "status",
            "phase",
            "ended_at",
        ]
    )

    commentary = create_system_commentary(
        match=match,
        event_type=MatchEvent.EventType.MATCH_FINISHED,
        note="The referee blows the final whistle. Full time!",
        minute_override=final_clock // 60,
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

   
    
    validate_active_play(match)

    # Always use the server-calculated match minute.
    minute = get_match_clock_seconds(match) // 60

    try:
        team_id = int(team_id)
    except (TypeError, ValueError, OverflowError):
        raise ValidationError(
            "Team ID must be a valid integer."
        )

    if team_id not in (
        match.home_team_id,
        match.away_team_id,
    ):
        raise ValidationError(
            "The selected team is not playing in this match."
        )
    
    if minute < 0:
      raise ValidationError(
        "Match minute cannot be negative."
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

    try:
        team_id = int(team_id)
    except (TypeError, ValueError, OverflowError):
        raise ValidationError(
            "Team ID must be a valid integer."
        )


    if team_id not in (
        match.home_team_id,
        match.away_team_id,
    ):
        raise ValidationError(
            "The selected team is not playing in this match."
        )

    valid_types = {
        MatchEvent.EventType.FOUL,
        MatchEvent.EventType.CHANCE,
        MatchEvent.EventType.SAVE,
        MatchEvent.EventType.YELLOW_CARD,
        MatchEvent.EventType.RED_CARD,
        MatchEvent.EventType.PENALTY_KICK,
        MatchEvent.EventType.REWARD,
    }

    if event_type not in valid_types:
        raise ValidationError(
            "Unsupported match event type."
        )

    if minute < 0:
       raise ValidationError(
         "Match minute cannot be negative."
    )

    # Resolve and validate an optional registered player.
    player = None

    if player_id not in (None, ""):
        try:
            player_id = int(player_id)
        except (TypeError, ValueError, OverflowError):
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
                "The selected player does not belong to the selected team."
            )

        if not player.is_active:
            raise ValidationError(
                "Cannot record an event for an inactive player."
            )

        # Always use the registered player's official name.
        player_name = player.full_name

    event = MatchEvent.objects.create(
        match=match,
        team_id=team_id,
        player=player,
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
            is_knockout=False,
        ).filter(
            home_team=team
        ) | Match.objects.filter(
            round__event_id=event_id,
            status=Match.Status.FINISHED,
            away_team=team,
            is_knockout=False,
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