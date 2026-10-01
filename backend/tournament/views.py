from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from django.contrib.auth import authenticate, login
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from .models import (
    Event,
    EventTeam,
    Match,
    MatchEvent,
    Round,
    Team,
)
from .serializers import (
    AdminEventSerializer,
    AdminEventTeamSerializer,
    AdminMatchSerializer,
    AdminRoundSerializer,
    AdminTeamSerializer,
    EventSerializer,
    MatchEventSerializer,
    MatchSerializer,
    TeamSerializer,
)
from .services import (
    finish_match,
    get_event_standings,
    record_goal,
    record_match_event,
    start_match,
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


class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

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
            .select_related("team")
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