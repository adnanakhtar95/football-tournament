from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminEventViewSet,
    AdminEventTeamViewSet,
    AdminMatchViewSet,
    AdminRoundViewSet,
    AdminTeamViewSet,
    EventViewSet,
    LiveMatchViewSet,
    MatchViewSet,
    TeamViewSet,
)

router = DefaultRouter()

# Public API
router.register("events", EventViewSet, basename="event")
router.register("teams", TeamViewSet, basename="team")
router.register("matches", MatchViewSet, basename="match")
router.register("live", LiveMatchViewSet, basename="live")

# Admin API
router.register(
    "admin/events",
    AdminEventViewSet,
    basename="admin-event",
)
router.register(
    "admin/teams",
    AdminTeamViewSet,
    basename="admin-team",
)
router.register(
    "admin/rounds",
    AdminRoundViewSet,
    basename="admin-round",
)
router.register(
    "admin/matches",
    AdminMatchViewSet,
    basename="admin-match",
)

urlpatterns = [
    path("", include(router.urls)),
]