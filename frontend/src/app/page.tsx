
import Link from "next/link";
import { getEvents, getStandings } from "@/lib/api";
import HomeRealtime from "@/components/HomeRealtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string) {
  if (!value) return "Date to be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date to be announced";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusStyle(status: string) {
  switch (status) {
    case "live":
    case "active":
      return "border-green-800 bg-green-500/10 text-green-400";

    case "finished":
    case "completed":
      return "border-slate-700 bg-slate-800 text-slate-300";

    default:
      return "border-amber-800 bg-amber-500/10 text-amber-400";
  }
}

export default async function Home() {
  const events = await getEvents();

  // Prioritize the active tournament.
  const event =
    events.find((item) => item.status === "active") ??
    events.find((item) => item.status === "completed") ??
    events[0];

  // EMPTY STATE
  if (!event) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        {/* Keep realtime mounted even in the empty state */}
        <div className="mx-auto max-w-7xl px-6 pt-5">
          <HomeRealtime />
        </div>

        <div className="mx-auto flex min-h-[75vh] max-w-7xl flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-blue-800 bg-blue-950/40 text-5xl">
            ⚽
          </div>

          <h1 className="text-4xl font-black sm:text-5xl">
            Football Tournament Hub
          </h1>

          <p className="mt-5 max-w-lg text-slate-400">
            Your destination for live football scores, tournament
            standings and match updates. Tournaments will appear here
            once they are published.
          </p>

          <Link
            href="/events"
            className="mt-8 rounded-xl bg-blue-600 px-7 py-3 font-bold transition hover:bg-blue-500"
          >
            Explore Tournaments →
          </Link>
        </div>
      </main>
    );
  }

  const standings = await getStandings(event.id);

  const matches = event.rounds.flatMap(
    (round) => round.matches
  );

  const liveMatches = matches.filter(
    (match) => match.status === "live"
  );

  const upcomingMatches = matches
    .filter((match) => match.status === "scheduled")
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime()
    );

  const finishedMatches = matches
    .filter((match) => match.status === "finished")
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() -
        new Date(a.scheduled_at).getTime()
    );

  const highlightedMatches = [
    ...liveMatches,
    ...upcomingMatches,
    ...finishedMatches,
  ].slice(0, 4);

  const otherEvents = events.filter(
    (item) => item.id !== event.id
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* GLOBAL REALTIME CONNECTION */}
      {/* This is now inside the ACTUAL homepage return */}

      <div className="mx-auto max-w-7xl px-6 pt-5">
        <HomeRealtime />
      </div>

      {/* HERO */}

      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
        <div className="pointer-events-none absolute -right-24 -top-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Football Tournament Hub
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Every Match.
              <br />
              Every Moment.
              <br />
              <span className="text-blue-400">
                Live.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400">
              Follow your favourite tournaments, track live
              scores, explore match results and stay updated
              with the latest league standings.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/live"
                className="rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-bold transition hover:bg-blue-500"
              >
                ● Watch Live Scores →
              </Link>

              <Link
                href="/events"
                className="rounded-xl border border-slate-700 bg-slate-900 px-7 py-3.5 text-sm font-bold transition hover:border-blue-500"
              >
                Explore Tournaments
              </Link>
            </div>

            <p className="mt-7 text-xs text-slate-500">
              No registration required. All tournament
              information is publicly accessible.
            </p>
          </div>

          {/* FEATURED TOURNAMENT */}

          <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 bg-slate-800/40 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Featured Tournament
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusStyle(
                    event.status
                  )}`}
                >
                  {event.status}
                </span>
              </div>
            </div>

            <div className="p-7">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-800 bg-blue-950/40 text-3xl">
                🏆
              </div>

              <h2 className="text-2xl font-black">
                {event.name}
              </h2>

              <p className="mt-3 line-clamp-3 min-h-12 text-sm leading-6 text-slate-400">
                {event.description ||
                  "Follow the fixtures, live results and tournament standings."}
              </p>

              <div className="mt-7 grid grid-cols-3 gap-3 border-y border-slate-800 py-6 text-center">
                <div>
                  <p className="text-2xl font-black">
                    {event.teams.length}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Teams
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-black">
                    {matches.length}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Matches
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-black text-red-400">
                    {liveMatches.length}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Live Now
                  </p>
                </div>
              </div>

              <Link
                href={`/events/${event.id}`}
                className="mt-6 block rounded-xl bg-blue-600 px-5 py-3.5 text-center text-sm font-bold transition hover:bg-blue-500"
              >
                View Tournament →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-6 py-14">
        {/* QUICK STATS */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Tournaments",
              value: events.length,
              icon: "🏆",
            },
            {
              label: "Registered Teams",
              value: event.teams.length,
              icon: "🛡️",
            },
            {
              label: "Total Fixtures",
              value: matches.length,
              icon: "⚽",
            },
            {
              label: "Live Matches",
              value: liveMatches.length,
              icon: "🔴",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {stat.label}
                </p>

                <span className="text-xl">
                  {stat.icon}
                </span>
              </div>

              <p className="mt-4 text-3xl font-black">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* MATCH HIGHLIGHTS */}

        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Match Centre
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Match Highlights
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Live action, upcoming fixtures and recent results.
              </p>
            </div>

            <Link
              href="/matches"
              className="text-sm font-bold text-blue-400 hover:text-blue-300"
            >
              View All Matches →
            </Link>
          </div>

          {highlightedMatches.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
              No fixtures have been scheduled yet.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {highlightedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-700"
                >
                  <div className="mb-7 flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-slate-500">
                      {match.venue || "Venue TBA"}
                    </span>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusStyle(
                        match.status
                      )}`}
                    >
                      {match.status === "live"
                        ? "● Live"
                        : match.status === "finished"
                          ? "Full Time"
                          : "Upcoming"}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <div className="min-w-0">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950/60 font-black text-blue-300">
                        {match.home_team.code}
                      </div>

                      <p className="break-words text-sm font-bold sm:text-base">
                        {match.home_team.name}
                      </p>
                    </div>

                    <div>
                      <p className="whitespace-nowrap text-3xl font-black tabular-nums">
                        {match.home_score}
                        <span className="mx-2 text-slate-600">
                          :
                        </span>
                        {match.away_score}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        {match.status === "scheduled"
                          ? "VS"
                          : match.status === "live"
                            ? "LIVE"
                            : "FT"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-950/60 font-black text-purple-300">
                        {match.away_team.code}
                      </div>

                      <p className="break-words text-sm font-bold sm:text-base">
                        {match.away_team.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 border-t border-slate-800 pt-4 text-center text-xs text-slate-500">
                    {formatDate(match.scheduled_at)}

                    <span className="ml-3 font-bold text-blue-400 transition group-hover:text-blue-300">
                      Match Details →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* UPCOMING FIXTURES */}

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Coming Up
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Upcoming Fixtures
              </h2>
            </div>

            <Link
              href="/matches"
              className="text-sm font-bold text-blue-400 hover:text-blue-300"
            >
              Full Schedule →
            </Link>
          </div>

          {upcomingMatches.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-8 text-sm text-slate-400">
              No upcoming matches are currently scheduled.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {upcomingMatches.slice(0, 5).map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-5 transition last:border-0 hover:bg-slate-800/50"
                >
                  <div>
                    <p className="font-bold">
                      {match.home_team.name}

                      <span className="mx-3 text-slate-600">
                        vs
                      </span>

                      {match.away_team.name}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {match.venue || "Venue TBA"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-300">
                      {formatDate(match.scheduled_at)}
                    </p>

                    <p className="mt-1 text-xs text-blue-400">
                      View Fixture →
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* REGISTERED TEAMS */}

        <section>
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              Tournament Participants
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Registered Teams
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Teams competing in {event.name}.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {event.teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-900 bg-blue-950/40 font-black text-blue-300">
                  {team.code.slice(0, 3)}
                </div>

                <div className="min-w-0">
                  <h3 className="truncate font-bold">
                    {team.name}
                  </h3>

                  <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                    {team.code}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* STANDINGS */}

        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                League Table
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Tournament Standings
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Current rankings for {event.name}.
              </p>
            </div>

            <Link
              href={`/events/${event.id}`}
              className="text-sm font-bold text-blue-400 hover:text-blue-300"
            >
              Tournament Details →
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-4">#</th>
                    <th className="px-5 py-4">Team</th>
                    <th className="px-4 py-4 text-center">P</th>
                    <th className="px-4 py-4 text-center">W</th>
                    <th className="px-4 py-4 text-center">D</th>
                    <th className="px-4 py-4 text-center">L</th>
                    <th className="px-4 py-4 text-center">GF</th>
                    <th className="px-4 py-4 text-center">GA</th>
                    <th className="px-4 py-4 text-center">GD</th>
                    <th className="px-5 py-4 text-center">Pts</th>
                  </tr>
                </thead>

                <tbody>
                  {standings.map((standing, index) => (
                    <tr
                      key={standing.team_id}
                      className="border-b border-slate-800 transition last:border-0 hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 text-slate-500">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4 font-bold">
                        {standing.team}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.played}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.won}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.drawn}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.lost}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.goals_for}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.goals_against}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {standing.goal_difference}
                      </td>

                      <td className="px-5 py-4 text-center font-black text-blue-400">
                        {standing.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {standings.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Standings are not available yet.
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            P: Played · W: Won · D: Drawn · L: Lost ·
            GF: Goals For · GA: Goals Against ·
            GD: Goal Difference
          </p>
        </section>

        {/* OTHER TOURNAMENTS */}

        {otherEvents.length > 0 && (
          <section>
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                  Discover More
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Other Tournaments
                </h2>
              </div>

              <Link
                href="/events"
                className="text-sm font-bold text-blue-400 hover:text-blue-300"
              >
                View All →
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {otherEvents.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href={`/events/${item.id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-700"
                >
                  <span className="text-3xl">
                    🏆
                  </span>

                  <h3 className="mt-5 text-lg font-bold">
                    {item.name}
                  </h3>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                    {item.description ||
                      "Explore tournament details and fixtures."}
                  </p>

                  <div className="mt-6 flex items-center justify-between">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusStyle(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>

                    <span className="text-sm font-semibold text-blue-400">
                      Explore →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* BOTTOM CTA */}

        <section className="rounded-3xl border border-blue-900 bg-gradient-to-r from-blue-950/70 to-slate-900 px-7 py-12 text-center sm:px-12">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
            Never Miss a Moment
          </p>

          <h2 className="mt-4 text-3xl font-black sm:text-4xl">
            Follow the Action Live
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Watch match scores change in realtime, follow every
            important event and explore the latest tournament
            results without creating an account.
          </p>

          <Link
            href="/live"
            className="mt-7 inline-block rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold transition hover:bg-blue-500"
          >
            Open Live Scoreboard →
          </Link>
        </section>
      </div>

      {/* FOOTER */}

      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-8 text-center text-xs text-slate-500">
        Football Tournament Management System
        <span className="mx-3 text-slate-700">•</span>
        Live Scores & Tournament Coverage
      </footer>
    </main>
  );
}
