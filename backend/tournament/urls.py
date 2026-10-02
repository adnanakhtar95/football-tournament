
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
    csrf_view,
    login_view,
    logout_view,
    me_view,
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

router.register(
    "admin/event-teams",
    AdminEventTeamViewSet,
    basename="admin-event-team",
)


urlpatterns = [
    # Authentication
    path("auth/login/", login_view, name="login"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/csrf/", csrf_view, name="csrf"),
    path("auth/me/", me_view, name="me"),

    # API routes
    path("", include(router.urls)),
]
