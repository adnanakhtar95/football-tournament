
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getMatches } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

/* =========================================
   TYPES
========================================= */

type MatchStatus = "scheduled" | "live" | "finished";

type MatchFilter = "all" | MatchStatus;

interface Team {
  id: number;
  name: string;
  code: string;
  logo?: string | null;
}

interface FootballMatch {
  id: number;
  home_team: Team;
  away_team: Team;
  home_score: number;
  away_score: number;
  scheduled_at: string;
  venue: string;
  status: MatchStatus;
}

interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
  status?: MatchStatus;
  home_score?: number;
  away_score?: number;
}

/* =========================================
   HELPERS
========================================= */

function formatDateTime(value: string): string {
  if (!value) return "Date to be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date to be announced";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case "live":
      return "● LIVE";

    case "finished":
      return "FULL TIME";

    default:
      return "UPCOMING";
  }
}

function statusStyle(status: MatchStatus): string {
  switch (status) {
    case "live":
      return "border-red-800 bg-red-500/10 text-red-400";

    case "finished":
      return "border-slate-700 bg-slate-800 text-slate-300";

    default:
      return "border-blue-800 bg-blue-500/10 text-blue-400";
  }
}

/* =========================================
   MATCHES PAGE
========================================= */

export default function MatchesPage() {
  const [matches, setMatches] = useState<FootballMatch[]>([]);

  const [filter, setFilter] = useState<MatchFilter>("all");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [connected, setConnected] = useState(false);

  const refreshTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  /* =========================================
     FETCH MATCHES
  ========================================= */

  const loadMatches = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const data = await getMatches();

        setMatches(
          Array.isArray(data)
            ? (data as FootballMatch[])
            : []
        );

        setError("");
      } catch (err) {
        console.error("Failed to load matches:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load matches."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    []
  );

  /* =========================================
     INITIAL LOAD
  ========================================= */

  useEffect(() => {
    void loadMatches(true);
  }, [loadMatches]);

  /* =========================================
     GLOBAL REALTIME WEBSOCKET
  ========================================= */

  useEffect(() => {
    let active = true;

    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null =
      null;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (active) {
          void loadMatches();
        }
      }, 350);
    }

    function connect() {
      if (!active) return;

      const backendUrl = new URL(API_BASE_URL);

      const protocol =
        backendUrl.protocol === "https:" ? "wss:" : "ws:";

      const socketUrl = `${protocol}//${backendUrl.host}/ws/live/`;

      const currentSocket = new WebSocket(socketUrl);

      socket = currentSocket;

      /*
        Safe React Strict Mode cleanup.

        If the component unmounts while the connection
        is being established, close it after opening.
      */

      currentSocket.addEventListener("open", () => {
        if (!active) {
          currentSocket.close(
            1000,
            "Component unmounted"
          );
        }
      });

      currentSocket.onopen = () => {
        if (!active) return;

        setConnected(true);

        // Recover changes missed while disconnected.
        scheduleRefresh();
      };

      currentSocket.onmessage = (message: MessageEvent) => {
        if (!active) return;

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          if (data.type === "connection") {
            return;
          }

          if (data.match_id !== undefined) {
            // Immediately update an existing match.
            setMatches((currentMatches) =>
              currentMatches.map((match) => {
                if (match.id !== data.match_id) {
                  return match;
                }

                return {
                  ...match,
                  status: data.status ?? match.status,
                  home_score:
                    data.home_score ?? match.home_score,
                  away_score:
                    data.away_score ?? match.away_score,
                };
              })
            );

            // Also fetch fresh data from the backend.
            scheduleRefresh();
          } else if (
            data.event === "match_started" ||
            data.event === "match_finished"
          ) {
            scheduleRefresh();
          }
        } catch (err) {
          console.error(
            "Matches WebSocket message error:",
            err
          );
        }
      };

      currentSocket.onerror = () => {
        if (!active) return;

        setConnected(false);
      };

      currentSocket.onclose = () => {
        if (!active) return;

        setConnected(false);

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          if (active) {
            connect();
          }
        }, 3000);
      };
    }

    connect();

    /* =========================================
       CLEANUP
    ========================================= */

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      const currentSocket = socket;

      if (!currentSocket) return;

      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;

      if (currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.close(
          1000,
          "Component unmounted"
        );
      }

      // A CONNECTING socket is closed by its open listener.
    };
  }, [loadMatches]);

  /* =========================================
     MATCH COUNTS
  ========================================= */

  const liveCount = matches.filter(
    (match) => match.status === "live"
  ).length;

  const scheduledCount = matches.filter(
    (match) => match.status === "scheduled"
  ).length;

  const finishedCount = matches.filter(
    (match) => match.status === "finished"
  ).length;

  /* =========================================
     FILTERED & SORTED MATCHES
  ========================================= */

  const filteredMatches = useMemo(() => {
    const selected =
      filter === "all"
        ? matches
        : matches.filter(
            (match) => match.status === filter
          );

    const priority: Record<MatchStatus, number> = {
      live: 0,
      scheduled: 1,
      finished: 2,
    };

    return [...selected].sort((a, b) => {
      const statusDifference =
        priority[a.status] - priority[b.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      const dateA = new Date(a.scheduled_at).getTime();
      const dateB = new Date(b.scheduled_at).getTime();

      if (a.status === "finished") {
        return dateB - dateA;
      }

      return dateA - dateB;
    });
  }, [matches, filter]);

  /* =========================================
     PAGE UI
  ========================================= */

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HERO */}

      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-14 sm:py-20">
          <Link
            href="/"
            className="mb-8 inline-flex items-center text-sm font-semibold text-slate-400 transition hover:text-blue-400"
          >
            ← Back to Home
          </Link>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-800 bg-blue-950/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-300">
              Football Match Centre
            </span>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                connected
                  ? "border-green-800 bg-green-500/10 text-green-400"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected
                    ? "bg-green-400"
                    : "bg-slate-500"
                }`}
              />

              {connected
                ? "Live Updates Connected"
                : "Connecting to Live Updates..."}
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Match{" "}
            <span className="text-blue-400">
              Centre.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
            Follow every fixture, watch scores update in
            realtime and explore completed tournament matches.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/live"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold transition hover:bg-blue-500"
            >
              ● Live Scoreboard →
            </Link>

            <Link
              href="/events"
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-bold transition hover:border-blue-600"
            >
              All Tournaments
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-6 py-12">
        {/* STATISTICS */}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Total Matches",
              value: matches.length,
              icon: "⚽",
            },
            {
              label: "Live Now",
              value: liveCount,
              icon: "🔴",
            },
            {
              label: "Upcoming",
              value: scheduledCount,
              icon: "📅",
            },
            {
              label: "Finished",
              value: finishedCount,
              icon: "🏁",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 sm:text-sm">
                  {stat.label}
                </span>

                <span className="text-xl">
                  {stat.icon}
                </span>
              </div>

              <p className="mt-5 text-3xl font-black">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* MATCH DIRECTORY */}

        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Fixtures & Results
              </p>

              <h2 className="mt-2 text-3xl font-black">
                All Matches
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Browse live, upcoming and completed football
                matches.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadMatches(true)}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-bold transition hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          {/* FILTERS */}

          <div className="mb-7 flex flex-wrap gap-2">
            {(
              [
                {
                  value: "all",
                  label: "All Matches",
                  count: matches.length,
                },
                {
                  value: "live",
                  label: "Live",
                  count: liveCount,
                },
                {
                  value: "scheduled",
                  label: "Upcoming",
                  count: scheduledCount,
                },
                {
                  value: "finished",
                  label: "Finished",
                  count: finishedCount,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  filter === tab.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
              >
                {tab.label}

                <span className="ml-2 opacity-70">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ERROR */}

          {error && (
            <div className="mb-7 rounded-xl border border-red-900 bg-red-950/40 p-5 text-sm text-red-300">
              <p className="font-bold">
                Unable to load matches
              </p>

              <p className="mt-2">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadMatches(true)}
                className="mt-4 font-bold underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}

          {/* LOADING */}

          {loading && matches.length === 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"
                />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            /* EMPTY STATE */

            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-16 text-center">
              <div className="text-5xl">⚽</div>

              <h3 className="mt-5 text-xl font-black">
                No Matches Found
              </h3>

              <p className="mt-3 text-sm text-slate-400">
                {filter === "all"
                  ? "No tournament matches are available yet."
                  : `There are no ${filter} matches at the moment.`}
              </p>

              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold hover:bg-blue-500"
                >
                  View All Matches
                </button>
              )}
            </div>
          ) : (
            /* MATCH CARDS */

            <div className="grid gap-5 md:grid-cols-2">
              {filteredMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className={`group block rounded-2xl border bg-slate-900 p-6 transition hover:-translate-y-1 hover:bg-slate-800 ${
                    match.status === "live"
                      ? "border-red-900/70 hover:border-red-600"
                      : "border-slate-800 hover:border-blue-600"
                  }`}
                >
                  {/* CARD HEADER */}

                  <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      📍 {match.venue || "Venue TBA"}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase ${statusStyle(
                        match.status
                      )}`}
                    >
                      {statusLabel(match.status)}
                    </span>
                  </div>

                  {/* SCOREBOARD */}

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    {/* HOME TEAM */}

                    <div className="min-w-0">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950/70 text-sm font-black text-blue-300">
                        {match.home_team.code}
                      </div>

                      <p className="break-words text-sm font-bold sm:text-base">
                        {match.home_team.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Home
                      </p>
                    </div>

                    {/* SCORE */}

                    <div className="whitespace-nowrap px-1">
                      <p className="text-3xl font-black tabular-nums sm:text-4xl">
                        {match.home_score}

                        <span className="mx-2 text-slate-600">
                          :
                        </span>

                        {match.away_score}
                      </p>

                      <p
                        className={`mt-2 text-xs font-black uppercase tracking-widest ${
                          match.status === "live"
                            ? "text-red-400"
                            : "text-slate-500"
                        }`}
                      >
                        {match.status === "scheduled"
                          ? "VS"
                          : match.status === "live"
                            ? "LIVE"
                            : "FT"}
                      </p>
                    </div>

                    {/* AWAY TEAM */}

                    <div className="min-w-0">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-950/70 text-sm font-black text-purple-300">
                        {match.away_team.code}
                      </div>

                      <p className="break-words text-sm font-bold sm:text-base">
                        {match.away_team.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Away
                      </p>
                    </div>
                  </div>

                  {/* CARD FOOTER */}

                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
                    <span className="text-xs text-slate-400">
                      📅 {formatDateTime(match.scheduled_at)}
                    </span>

                    <span className="text-xs font-bold text-blue-400 transition group-hover:text-blue-300">
                      Match Details →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* BOTTOM CTA */}

        <section className="rounded-3xl border border-blue-900 bg-gradient-to-r from-blue-950/60 to-slate-900 px-7 py-11 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
            Real-Time Football
          </p>

          <h2 className="mt-4 text-3xl font-black">
            Follow Every Moment.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Track ongoing matches, explore goal updates and
            follow your favourite teams throughout the
            competition.
          </p>

          <Link
            href="/live"
            className="mt-7 inline-block rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold transition hover:bg-blue-500"
          >
            Open Live Scoreboard →
          </Link>
        </section>
      </div>
    </main>
  );
}
