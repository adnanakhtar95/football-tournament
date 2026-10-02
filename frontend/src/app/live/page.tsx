
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const WS_BASE_URL = API_BASE_URL
  .replace(/^http/, "ws")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface LiveMatch {
  id: number;
  round: number;
  home_team: number | Team;
  away_team: number | Team;
  home_score: number;
  away_score: number;
  status: "scheduled" | "live" | "finished";
  scheduled_at: string;
  venue: string;
}

interface MatchUpdate {
  type: string;
  event?: string;
  match_id?: number;
  status?: LiveMatch["status"];
  home_score?: number;
  away_score?: number;
}

function getTeamName(team: number | Team): string {
  return typeof team === "number" ? `Team #${team}` : team.name;
}

function getTeamCode(team: number | Team): string {
  return typeof team === "number" ? "" : team.code;
}

export default function LiveScoreboardPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const loadMatches = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await fetch(`${API_BASE_URL}/live/`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load live matches (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      const results: LiveMatch[] = Array.isArray(data)
        ? data
        : data.results ?? [];

      setMatches(results.filter((match) => match.status === "live"));
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (!active) {
        return;
      }

      socket = new WebSocket(`${WS_BASE_URL}/ws/live/`);

      socket.onopen = () => {
        if (!active) return;

        setSocketConnected(true);

        // Synchronize after reconnecting in case any events were missed.
        void loadMatches();
      };

      socket.onmessage = (message) => {
        if (!active) return;

        try {
          const data: MatchUpdate = JSON.parse(message.data);

          if (data.type === "connection") {
            return;
          }

          if (data.type !== "match_update") {
            return;
          }

          if (data.event === "match_started") {
            // Fetch the complete match, including team names and venue.
            void loadMatches();
            return;
          }

          if (data.match_id === undefined) {
            return;
          }

          const matchId = data.match_id;

          if (data.event === "match_finished" || data.status === "finished") {
            setMatches((current) =>
              current.filter((match) => match.id !== matchId)
            );

            return;
          }

          setMatches((current) =>
            current.map((match) => {
              if (match.id !== matchId) {
                return match;
              }

              return {
                ...match,
                status: data.status ?? match.status,
                home_score: data.home_score ?? match.home_score,
                away_score: data.away_score ?? match.away_score,
              };
            })
          );
        } catch (err) {
          console.error("Invalid scoreboard WebSocket update:", err);
        }
      };

      socket.onerror = () => {
        if (active) {
          setSocketConnected(false);
        }
      };

      socket.onclose = () => {
        if (!active) return;

        setSocketConnected(false);

        // Reconnect after three seconds.
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      active = false;

      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current);
      }

      socket?.close();
    };
  }, [loadMatches]);

  const totalGoals = matches.reduce(
    (total, match) => total + match.home_score + match.away_score,
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {/* Header */}

        <header className="mb-10">
          <Link
            href="/events"
            className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
          >
            ← Back to Events
          </Link>

          <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
                Football Tournament
              </p>

              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Live Scoreboard
              </h1>

              <p className="mt-3 text-slate-400">
                Follow every live match and goal in real time.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                  socketConnected
                    ? "border-green-900 bg-green-950/40 text-green-400"
                    : "border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    socketConnected
                      ? "bg-green-500"
                      : "animate-pulse bg-yellow-500"
                  }`}
                />

                {socketConnected ? "Realtime Connected" : "Connecting..."}
              </span>

              <button
                type="button"
                onClick={() => void loadMatches(true)}
                disabled={loading}
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Summary */}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Live Matches</p>

            <p className="mt-3 text-4xl font-bold">
              {matches.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Goals Scored</p>

            <p className="mt-3 text-4xl font-bold text-blue-400">
              {totalGoals}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Across currently live matches
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Realtime Connection</p>

            <p
              className={`mt-3 text-2xl font-bold ${
                socketConnected ? "text-green-400" : "text-yellow-400"
              }`}
            >
              {socketConnected ? "Connected" : "Disconnected"}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Global scoreboard WebSocket
            </p>
          </div>
        </section>

        {/* Error */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/30 p-5 text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}

        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-16 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

            <p className="mt-5 text-slate-400">
              Loading live matches...
            </p>
          </div>
        ) : matches.length === 0 ? (
          /* Empty state */

          <div className="rounded-3xl border border-slate-800 bg-slate-900 px-6 py-20 text-center">
            <div className="mb-5 text-5xl">⚽</div>

            <h2 className="text-2xl font-semibold">
              No Live Matches
            </h2>

            <p className="mx-auto mt-3 max-w-md text-slate-400">
              There are currently no matches in progress.
              New matches will automatically appear here when they start.
            </p>

            <Link
              href="/events"
              className="mt-7 inline-flex rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          /* Match cards */

          <section>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Matches in Progress
              </h2>

              <span className="text-sm text-slate-500">
                {matches.length} active
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {matches.map((match) => (
                <article
                  key={match.id}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 transition hover:border-slate-600"
                >
                  {/* Card heading */}

                  <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        Live
                      </span>

                      <span className="text-xs text-slate-500">
                        Match #{match.id}
                      </span>
                    </div>

                    <span
                      className={`text-xs font-medium ${
                        socketConnected
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                    >
                      {socketConnected
                        ? "● Realtime Connected"
                        : "○ Reconnecting"}
                    </span>
                  </div>

                  {/* Scoreboard */}

                  <div className="px-6 py-9">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      {/* Home team */}

                      <div className="min-w-0 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-bold text-blue-400">
                          {getTeamCode(match.home_team).slice(0, 2) || "H"}
                        </div>

                        <h3 className="break-words text-sm font-semibold sm:text-lg">
                          {getTeamName(match.home_team)}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          HOME
                        </p>
                      </div>

                      {/* Score */}

                      <div className="text-center">
                        <p className="whitespace-nowrap text-4xl font-extrabold tracking-tight sm:text-5xl">
                          {match.home_score}

                          <span className="mx-3 text-slate-600">
                            :
                          </span>

                          {match.away_score}
                        </p>

                        <span className="mt-4 inline-block rounded-full bg-red-950 px-3 py-1 text-xs font-bold uppercase text-red-400">
                          In Progress
                        </span>
                      </div>

                      {/* Away team */}

                      <div className="min-w-0 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-xl font-bold text-blue-400">
                          {getTeamCode(match.away_team).slice(0, 2) || "A"}
                        </div>

                        <h3 className="break-words text-sm font-semibold sm:text-lg">
                          {getTeamName(match.away_team)}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          AWAY
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/40 px-6 py-4">
                    <p className="text-xs text-slate-500">
                      📍 {match.venue || "Venue not specified"}
                    </p>

                    <Link
                      href={`/matches/${match.id}`}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold transition hover:bg-blue-500"
                    >
                      View Match →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Live Scoreboard
        </footer>
      </div>
    </main>
  );
}
