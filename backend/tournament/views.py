from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from django.contrib.auth import authenticate, login , logout
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.db.models import Count ,Q

from .models import (
    Event,
    EventTeam,
    Match,
    MatchEvent,
    Player,
    Round,
    Team,
)
from .serializers import (
    AdminEventSerializer,
    AdminEventTeamSerializer,
    AdminMatchSerializer,
    AdminPlayerSerializer,
    AdminRoundSerializer,
    AdminTeamSerializer,
    EventSerializer,
    MatchEventSerializer,
    MatchSerializer,
    PlayerSerializer,
    TeamSerializer,
)

from .services import (
    end_first_half,
    finish_match,
    get_event_standings,
    pause_match,
    record_goal,
    record_match_event,
    resume_match,
    set_extra_time,
    start_match,
    start_second_half,
)



class StandardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class EventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Event.objects
        .prefetch_related(
            "event_teams__team",
            "rounds__matches__home_team",
            "rounds__matches__away_team",
        )
        .all()
    )

    serializer_class = EventSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

    @action(
        detail=True,
        methods=["get"],
        url_path="standings",
    )
    def standings(self, request, pk=None):
        event = get_object_or_404(
            Event,
            pk=pk,
        )

        standings = get_event_standings(event.id)

        return Response(standings)
    
    @action(
        detail=True,
        methods=["get"],
        url_path="top-scorers",
    )
    def top_scorers(self, request, pk=None):
        """
        Return the top goal scorers for a tournament.

        Only goal events associated with registered Player
        records are included.
        """

        event = get_object_or_404(Event, pk=pk)

        scorers = (
            MatchEvent.objects
            .filter(
                match__round__event=event,
                type=MatchEvent.EventType.GOAL,
                player__isnull=False,
            )
            .values(
                "player_id",
                "player__full_name",
                "player__jersey_number",
                "player__team_id",
                "player__team__name",
                "player__team__code",
            )
            .annotate(goals=Count("id"))
            .order_by("-goals", "player__full_name", "player_id")
        )

        return Response([
            {
                "player_id": scorer["player_id"],
                "player_name": scorer["player__full_name"],
                "jersey_number": scorer["player__jersey_number"],
                "team_id": scorer["player__team_id"],
                "team_name": scorer["player__team__name"],
                "team_code": scorer["player__team__code"],
                "goals": scorer["goals"],
            }
            for scorer in scorers
        ])


    
class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination


class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public endpoint for registered players.

    Existing:
        GET /api/players/
        GET /api/players/?team=5
        GET /api/players/{id}/

    New:
        GET /api/players/{id}/profile/
    """

    serializer_class = PlayerSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Player.objects.select_related("team").all()

        team_id = self.request.query_params.get("team")

        if team_id:
            queryset = queryset.filter(team_id=team_id)

        return queryset

    @action(
        detail=True,
        methods=["get"],
        url_path="profile",
    )
    def profile(self, request, pk=None):
        """
        Return a registered player's public profile,
        goal statistics and recorded goal history.

        Only goal events associated with the Player FK
        are included in individual goal statistics.
        """

        player = get_object_or_404(
            Player.objects.select_related("team"),
            pk=pk,
        )

        # All registered goal events belonging to this player.
        goal_events = (
            MatchEvent.objects
            .filter(
                player=player,
                type=MatchEvent.EventType.GOAL,
            )
            .select_related(
                "match__round__event",
                "match__home_team",
                "match__away_team",
                "team",
            )
            .order_by(
                "-match__scheduled_at",
                "-minute",
                "-id",
            )
        )

        # Calculate the player's statistics.
        total_goals = goal_events.count()

        matches_scored_in = (
            goal_events
            .values("match_id")
            .distinct()
            .count()
        )

        # Count appearances based on recorded player-linked
        # match events. This is NOT a full lineup-based
        # appearance count.
        recorded_matches = (
            MatchEvent.objects
            .filter(player=player)
            .values("match_id")
            .distinct()
            .count()
        )

        # Group goals by tournament.
        tournament_stats = (
            goal_events
            .values(
                "match__round__event_id",
                "match__round__event__name",
            )
            .annotate(goals=Count("id"))
            .order_by(
                "-goals",
                "match__round__event__name",
            )
        )

        tournaments = [
            {
                "event_id": item[
                    "match__round__event_id"
                ],
                "event_name": item[
                    "match__round__event__name"
                ],
                "goals": item["goals"],
            }
            for item in tournament_stats
        ]

        # Build the goal history.
        goal_history = []

        for goal in goal_events:
            match = goal.match

            goal_history.append({
                "id": goal.id,
                "match_id": match.id,

                "event_id": match.round.event_id,
                "event_name": match.round.event.name,

                "home_team": {
                    "id": match.home_team.id,
                    "name": match.home_team.name,
                    "code": match.home_team.code,
                },

                "away_team": {
                    "id": match.away_team.id,
                    "name": match.away_team.name,
                    "code": match.away_team.code,
                },

                "home_score": match.home_score,
                "away_score": match.away_score,

                "match_status": match.status,
                "scheduled_at": match.scheduled_at,

                "minute": goal.minute,
                "note": goal.note,
            })
           
        # All match events linked to this registered player.
       
        linked_events = (
            MatchEvent.objects
            .filter(player=player)
            .select_related("match__round__event", "team")
            .order_by("-created_at", "-id")
        )

        event_counts = {
            kind: linked_events.filter(type=kind).count()
            for kind in (
                MatchEvent.EventType.GOAL,
                MatchEvent.EventType.YELLOW_CARD,
                MatchEvent.EventType.RED_CARD,
                MatchEvent.EventType.PENALTY_KICK,
                MatchEvent.EventType.REWARD,
            )
        }

        event_history = [
            {
                "id": item.id,
                "match_id": item.match_id,
                "event_id": item.match.round.event_id,
                "type": item.type,
                "minute": item.minute,
                "points": item.points,
                "note": item.note,
                "player_name": item.player_name,
                "created_at": item.created_at,
            }
            for item in linked_events
        ]


          
        return Response({
            "player": PlayerSerializer(player).data,

            "statistics": {
                "total_goals": total_goals,
                "matches_scored_in": matches_scored_in,
                "recorded_matches": recorded_matches,
                "tournaments_scored_in": len(tournaments),
                "yellow_cards": event_counts[
                    MatchEvent.EventType.YELLOW_CARD
                 ],
                "red_cards": event_counts[
                    MatchEvent.EventType.RED_CARD
                ],
                "penalty_kicks": event_counts[
                   MatchEvent.EventType.PENALTY_KICK
                ],
                "rewards": event_counts[
                   MatchEvent.EventType.REWARD
                ],
               "reward_points": sum(
                  item.points
                  for item in linked_events
                  if item.type == MatchEvent.EventType.REWARD
                ),
            },

            "tournaments": tournaments,

            "goal_history": goal_history,

            "event_history": event_history,
        })

class AdminEventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = AdminEventSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination


class AdminTeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all()
    serializer_class = AdminTeamSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination



class AdminPlayerViewSet(viewsets.ModelViewSet):
    """
    Administrator-only player management.

    Supports:
    GET, POST, PUT, PATCH and DELETE.
    """

    serializer_class = AdminPlayerSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Player.objects.select_related("team").all()

        team_id = self.request.query_params.get("team")

        if team_id:
            queryset = queryset.filter(team_id=team_id)

        return queryset


class AdminRoundViewSet(viewsets.ModelViewSet):
    queryset = Round.objects.select_related("event").all()
    serializer_class = AdminRoundSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination


class AdminMatchViewSet(viewsets.ModelViewSet):
    queryset = (
        Match.objects
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
        .all()
    )
    serializer_class = AdminMatchSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination


class AdminEventTeamViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]

    def list(self, request):
        event_id = request.query_params.get("event_id")

        queryset = EventTeam.objects.select_related("team", "event")

        if event_id:
            queryset = queryset.filter(event_id=event_id)

        return Response([
            {
                "id": event_team.id,
                "event_id": event_team.event_id,
                "team_id": event_team.team_id,
                "team": {
                    "id": event_team.team.id,
                    "name": event_team.team.name,
                    "code": event_team.team.code,
                    "logo": event_team.team.logo,
                },
            }
            for event_team in queryset
        ])


    def create(self, request):
        serializer = AdminEventTeamSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        event_id = request.data.get("event_id")
        team_id = serializer.validated_data["team_id"]

        event = get_object_or_404(Event, pk=event_id)
        team = get_object_or_404(Team, pk=team_id)

        event_team, created = EventTeam.objects.get_or_create(
            event=event,
            team=team,
        )

        return Response(
            {
                "id": event_team.id,
                "event_id": event.id,
                "team_id": team.id,
                "created": created,
            },
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )

    def destroy(self, request, pk=None):
        event_team = get_object_or_404(
            EventTeam,
            pk=pk,
        )
        event_team.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Match.objects
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
        .prefetch_related(
            "events__team",
        )
        .all()
    )

    serializer_class = MatchSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
    )
    def start(self, request, pk=None):
        try:
            match = start_match(pk)
        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )


    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="half-time",
    )
    def half_time(self, request, pk=None):
        """
        End the first half and enter Half Time.
        """
        try:
            match = end_first_half(pk)

        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )


    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="second-half",
    )
    def second_half(self, request, pk=None):
        """
        Start the second half from football minute 45.
        """
        try:
            match = start_second_half(pk)

        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
    )
    def finish(self, request, pk=None):
        try:
            match = finish_match(pk)
        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )
    
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="pause",
    )
    def pause(self, request, pk=None):
        try:
            match = pause_match(pk)

        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="resume",
    )
    def resume(self, request, pk=None):
        try:
            match = resume_match(pk)

        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="extra-time",
    )
    def extra_time(self, request, pk=None):
        try:
            match = set_extra_time(
                match_id=pk,
                minutes=request.data.get("minutes"),
            )

        except (
            Match.DoesNotExist,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchSerializer(match).data,
            status=status.HTTP_200_OK,
        )


    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
    )
    def goal(self, request, pk=None):
        try:
            
            event = record_goal(
                match_id=pk,
                team_id=request.data["team_id"],
                minute=request.data["minute"],
                player_name=request.data.get(
                    "player_name",
                    "",
                ),
                note=request.data.get(
                    "note",
                    "",
                ),
                player_id=request.data.get(
                    "player_id",
                ),
            )

        except (
            Match.DoesNotExist,
            KeyError,
            ValueError,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchEventSerializer(event).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="event",
    )
    def match_event(self, request, pk=None):
        try:
            event = record_match_event(
                match_id=pk,
                team_id=request.data["team_id"],
                event_type=request.data["event_type"],
                minute=request.data["minute"],
                player_name=request.data.get(
                    "player_name",
                    "",
                ),
                points=request.data.get(
                    "points",
                    0,
                ),
                note=request.data.get(
                    "note",
                    "",
                ),
                player_id=request.data.get("player_id"),
            )
        except (
            Match.DoesNotExist,
            KeyError,
            ValueError,
            DjangoValidationError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MatchEventSerializer(event).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="events",
    )
    def events(self, request, pk=None):
        match = get_object_or_404(
            Match,
            pk=pk,
        )

        
        events = (
            MatchEvent.objects
            .filter(match=match)
            .select_related("team", "player__team")
            .order_by("created_at", "id")
        )


        return Response(
            MatchEventSerializer(
                events,
                many=True,
            ).data
        )


class LiveMatchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Match.objects
        .filter(
            status=Match.Status.LIVE,
        )
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
    )

    serializer_class = MatchSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(username=username, password=password)

    if user is None:
        return Response(
            {"detail": "Invalid username or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {"detail": "Admin access required."},
            status=status.HTTP_403_FORBIDDEN,
        )

    login(request, user)

    return Response({
        "detail": "Login successful.",
        "user": {
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
        },
    })

@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_view(request):
    return Response({"detail": "CSRF cookie set."})

@api_view(["GET"])
@permission_classes([AllowAny])
def me_view(request):
    user = request.user

    if not user.is_authenticated:
        return Response(
            {
                "authenticated": False,
                "detail": "Not authenticated.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return Response(
        {
            "authenticated": True,
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)

    return Response(
        {"detail": "Logged out successfully."},
        status=status.HTTP_200_OK,
    )
