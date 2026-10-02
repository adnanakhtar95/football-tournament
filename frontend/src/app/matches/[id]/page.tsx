
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const WS_BASE_URL = API_BASE_URL
  .replace(/^http/, "ws")
  .replace(/\/api\/?$/, "");

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

interface MatchEvent {
  id: number;
  team: number;
  type: string;
  player_name: string;
  minute: number;
  points: number;
  note: string;
  created_at: string;
}

interface SocketMatchEvent {
  id: number;
  team_id: number;
  type: string;
  player_name: string;
  minute: number;
  points: number;
  note: string;
}

interface SocketUpdate {
  type: string;
  event?: string;
  match_id?: number;
  status?: Match["status"];
  home_score?: number;
  away_score?: number;
  started_at?: string | null;
  ended_at?: string | null;
  match_event?: SocketMatchEvent;
}

function eventLabel(type: string): string {
  switch (type) {
    case "goal":
      return "Goal";
    case "yellow_card":
      return "Yellow Card";
    case "red_card":
      return "Red Card";
    case "penalty_kick":
      return "Penalty Kick";
    case "reward":
      return "Reward";
    default:
      return type;
  }
}

function eventSymbol(type: string): string {
  switch (type) {
    case "goal":
      return "⚽";
    case "yellow_card":
      return "🟨";
    case "red_card":
      return "🟥";
    case "penalty_kick":
      return "🎯";
    case "reward":
      return "🏆";
    default:
      return "•";
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

function normalizeEvents(data: unknown): MatchEvent[] {
  if (Array.isArray(data)) {
    return data as MatchEvent[];
  }

  if (
    data !== null &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray(data.results)
  ) {
    return data.results as MatchEvent[];
  }

  return [];
}

function sortEvents(items: MatchEvent[]): MatchEvent[] {
  return [...items].sort(
    (a, b) => a.minute - b.minute || a.id - b.id
  );
}

export default function MatchPage() {
  const params = useParams();

  const rawId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const matchId = Number(rawId);

  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    // Prevent an older API response from overwriting a newer one.
    let refreshSequence = 0;

    if (!Number.isInteger(matchId) || matchId <= 0) {
      setError("Invalid match ID.");
      setLoading(false);
      return;
    }

    const matchUrl = `${API_BASE_URL}/matches/${matchId}/`;
    const eventsUrl = `${API_BASE_URL}/matches/${matchId}/events/`;
    const socketUrl = `${WS_BASE_URL}/ws/matches/${matchId}/`;

    /*
     * Fetch the latest match details and timeline.
     * This ensures started_at and ended_at update
     * even when the WebSocket payload only contains scores.
     */
    async function refreshMatch(showLoader = false) {
      const sequence = ++refreshSequence;

      try {
        if (showLoader) {
          setLoading(true);
          setError("");
        }

        const [matchResponse, eventsResponse] = await Promise.all([
          fetch(matchUrl, {
            cache: "no-store",
          }),
          fetch(eventsUrl, {
            cache: "no-store",
          }),
        ]);

        if (!matchResponse.ok) {
          throw new Error(
            `Unable to load match (HTTP ${matchResponse.status}).`
          );
        }

        if (!eventsResponse.ok) {
          throw new Error(
            `Unable to load match events (HTTP ${eventsResponse.status}).`
          );
        }

        const updatedMatch: Match = await matchResponse.json();
        const eventsData: unknown = await eventsResponse.json();

        if (cancelled || sequence !== refreshSequence) {
          return;
        }

        setMatch(updatedMatch);

        const latestEvents = normalizeEvents(eventsData);

        setEvents((current) => {
          const merged = new Map<number, MatchEvent>();

          latestEvents.forEach((item) => {
            merged.set(item.id, item);
          });

          // Preserve any realtime event received while
          // the API request was still in progress.
          current.forEach((item) => {
            if (!merged.has(item.id)) {
              merged.set(item.id, item);
            }
          });

          return sortEvents(Array.from(merged.values()));
        });

        setError("");
      } catch (err) {
        if (cancelled || sequence !== refreshSequence) {
          return;
        }

        console.error("Match synchronization failed:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load match."
        );
      } finally {
        if (!cancelled && sequence === refreshSequence && showLoader) {
          setLoading(false);
        }
      }
    }

    /*
     * Debounce refresh requests.
     * Multiple WebSocket events arriving close together
     * will trigger one fresh API synchronization.
     */
    function scheduleRefresh() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;

        if (!cancelled) {
          void refreshMatch();
        }
      }, 200);
    }

    /*
     * WebSocket connection.
     */
    function connectSocket() {
      if (cancelled) {
        return;
      }

      const currentSocket = new WebSocket(socketUrl);
      socket = currentSocket;

      /*
       * React Strict Mode may unmount the component
       * while the WebSocket is still CONNECTING.
       *
       * Instead of closing a CONNECTING socket immediately,
       * close it after its connection opens.
       */
      currentSocket.addEventListener("open", () => {
        if (cancelled) {
          currentSocket.close(1000, "Component unmounted");
        }
      });

      currentSocket.onopen = () => {
        if (cancelled) {
          return;
        }

        setSocketConnected(true);

        // Recover updates missed during initial loading
        // or while the connection was disconnected.
        scheduleRefresh();
      };

      currentSocket.onmessage = (message: MessageEvent) => {
        if (cancelled) {
          return;
        }

        try {
          const data: SocketUpdate = JSON.parse(message.data);

          if (data.type === "connection") {
            return;
          }

          if (
            data.match_id !== undefined &&
            Number(data.match_id) !== matchId
          ) {
            return;
          }

          /*
           * Immediately update the visible scoreboard.
           */
          setMatch((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,

              status: data.status ?? current.status,

              home_score:
                data.home_score ?? current.home_score,

              away_score:
                data.away_score ?? current.away_score,

              started_at:
                data.started_at !== undefined
                  ? data.started_at
                  : current.started_at,

              ended_at:
                data.ended_at !== undefined
                  ? data.ended_at
                  : current.ended_at,
            };
          });

          /*
           * Immediately append a new timeline event.
           * Duplicate IDs are ignored.
           */
          if (data.match_event) {
            const incoming = data.match_event;

            const newEvent: MatchEvent = {
              id: incoming.id,
              team: incoming.team_id,
              type: incoming.type,
              player_name: incoming.player_name,
              minute: incoming.minute,
              points: incoming.points,
              note: incoming.note,
              created_at: new Date().toISOString(),
            };

            setEvents((current) => {
              if (
                current.some((item) => item.id === newEvent.id)
              ) {
                return current;
              }

              return sortEvents([...current, newEvent]);
            });
          }

          /*
           * IMPORTANT FIX:
           *
           * Fetch the complete match after each update.
           * This synchronizes:
           *
           * - started_at
           * - ended_at
           * - status
           * - scores
           * - event timeline
           *
           * No browser reload is required.
           */
          scheduleRefresh();
        } catch (err) {
          console.error("Invalid WebSocket message:", err);
        }
      };

      currentSocket.onerror = () => {
        if (!cancelled) {
          setSocketConnected(false);
        }
      };

      currentSocket.onclose = () => {
        if (cancelled) {
          return;
        }

        setSocketConnected(false);

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;

          if (!cancelled) {
            connectSocket();
          }
        }, 3000);
      };
    }

    /*
     * Initial page load.
     */
    async function initialize() {
      await refreshMatch(true);

      if (!cancelled) {
        connectSocket();
      }
    }

    void initialize();

    /*
     * Cleanup.
     */
    return () => {
      cancelled = true;

      refreshSequence += 1;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
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

        // A CONNECTING socket is handled by its open listener.
      }
    };
  }, [matchId]);

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
            Loading match...
          </div>
        </div>
      </main>
    );
  }

  /*
   * Match not found.
   */
  if (!match) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link
            href="/live"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Back to Live Scoreboard
          </Link>

          <div className="mt-8 rounded-3xl border border-red-900 bg-slate-900 p-8">
            <h1 className="text-2xl font-bold">
              Match Not Found
            </h1>

            <p className="mt-3 text-red-300">
              {error || "Unable to load this match."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const homeTeam = match.home_team;
  const awayTeam = match.away_team;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {/* Navigation */}

        <div className="mb-8 flex flex-wrap items-center gap-5">
          <Link
            href="/live"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            ← Live Scoreboard
          </Link>

          <Link
            href="/events"
            className="text-sm text-slate-400 hover:text-white"
          >
            Browse Events
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {error}
          </div>
        )}

        {/* Match Header */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-5 sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                Football Tournament
              </p>

              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                Match #{match.id}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-2 text-xs font-semibold ${
                  socketConnected
                    ? "bg-green-950 text-green-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {socketConnected
                  ? "● Realtime Connected"
                  : "○ Realtime Disconnected"}
              </span>

              <span
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${
                  match.status === "live"
                    ? "bg-red-950 text-red-400"
                    : match.status === "finished"
                      ? "bg-slate-800 text-slate-300"
                      : "bg-yellow-950 text-yellow-400"
                }`}
              >
                {match.status === "live" && "● "}
                {match.status}
              </span>
            </div>
          </div>

          {/* Scoreboard */}

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-12 text-center sm:gap-10 sm:px-10">
            {/* Home Team */}

            <div className="min-w-0">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-lg font-bold text-blue-400">
                {homeTeam.code}
              </div>

              <h2 className="break-words text-base font-semibold sm:text-2xl">
                {homeTeam.name}
              </h2>

              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                Home
              </p>
            </div>

            {/* Score */}

            <div>
              <p className="whitespace-nowrap text-4xl font-extrabold tracking-tight sm:text-7xl">
                {match.home_score}

                <span className="mx-2 text-slate-600 sm:mx-5">
                  :
                </span>

                {match.away_score}
              </p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {match.status === "live"
                  ? "In Progress"
                  : match.status === "finished"
                    ? "Full Time"
                    : "Not Started"}
              </p>
            </div>

            {/* Away Team */}

            <div className="min-w-0">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-lg font-bold text-blue-400">
                {awayTeam.code}
              </div>

              <h2 className="break-words text-base font-semibold sm:text-2xl">
                {awayTeam.name}
              </h2>

              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                Away
              </p>
            </div>
          </div>

          {/* Match Information */}

          <div className="grid gap-6 border-t border-slate-800 bg-slate-950/30 px-6 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Venue
              </p>

              <p className="mt-2 text-sm font-medium">
                {match.venue || "Not specified"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Scheduled
              </p>

              <p className="mt-2 text-sm font-medium">
                {formatDate(match.scheduled_at)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Started
              </p>

              <p className="mt-2 text-sm font-medium">
                {formatDate(match.started_at)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Finished
              </p>

              <p className="mt-2 text-sm font-medium">
                {formatDate(match.ended_at)}
              </p>
            </div>
          </div>
        </section>

        {/* Event Timeline */}

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                Match Activity
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Event Timeline
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Goals, cards, penalties and rewards.
              </p>
            </div>

            <span className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300">
              {events.length} Events
            </span>
          </div>

          {events.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-10 text-center">
              <p className="text-4xl">⚽</p>

              <h3 className="mt-4 text-lg font-semibold">
                No Events Recorded
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Match events will appear here as they happen.
              </p>
            </div>
          ) : (
            <div className="mt-7 space-y-3">
              {events.map((event) => {
                const team =
                  event.team === homeTeam.id
                    ? homeTeam
                    : event.team === awayTeam.id
                      ? awayTeam
                      : null;

                return (
                  <article
                    key={event.id}
                    className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 transition hover:border-slate-700 sm:p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xl">
                      {eventSymbol(event.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold">
                          {eventLabel(event.type)}
                        </span>

                        <span className="rounded-lg bg-blue-950 px-2.5 py-1 text-xs font-bold text-blue-400">
                          {event.minute}&apos;
                        </span>

                        <span className="text-sm text-slate-400">
                          {team?.name || `Team #${event.team}`}
                        </span>
                      </div>

                      {event.player_name && (
                        <p className="mt-2 text-sm text-slate-200">
                          {event.player_name}
                        </p>
                      )}

                      {event.note && (
                        <p className="mt-1 text-sm text-slate-500">
                          {event.note}
                        </p>
                      )}

                      {event.type === "reward" &&
                        event.points !== 0 && (
                          <p className="mt-2 text-sm font-semibold text-yellow-400">
                            +{event.points} Bonus Points
                          </p>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System
        </footer>
      </div>
    </main>
  );
}
