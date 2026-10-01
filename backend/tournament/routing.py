from django.urls import path

from . import consumers


websocket_urlpatterns = [
    path(
        "ws/matches/<int:match_id>/",
        consumers.MatchConsumer.as_asgi(),
    ),
]