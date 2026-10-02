
from django.db import connection
from tournament.models import Event, Team, EventTeam, Round, Match, MatchEvent
from psycopg import sql

models = [Event, Team, EventTeam, Round, Match, MatchEvent]

with connection.cursor() as cursor:
    for model in models:
        table = model._meta.db_table
        pk = model._meta.pk.column

        cursor.execute(
            "SELECT pg_get_serial_sequence(%s, %s)",
            [table, pk]
        )

        sequence = cursor.fetchone()[0]

        if not sequence:
            print(f"{table}: No sequence found")
            continue

        query = sql.SQL("SELECT MAX({}) FROM {}").format(
            sql.Identifier(pk),
            sql.Identifier(table)
        )

        cursor.execute(query)
        max_id = cursor.fetchone()[0]

        if max_id is None:
            cursor.execute(
                "SELECT setval(%s, 1, false)",
                [sequence]
            )
        else:
            cursor.execute(
                "SELECT setval(%s, %s, true)",
                [sequence, max_id]
            )

        print(f"{table}: synchronized (max ID: {max_id})")

print("All tournament sequences synchronized successfully.")
