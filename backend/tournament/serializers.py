from rest_framework import serializers

from .models import (
    Event,
    EventTeam,
    Match,
    MatchEvent,
    Round,
    Team,
)


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "code",
            "logo",
        ]


class EventTeamSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)

    class Meta:
        model = EventTeam
        fields = [
            "id",
            "team",
        ]


class MatchEventSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)

    class Meta:
        model = MatchEvent
        fields = [
            "id",
            "team",
            "type",
            "player_name",
            "minute",
            "points",
            "note",
            "created_at",
        ]


class MatchSerializer(serializers.ModelSerializer):
    home_team = TeamSerializer(read_only=True)
    away_team = TeamSerializer(read_only=True)

    class Meta:
        model = Match
        fields = [
            "id",
            "home_team",
            "away_team",
            "scheduled_at",
            "venue",
            "status",
            "started_at",
            "ended_at",
            "home_score",
            "away_score",
        ]


class RoundSerializer(serializers.ModelSerializer):
    matches = MatchSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Round
        fields = [
            "id",
            "name",
            "order_number",
            "matches",
        ]


class EventSerializer(serializers.ModelSerializer):
    teams = serializers.SerializerMethodField()
    rounds = RoundSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Event
        fields = [
            "id",
            "name",
            "description",
            "start_date",
            "end_date",
            "status",
            "teams",
            "rounds",
        ]

    def get_teams(self, obj):
        event_teams = (
            obj.event_teams
            .select_related("team")
        )

        return TeamSerializer(
            [
                event_team.team
                for event_team in event_teams
            ],
            many=True,
        ).data


class AdminEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            "id",
            "name",
            "description",
            "start_date",
            "end_date",
            "status",
        ]


class AdminTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "code",
            "logo",
        ]


class AdminRoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Round
        fields = [
            "id",
            "event",
            "name",
            "order_number",
        ]


class AdminMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = [
             "id",
    "round",
    "home_team",
    "away_team",
    "scheduled_at",
    "venue",
    "status",
    "started_at",
    "ended_at",
    "home_score",
    "away_score",
        ]

    def validate(self, attrs):
      from .services import validate_match_teams

      round_obj = attrs.get(
        "round",
        self.instance.round if self.instance else None,
     )

      home_team = attrs.get(
        "home_team",
        self.instance.home_team if self.instance else None,
      )

      away_team = attrs.get(
        "away_team",
        self.instance.away_team if self.instance else None,
    )

      if not round_obj or not home_team or not away_team:
        raise serializers.ValidationError(
            "Round and both teams are required."
        )

      validate_match_teams(
        round_id=round_obj.id,
        home_team_id=home_team.id,
        away_team_id=away_team.id,
        exclude_match_id=(
            self.instance.id
            if self.instance
            else None
        ),
    )

      return attrs


class AdminEventTeamSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()  