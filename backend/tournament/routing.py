
from django.urls import path

from . import consumers


websocket_urlpatterns = [
    # Individual match realtime updates
    path(
        "ws/matches/<int:match_id>/",
        consumers.MatchConsumer.as_asgi(),
    ),

    # Global live scoreboard updates
    path(
        "ws/live/",
        consumers.LiveScoreboardConsumer.as_asgi(),
    ),
]
