import { getMatches } from "@/lib/api";
import Link from "next/link";


export default async function MatchesPage() {
  const matches = await getMatches();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Football Tournament
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Matches
          </h1>

          <p className="mt-3 text-slate-400">
            View scheduled, live, and completed tournament matches.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          {matches.map((match) => (
            <Link
              key={match.id}
              href={`/matches/${match.id}`}
             className="block rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500 hover:bg-slate-800"
>
              <div className="mb-6 flex items-center justify-between">
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

              <div className="mt-6 border-t border-slate-800 pt-4 text-sm text-slate-500">
                Scheduled:{" "}
                {new Date(match.scheduled_at).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}