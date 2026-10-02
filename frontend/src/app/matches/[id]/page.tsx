
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
  status?: Match["status"];
  home_score?: number;
  away_score?: number;
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

  return new Date(value).toLocaleString();
}

export default function MatchPage() {
  const params = useParams();
  const matchId = Number(params.id);

  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    async function initialize() {
      if (!Number.isInteger(matchId) || matchId <= 0) {
        setError("Invalid match ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [matchResponse, eventsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/matches/${matchId}/`, {
            cache: "no-store",
          }),
          fetch(`${API_BASE_URL}/matches/${matchId}/events/`, {
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

        const matchData: Match = await matchResponse.json();
        const eventsData = await eventsResponse.json();

        if (cancelled) {
          return;
        }

        setMatch(matchData);
        setEvents(
          Array.isArray(eventsData)
            ? eventsData
            : eventsData.results ?? []
        );

        socket = new WebSocket(
          `${WS_BASE_URL}/ws/matches/${matchId}/`
        );

        socket.onopen = () => {
          if (!cancelled) {
            setSocketConnected(true);
          }

          // Synchronize once after connecting so updates occurring
          // during the initial page load are not missed.
          void Promise.all([
            fetch(`${API_BASE_URL}/matches/${matchId}/`, {
              cache: "no-store",
            }),
            fetch(`${API_BASE_URL}/matches/${matchId}/events/`, {
              cache: "no-store",
            }),
          ])
            .then(async ([latestMatch, latestEvents]) => {
              if (!latestMatch.ok || !latestEvents.ok) {
                return;
              }

              const updatedMatch: Match = await latestMatch.json();
              const updatedEvents = await latestEvents.json();

              if (cancelled) {
                return;
              }

              setMatch(updatedMatch);

              const latestList: MatchEvent[] = Array.isArray(updatedEvents)
                ? updatedEvents
                : updatedEvents.results ?? [];

              setEvents((current) => {
                const merged = new Map<number, MatchEvent>();

                latestList.forEach((item) => {
                  merged.set(item.id, item);
                });

                current.forEach((item) => {
                  if (!merged.has(item.id)) {
                    merged.set(item.id, item);
                  }
                });

                return Array.from(merged.values()).sort(
                  (a, b) =>
                    a.minute - b.minute ||
                    a.id - b.id
                );
              });
            })
            .catch((err) => {
              console.error("Match synchronization failed:", err);
            });
        };

        socket.onmessage = (message) => {
          try {
            const data: SocketUpdate = JSON.parse(message.data);

            if (data.type === "connection") {
              return;
            }

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
              };
            });

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

                return [...current, newEvent].sort(
                  (a, b) =>
                    a.minute - b.minute ||
                    a.id - b.id
                );
              });
            }
          } catch (err) {
            console.error("Invalid WebSocket message:", err);
          }
        };

        socket.onclose = () => {
          if (!cancelled) {
            setSocketConnected(false);
          }
        };

        socket.onerror = () => {
          if (!cancelled) {
            setSocketConnected(false);
          }
        };
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load match."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [matchId]);

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
