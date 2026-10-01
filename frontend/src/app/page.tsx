import { getEvents, getStandings } from "@/lib/api";

export default async function Home() {
  const events = await getEvents();
  const event = events[0];
  

  if (!event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-400">No tournaments found.</p>
      </main>
    );
  }
  const standings = await getStandings(event.id);
  const matches = event.rounds.flatMap((round) => round.matches);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Football Tournament
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            {event.name}
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            {event.description}
          </p>

          <span className="mt-4 inline-block rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-400">
            {event.status.toUpperCase()}
          </span>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-semibold">
            Registered Teams
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {event.teams.map((team) => (
              <div
                key={team.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {team.code}
                    </p>
                  </div>

                  <span className="text-2xl">⚽</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            Upcoming Matches
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            {matches.map((match) => (
              <div
                key={match.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {match.venue}
                  </span>

                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase text-slate-300">
                    {match.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-center">
                  <div className="flex-1">
                    <p className="font-semibold">
                      {match.home_team.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {match.home_team.code}
                    </p>
                  </div>

                  <div className="px-6">
                    <p className="text-2xl font-bold">
                      {match.home_score} - {match.away_score}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      VS
                    </p>
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold">
                      {match.away_team.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {match.away_team.code}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
                 </section>

          <section className="mt-10">
            <h2 className="mb-4 text-2xl font-semibold">
              Tournament Standings
            </h2>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-950/50">
                    <tr>
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Team</th>
                      <th className="px-5 py-4">P</th>
                      <th className="px-5 py-4">W</th>
                      <th className="px-5 py-4">D</th>
                      <th className="px-5 py-4">L</th>
                      <th className="px-5 py-4">GF</th>
                      <th className="px-5 py-4">GA</th>
                      <th className="px-5 py-4">GD</th>
                      <th className="px-5 py-4 font-bold">Pts</th>
                    </tr>
                  </thead>

                  <tbody>
                    {standings.map((standing, index) => (
                      <tr
                        key={standing.team_id}
                        className="border-b border-slate-800 last:border-b-0"
                      >
                        <td className="px-5 py-4 text-slate-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4 font-semibold">
                          {standing.team}
                        </td>

                        <td className="px-5 py-4">
                          {standing.played}
                        </td>

                        <td className="px-5 py-4">
                          {standing.won}
                        </td>

                        <td className="px-5 py-4">
                          {standing.drawn}
                        </td>

                        <td className="px-5 py-4">
                          {standing.lost}
                        </td>

                        <td className="px-5 py-4">
                          {standing.goals_for}
                        </td>

                        <td className="px-5 py-4">
                          {standing.goals_against}
                        </td>

                        <td className="px-5 py-4">
                          {standing.goal_difference}
                        </td>

                        <td className="px-5 py-4 font-bold text-blue-400">
                          {standing.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
  );
}