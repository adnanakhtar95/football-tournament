from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from .models import Event, Match, MatchEvent, Team
from .serializers import (
    EventSerializer,
    MatchEventSerializer,
    MatchSerializer,
    TeamSerializer,
)
from .services import (
    finish_match,
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


class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Match.objects
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
        .prefetch_related("events__team")
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
        except (Match.DoesNotExist, DjangoValidationError) as exc:
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
        except (Match.DoesNotExist, DjangoValidationError) as exc:
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
        .filter(status=Match.Status.LIVE)
        .select_related(
            "round__event",
            "home_team",
            "away_team",
        )
    )

    serializer_class = MatchSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination