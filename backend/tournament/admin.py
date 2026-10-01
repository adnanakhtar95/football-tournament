from django.contrib import admin

from .models import (
    Event,
    EventTeam,
    Match,
    MatchEvent,
    Round,
    Team,
)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "start_date",
        "end_date",
    )

    list_filter = ("status",)

    search_fields = ("name",)


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
    )

    search_fields = (
        "name",
        "code",
    )


@admin.register(EventTeam)
class EventTeamAdmin(admin.ModelAdmin):
    list_display = (
        "event",
        "team",
        "created_at",
    )

    list_filter = ("event", "team")


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = (
        "event",
        "name",
        "order_number",
    )

    list_filter = ("event",)


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "round",
        "home_team",
        "away_team",
        "status",
        "scheduled_at",
        "home_score",
        "away_score",
    )

    list_filter = (
        "status",
        "round__event",
    )

    search_fields = (
        "home_team__name",
        "away_team__name",
    )


@admin.register(MatchEvent)
class MatchEventAdmin(admin.ModelAdmin):
    list_display = (
        "match",
        "team",
        "type",
        "player_name",
        "minute",
        "points",
        "created_at",
    )

    list_filter = (
        "type",
        "team",
    )

    search_fields = (
        "player_name",
        "match__home_team__name",
        "match__away_team__name",
    )