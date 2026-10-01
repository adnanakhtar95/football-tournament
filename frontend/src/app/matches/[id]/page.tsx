import Link from "next/link";
import { getMatch } from "@/lib/api";

interface MatchPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MatchPage({
  params,
}: MatchPageProps) {
  const { id } = await params;
  const match = await getMatch(Number(id));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/matches"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Matches
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-blue-400">
                Match #{match.id}
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {match.home_team.name} vs {match.away_team.name}
              </h1>
            </div>

            <span className="rounded-full bg-slate-800 px-4 py-2 text-sm uppercase">
              {match.status}
            </span>
          </div>

          <div className="mt-10 flex items-center justify-center gap-10 text-center">
            <div className="flex-1">
              <p className="text-xl font-semibold">
                {match.home_team.name}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {match.home_team.code}
              </p>
            </div>

            <div>
              <p className="text-5xl font-bold">
                {match.home_score} - {match.away_score}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                SCORE
              </p>
            </div>

            <div className="flex-1">
              <p className="text-xl font-semibold">
                {match.away_team.name}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {match.away_team.code}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">
                Venue
              </p>

              <p className="mt-1 font-medium">
                {match.venue || "Not specified"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Scheduled
              </p>

              <p className="mt-1 font-medium">
                {new Date(match.scheduled_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">
            Match Control
          </h2>

          <p className="mt-2 text-slate-400">
            Match actions will appear here.
          </p>

          {match.status === "scheduled" && (
            <button
              className="mt-6 rounded-xl bg-green-600 px-6 py-3 font-semibold hover:bg-green-500"
            >
              Start Match
            </button>
          )}
        </div>
      </div>
    </main>
  );
}