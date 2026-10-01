from rest_framework.routers import DefaultRouter

from .views import (
    EventViewSet,
    LiveMatchViewSet,
    MatchViewSet,
    TeamViewSet,
)

router = DefaultRouter()

router.register(
    "events",
    EventViewSet,
    basename="events",
)

router.register(
    "teams",
    TeamViewSet,
    basename="teams",
)

router.register(
    "matches",
    MatchViewSet,
    basename="matches",
)

router.register(
    "live-matches",
    LiveMatchViewSet,
    basename="live-matches",
)

urlpatterns = router.urls