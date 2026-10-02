"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/* =========================
   TYPES
========================= */

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface Match {
  id: number;
  home_team: Team;
  away_team: Team;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  started_at: string | null;
  ended_at: string | null;
  home_score: number;
  away_score: number;
}

interface Round {
  id: number;
  name: string;
  order_number: number;
  matches: Match[];
}

interface TournamentEvent {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "completed";
  teams: Team[];
  rounds: Round[];
}

interface Standing {
  team_id: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  reward_points: number;
  points: number;
}

// NEW: Registered player goal statistics.
interface TopScorer {
  player_id: number;
  player_name: string;
  jersey_number: number;
  team_id: number;
  team_name: string;
  team_code: string;
  goals: number;
}

interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
  status?: Match["status"];
  home_score?: number;
  away_score?: number;
}

/* =========================
   HELPERS
========================= */

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      `Empty response from ${response.url} (HTTP ${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON from ${response.url} (HTTP ${response.status}).`
    );
  }
}

function formatDate(value: string) {
  if (!value) return "To be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "To be announced";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  if (!value) return "To be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "To be announced";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventStatusStyle(status: TournamentEvent["status"]) {
  switch (status) {
    case "active":
      return "border-green-800 bg-green-500/10 text-green-400";

    case "completed":
      return "border-slate-700 bg-slate-800 text-slate-300";

    default:
      return "border-amber-800 bg-amber-500/10 text-amber-400";
  }
}

function matchStatusStyle(status: Match["status"]) {
  switch (status) {
    case "live":
      return "border-red-800 bg-red-500/10 text-red-400";

    case "finished":
      return "border-slate-700 bg-slate-800 text-slate-300";

    default:
      return "border-blue-800 bg-blue-500/10 text-blue-400";
  }
}

function matchStatusLabel(status: Match["status"]) {
  switch (status) {
    case "live":
      return "● Live";

    case "finished":
      return "Full Time";

    default:
      return "Upcoming";
  }
}

/* =========================
   COMPONENT
========================= */

export default function EventDetailsPage() {
  const params = useParams();

  const eventId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [event, setEvent] = useState<TournamentEvent | null>(
    null
  );

  const [standings, setStandings] = useState<Standing[]>([]);

  // NEW: Top scorers state.
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [connected, setConnected] = useState(false);

  const [selectedTab, setSelectedTab] = useState<
    "fixtures" | "teams" | "standings" | "scorers"
  >("fixtures");

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /* =========================
     FETCH TOURNAMENT
  ========================= */

  const loadTournament = useCallback(
    async (showLoader = false) => {
      if (!eventId) return;

      try {
        if (showLoader) {
          setLoading(true);
        }

        // NEW: Fetch leaderboard alongside existing tournament data.
        const [
          eventResponse,
          standingsResponse,
          scorersResponse,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/events/${eventId}/`, {
            cache: "no-store",
          }),

          fetch(
            `${API_BASE_URL}/events/${eventId}/standings/`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `${API_BASE_URL}/events/${eventId}/top-scorers/`,
            {
              cache: "no-store",
            }
          ),
        ]);

        if (!eventResponse.ok) {
          throw new Error(
            `Unable to load tournament (HTTP ${eventResponse.status}).`
          );
        }

        if (!standingsResponse.ok) {
          throw new Error(
            `Unable to load standings (HTTP ${standingsResponse.status}).`
          );
        }

        if (!scorersResponse.ok) {
          throw new Error(
            `Unable to load top scorers (HTTP ${scorersResponse.status}).`
          );
        }

        const eventData = (await readJson(
          eventResponse
        )) as TournamentEvent;

        const standingsData = (await readJson(
          standingsResponse
        )) as Standing[];

        const scorersData = (await readJson(
          scorersResponse
        )) as TopScorer[];

        setEvent(eventData);

        setStandings(
          Array.isArray(standingsData) ? standingsData : []
        );

        setTopScorers(
          Array.isArray(scorersData) ? scorersData : []
        );

        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournament."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [eventId]
  );

  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    void loadTournament(true);
  }, [loadTournament]);

  /* =========================
     GLOBAL WEBSOCKET

     ONE socket for the entire page.
     No reconnecting every time a
     match score changes.

     EXISTING LOGIC PRESERVED.
  ========================= */

  useEffect(() => {
    if (!eventId) return;

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
          void loadTournament();
        }
      }, 350);
    }

    function connect() {
      if (!active) return;

      const backendUrl = new URL(API_BASE_URL);

      const protocol =
        backendUrl.protocol === "https:" ? "wss:" : "ws:";

      const websocketUrl =
        `${protocol}//${backendUrl.host}/ws/live/`;

      const currentSocket = new WebSocket(websocketUrl);

      socket = currentSocket;

      // Handle React Strict Mode unmounting before connection opens.
      currentSocket.addEventListener("open", () => {
        if (!active) {
          currentSocket.close(1000, "Component unmounted");
        }
      });

      currentSocket.onopen = () => {
        if (!active) return;

        setConnected(true);

        // Catch up on updates missed during disconnection.
        scheduleRefresh();
      };

      currentSocket.onmessage = (message) => {
        if (!active) return;

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          if (data.type === "connection") {
            return;
          }

          if (data.match_id !== undefined) {
            /*
              Immediately update a known match in local state.

              We also refresh the event, standings and top scorers
              from the backend to keep everything synchronized.
            */

            setEvent((currentEvent) => {
              if (!currentEvent) return currentEvent;

              let matchFound = false;

              const updatedRounds = currentEvent.rounds.map(
                (round) => ({
                  ...round,

                  matches: round.matches.map((match) => {
                    if (match.id !== data.match_id) {
                      return match;
                    }

                    matchFound = true;

                    return {
                      ...match,

                      status: data.status ?? match.status,

                      home_score:
                        data.home_score ?? match.home_score,

                      away_score:
                        data.away_score ?? match.away_score,
                    };
                  }),
                })
              );

              if (!matchFound) {
                return currentEvent;
              }

              return {
                ...currentEvent,
                rounds: updatedRounds,
              };
            });

            scheduleRefresh();
          }
        } catch (err) {
          console.error(
            "Tournament WebSocket message error:",
            err
          );
        }
      };

      currentSocket.onerror = () => {
        if (active) {
          setConnected(false);
        }
      };

      currentSocket.onclose = () => {
        if (!active) return;

        setConnected(false);

        reconnectTimer = setTimeout(() => {
          connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      const currentSocket = socket;

      if (currentSocket) {
        currentSocket.onopen = null;
        currentSocket.onmessage = null;
        currentSocket.onerror = null;
        currentSocket.onclose = null;

        if (currentSocket.readyState === WebSocket.OPEN) {
          currentSocket.close(1000, "Component unmounted");
        }
      }
    };
  }, [eventId, loadTournament]);

  /* =========================
     DERIVED DATA
  ========================= */

  const rounds = useMemo(() => {
    if (!event) return [];

    return [...event.rounds].sort(
      (a, b) => a.order_number - b.order_number
    );
  }, [event]);

  const matches = useMemo(
    () => rounds.flatMap((round) => round.matches),
    [rounds]
  );

  const liveMatches = matches.filter(
    (match) => match.status === "live"
  );

  const finishedMatches = matches.filter(
    (match) => match.status === "finished"
  );

  const scheduledMatches = matches.filter(
    (match) => match.status === "scheduled"
  );

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <div className="mb-6 text-5xl">🏆</div>

          <h1 className="text-2xl font-black">
            Loading Tournament
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Fetching competition details and standings...
          </p>
        </div>
      </main>
    );
  }

  /* =========================
     NOT FOUND
  ========================= */

  if (!event) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
          <div className="text-5xl">⚽</div>

          <h1 className="mt-6 text-3xl font-black">
            Tournament Not Found
          </h1>

          <p className="mt-4 text-slate-400">
            {error || "The requested tournament is unavailable."}
          </p>

          <Link
            href="/events"
            className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold hover:bg-blue-500"
          >
            ← Back to Tournaments
          </Link>
        </div>
      </main>
    );
  }

  /* =========================
     PAGE
  ========================= */

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HERO */}

      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="pointer-events-none absolute -right-24 -top-40 h-[450px] w-[450px] rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-16">
          <Link
            href="/events"
            className="inline-flex items-center text-sm font-semibold text-slate-400 hover:text-blue-400"
          >
            ← All Tournaments
          </Link>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest ${eventStatusStyle(
                event.status
              )}`}
            >
              {event.status}
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

          <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            {event.name}
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-400">
            {event.description ||
              "Follow participating teams, explore match fixtures and track the latest competition standings."}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-5 text-sm text-slate-400">
            <span>📅 {formatDate(event.start_date)}</span>

            <span className="text-slate-700">→</span>

            <span>{formatDate(event.end_date)}</span>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/live"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold transition hover:bg-blue-500"
            >
              ● Live Scoreboard →
            </Link>

            <button
              type="button"
              onClick={() => void loadTournament()}
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-bold transition hover:border-blue-600"
            >
              ↻ Refresh Tournament
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-6 py-12">
        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* STATISTICS */}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Registered Teams",
              value: event.teams.length,
              icon: "🛡️",
            },
            {
              label: "Total Matches",
              value: matches.length,
              icon: "⚽",
            },
            {
              label: "Live Matches",
              value: liveMatches.length,
              icon: "🔴",
            },
            {
              label: "Completed Matches",
              value: finishedMatches.length,
              icon: "🏁",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400 sm:text-sm">
                  {stat.label}
                </p>

                <span className="text-xl">{stat.icon}</span>
              </div>

              <p className="mt-5 text-3xl font-black">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* LIVE MATCHES */}

        {liveMatches.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                Happening Now
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Live Matches
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {liveMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="group rounded-2xl border border-red-900/70 bg-gradient-to-br from-red-950/30 to-slate-900 p-6 transition hover:border-red-600"
                >
                  <div className="mb-7 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {match.venue || "Venue TBA"}
                    </span>

                    <span className="rounded-full border border-red-800 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-400">
                      ● Live
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <div className="min-w-0">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950/70 font-black text-blue-300">
                        {match.home_team.code}
                      </div>

                      <p className="break-words text-sm font-bold">
                        {match.home_team.name}
                      </p>
                    </div>

                    <div className="whitespace-nowrap text-3xl font-black tabular-nums sm:text-4xl">
                      {match.home_score}
                      <span className="mx-2 text-slate-600">:</span>
                      {match.away_score}
                    </div>

                    <div className="min-w-0">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-950/70 font-black text-purple-300">
                        {match.away_team.code}
                      </div>

                      <p className="break-words text-sm font-bold">
                        {match.away_team.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 border-t border-red-900/40 pt-4 text-center text-xs font-bold text-red-400 group-hover:text-red-300">
                    Follow Live Match →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* TABS */}

        <section>
          <div className="mb-7 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
            {(
              [
                {
                  value: "fixtures",
                  label: "Rounds & Fixtures",
                },
                {
                  value: "teams",
                  label: "Registered Teams",
                },
                {
                  value: "standings",
                  label: "League Table",
                },
                // NEW TAB
                {
                  value: "scorers",
                  label: "⚽ Top Scorers",
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedTab(tab.value)}
                className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
                  selectedTab === tab.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* FIXTURES TAB */}

          {selectedTab === "fixtures" && (
            <div className="space-y-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                  Match Schedule
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Rounds & Fixtures
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {scheduledMatches.length} upcoming ·{" "}
                  {liveMatches.length} live ·{" "}
                  {finishedMatches.length} completed
                </p>
              </div>

              {rounds.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
                  No rounds have been created yet.
                </div>
              ) : (
                rounds.map((round) => (
                  <div
                    key={round.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-800/40 px-6 py-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                          Round {round.order_number}
                        </p>

                        <h3 className="mt-2 text-xl font-black">
                          {round.name}
                        </h3>
                      </div>

                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-400">
                        {round.matches.length}{" "}
                        {round.matches.length === 1
                          ? "Match"
                          : "Matches"}
                      </span>
                    </div>

                    {round.matches.length === 0 ? (
                      <div className="px-6 py-8 text-sm text-slate-500">
                        No matches scheduled for this round.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {round.matches.map((match) => (
                          <Link
                            key={match.id}
                            href={`/matches/${match.id}`}
                            className="group block px-5 py-5 transition hover:bg-slate-800/50 sm:px-6"
                          >
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                              <span className="text-xs text-slate-500">
                                {formatDateTime(
                                  match.scheduled_at
                                )}
                              </span>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${matchStatusStyle(
                                  match.status
                                )}`}
                              >
                                {matchStatusLabel(match.status)}
                              </span>
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-bold sm:text-base">
                                  {match.home_team.name}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {match.home_team.code}
                                </p>
                              </div>

                              <div className="whitespace-nowrap text-2xl font-black tabular-nums sm:text-3xl">
                                {match.home_score}

                                <span className="mx-2 text-slate-600">
                                  :
                                </span>

                                {match.away_score}

                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                  {match.status === "scheduled"
                                    ? "VS"
                                    : match.status === "live"
                                      ? "LIVE"
                                      : "FT"}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="break-words text-sm font-bold sm:text-base">
                                  {match.away_team.name}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {match.away_team.code}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500">
                              <span>
                                📍 {match.venue || "Venue TBA"}
                              </span>

                              <span className="font-bold text-blue-400 group-hover:text-blue-300">
                                Match Details →
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TEAMS TAB */}

          {selectedTab === "teams" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Tournament Participants
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Registered Teams
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {event.teams.length} teams enrolled in this
                competition.
              </p>

              {event.teams.length === 0 ? (
                <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
                  No teams have been enrolled yet.
                </div>
              ) : (
                <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {event.teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-900 bg-blue-950/40 text-sm font-black text-blue-300">
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
              )}
            </div>
          )}

          {/* STANDINGS TAB */}

          {selectedTab === "standings" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Competition Rankings
              </p>

              <h2 className="mt-2 text-3xl font-black">
                League Table
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Match points plus awarded reward points.
              </p>

              <div className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-5 py-4">#</th>
                        <th className="px-5 py-4">Team</th>
                        <th className="px-3 py-4 text-center">P</th>
                        <th className="px-3 py-4 text-center">W</th>
                        <th className="px-3 py-4 text-center">D</th>
                        <th className="px-3 py-4 text-center">L</th>
                        <th className="px-3 py-4 text-center">GF</th>
                        <th className="px-3 py-4 text-center">GA</th>
                        <th className="px-3 py-4 text-center">GD</th>
                        <th className="px-3 py-4 text-center">Reward</th>
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

                          <td className="px-3 py-4 text-center">
                            {standing.played}
                          </td>

                          <td className="px-3 py-4 text-center">
                            {standing.won}
                          </td>

                          <td className="px-3 py-4 text-center">
                            {standing.drawn}
                          </td>

                          <td className="px-3 py-4 text-center">
                            {standing.lost}
                          </td>

                          <td className="px-3 py-4 text-center">
                            {standing.goals_for}
                          </td>

                          <td className="px-3 py-4 text-center">
                            {standing.goals_against}
                          </td>

                          <td className="px-3 py-4 text-center">
                            {standing.goal_difference}
                          </td>

                          <td className="px-3 py-4 text-center text-amber-400">
                            {standing.reward_points}
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
                    No standings available yet.
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                P: Played · W: Won · D: Drawn · L: Lost ·
                GF: Goals For · GA: Goals Against ·
                GD: Goal Difference · Reward: Bonus Points
              </p>
            </div>
          )}

          {/* =========================
              NEW: TOP SCORERS TAB
          ========================= */}

          {selectedTab === "scorers" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Player Rankings
              </p>

              <h2 className="mt-2 text-3xl font-black">
                ⚽ Tournament Top Scorers
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Goals recorded for registered players in this tournament.
                Rankings update with live match events.
              </p>

              <div className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                {topScorers.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-slate-400">
                    No registered player goals have been recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-5 py-4">Rank</th>
                          <th className="px-5 py-4">Player</th>
                          <th className="px-5 py-4">Team</th>
                          <th className="px-5 py-4 text-center">
                            Goals
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {topScorers.map((scorer, index) => (
                          <tr
                            key={scorer.player_id}
                            className="border-b border-slate-800 transition last:border-0 hover:bg-slate-800/40"
                          >
                            <td className="px-5 py-4 font-bold text-slate-400">
                              {index + 1}
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-bold text-white">
                                {scorer.player_name}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                Jersey #{scorer.jersey_number}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-slate-200">
                                {scorer.team_name}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {scorer.team_code}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-center text-xl font-black tabular-nums text-blue-400">
                              {scorer.goals}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Goals without a registered player association are excluded.
              </p>
            </div>
          )}
        </section>

        {/* BOTTOM CTA */}

        <section className="rounded-3xl border border-blue-900 bg-gradient-to-r from-blue-950/60 to-slate-900 px-7 py-11 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
            Follow the Competition
          </p>

          <h2 className="mt-4 text-3xl font-black">
            Every Goal. Every Result.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Follow the tournament as matches unfold, with live
            scores, match events and updated league standings.
          </p>

          <Link
            href="/live"
            className="mt-7 inline-block rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold hover:bg-blue-500"
          >
            Open Live Scoreboard →
          </Link>
        </section>
      </div>
    </main>
  );
}