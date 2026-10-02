
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface Match {
  id: number;
  round: number;
  home_team: number;
  away_team: number;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  started_at: string | null;
  ended_at: string | null;
  home_score: number;
  away_score: number;
}

interface EventTeam {
  id: number;
  team_id: number;
  team: Team;
}

interface MatchEvent {
  id: number;
  team: number;
  type:
    | "goal"
    | "yellow_card"
    | "red_card"
    | "penalty_kick"
    | "reward";
  player_name: string;
  minute: number;
  points: number;
  note: string;
  created_at: string;
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON from ${response.url} (HTTP ${response.status}).`
    );
  }
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to initialize CSRF protection.");
  }

  const csrfMatch = document.cookie.match(
    /(?:^|;\s*)csrftoken=([^;]+)/
  );

  if (!csrfMatch) {
    throw new Error("CSRF token was not found.");
  }

  return decodeURIComponent(csrfMatch[1]);
}

function eventLabel(type: MatchEvent["type"]) {
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

function eventIcon(type: MatchEvent["type"]) {
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

export default function MatchControlPage() {
  const params = useParams();
  const router = useRouter();

  const matchId = params.id;

  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const [goalTeam, setGoalTeam] = useState("");
  const [goalPlayer, setGoalPlayer] = useState("");
  const [goalMinute, setGoalMinute] = useState("");

  const [eventTeam, setEventTeam] = useState("");
  const [eventType, setEventType] = useState<
    "yellow_card" | "red_card" | "penalty_kick" | "reward"
  >("yellow_card");
  const [eventPlayer, setEventPlayer] = useState("");
  const [eventMinute, setEventMinute] = useState("");
  const [eventPoints, setEventPoints] = useState("");
  const [eventNote, setEventNote] = useState("");

  async function loadMatch() {
    const response = await fetch(
      `${API_BASE_URL}/admin/matches/${matchId}/`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load match.");
    }

    return readJson(response);
  }

  async function loadEvents() {
    const response = await fetch(
      `${API_BASE_URL}/matches/${matchId}/events/`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load match events.");
    }

    return readJson(response);
  }

  async function loadEventTeams(roundId: number) {
    const roundResponse = await fetch(
      `${API_BASE_URL}/admin/rounds/${roundId}/`,
      {
        credentials: "include",
      }
    );

    if (!roundResponse.ok) {
      return [];
    }

    const round = await readJson(roundResponse);

    const response = await fetch(
      `${API_BASE_URL}/admin/event-teams/?event=${round.event}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await readJson(response);

    return data.results || data;
  }

  async function refresh() {
    try {
      setError("");

      const loadedMatch = await loadMatch();
      setMatch(loadedMatch);

      const loadedEvents = await loadEvents();
      setEvents(loadedEvents);

      const teams = await loadEventTeams(loadedMatch.round);
      setEventTeams(teams);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load match."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    const socket = new WebSocket(
      `ws://localhost:8000/ws/matches/${matchId}/`
    );

    socket.onopen = () => {
      setSocketConnected(true);
      console.log("Admin match WebSocket connected");
    };

    socket.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);

        console.log("WebSocket update:", data);

        if (data.type === "connection") {
          return;
        }

        setMatch((currentMatch) => {
          if (!currentMatch) {
            return currentMatch;
          }

          return {
            ...currentMatch,
            status: data.status,
            home_score: data.home_score,
            away_score: data.away_score,
          };
        });

        if (data.match_event) {
          setEvents((currentEvents) => {
            const alreadyExists = currentEvents.some(
              (event) => event.id === data.match_event.id
            );

            if (alreadyExists) {
              return currentEvents;
            }

            return [
              ...currentEvents,
              {
                id: data.match_event.id,
                team: data.match_event.team_id,
                type: data.match_event.type,
                player_name: data.match_event.player_name,
                minute: data.match_event.minute,
                points: data.match_event.points,
                note: data.match_event.note,
                created_at: new Date().toISOString(),
              },
            ];
          });
        }
      } catch (err) {
        console.error("Invalid WebSocket message:", err);
      }
    };

    socket.onclose = () => {
      setSocketConnected(false);
      console.log("Admin match WebSocket disconnected");
    };

    socket.onerror = () => {
      setSocketConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [matchId]);

  function teamName(teamId: number) {
    const team = eventTeams.find(
      (item) => item.team_id === teamId
    );

    return team?.team?.name || `Team #${teamId}`;
  }

  function teamCode(teamId: number) {
    const team = eventTeams.find(
      (item) => item.team_id === teamId
    );

    return team?.team?.code || "";
  }

  async function performAction(
    endpoint: string,
    body?: Record<string, unknown>
  ) {
    setActionLoading(true);
    setError("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/matches/${matchId}/${endpoint}/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify(body || {}),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            data?.non_field_errors?.[0] ||
            "Action failed."
        );
      }

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStart() {
    await performAction("start");
  }

  async function handleFinish() {
    await performAction("finish");
  }

  async function handleGoal() {
    if (!goalTeam || !goalMinute) {
      setError("Select a team and enter the goal minute.");
      return;
    }

    await performAction("goal", {
      team_id: Number(goalTeam),
      minute: Number(goalMinute),
      player_name: goalPlayer,
    });

    setGoalPlayer("");
    setGoalMinute("");
  }

  async function handleEvent() {
    if (!eventTeam || !eventMinute) {
      setError("Select a team and enter the event minute.");
      return;
    }

    const body: Record<string, unknown> = {
      team_id: Number(eventTeam),
      event_type: eventType,
      minute: Number(eventMinute),
      player_name: eventPlayer,
      note: eventNote,
    };

    if (eventType === "reward") {
      body.points = Number(eventPoints || 0);
    }

    await performAction("event", body);

    setEventPlayer("");
    setEventMinute("");
    setEventPoints("");
    setEventNote("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-slate-400">
            Loading match control...
          </p>
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <button
            onClick={() => router.push("/admin/matches")}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Back to Matches
          </button>

          <div className="mt-8 rounded-3xl border border-red-900 bg-slate-900 p-8">
            <h1 className="text-2xl font-bold">
              Match Control
            </h1>

            <p className="mt-3 text-red-300">
              {error || "Match not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const homeTeam = teamName(match.home_team);
  const awayTeam = teamName(match.away_team);

  const canStart = match.status === "scheduled";
  const canAddEvents = match.status === "live";
  const canFinish = match.status === "live";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <button
          onClick={() => router.push("/admin/matches")}
          className="mb-8 text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Matches
        </button>

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm uppercase tracking-widest text-blue-400">
              Admin Match Control
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {homeTeam} vs {awayTeam}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Match #{match.id}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {socketConnected && (
              <span className="rounded-full bg-green-950 px-3 py-2 text-xs font-semibold text-green-400">
                ● Realtime connected
              </span>
            )}

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold uppercase ${
                match.status === "live"
                  ? "bg-red-950 text-red-400"
                  : match.status === "finished"
                    ? "bg-slate-800 text-slate-300"
                    : "bg-yellow-950 text-yellow-400"
              }`}
            >
              {match.status}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <div className="text-center">
            <p className="text-sm uppercase tracking-widest text-slate-500">
              Live Scoreboard
            </p>

            <div className="mt-8 flex items-center justify-center gap-5 sm:gap-12">
              <div className="flex-1 text-right">
                <p className="text-lg font-semibold sm:text-2xl">
                  {homeTeam}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {teamCode(match.home_team)}
                </p>
              </div>

              <div className="shrink-0">
                <p className="text-5xl font-bold sm:text-6xl">
                  {match.home_score} - {match.away_score}
                </p>
              </div>

              <div className="flex-1 text-left">
                <p className="text-lg font-semibold sm:text-2xl">
                  {awayTeam}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {teamCode(match.away_team)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-slate-800 pt-6">
            {canStart && (
              <button
                disabled={actionLoading}
                onClick={handleStart}
                className="rounded-xl bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "▶ Start Match"}
              </button>
            )}

            {canFinish && (
              <button
                disabled={actionLoading}
                onClick={handleFinish}
                className="rounded-xl bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "⏹ Finish Match"}
              </button>
            )}

            {match.status === "finished" && (
              <span className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-400">
                Match finished
              </span>
            )}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5">
              <p className="text-sm uppercase tracking-widest text-blue-400">
                Live Action
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                Add Goal
              </h2>

              {!canAddEvents && (
                <p className="mt-2 text-sm text-slate-500">
                  Start the match before recording events.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <select
                value={goalTeam}
                onChange={(e) => setGoalTeam(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select team</option>

                <option value={match.home_team}>
                  {homeTeam}
                </option>

                <option value={match.away_team}>
                  {awayTeam}
                </option>
              </select>

              <input
                type="text"
                placeholder="Player name"
                value={goalPlayer}
                onChange={(e) => setGoalPlayer(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <input
                type="number"
                min="0"
                max="120"
                placeholder="Minute"
                value={goalMinute}
                onChange={(e) => setGoalMinute(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <button
                onClick={handleGoal}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⚽ Add Goal
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5">
              <p className="text-sm uppercase tracking-widest text-blue-400">
                Live Action
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                Add Match Event
              </h2>

              {!canAddEvents && (
                <p className="mt-2 text-sm text-slate-500">
                  Start the match before recording events.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <select
                value={eventTeam}
                onChange={(e) => setEventTeam(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select team</option>

                <option value={match.home_team}>
                  {homeTeam}
                </option>

                <option value={match.away_team}>
                  {awayTeam}
                </option>
              </select>

              <select
                value={eventType}
                onChange={(e) =>
                  setEventType(
                    e.target.value as
                      | "yellow_card"
                      | "red_card"
                      | "penalty_kick"
                      | "reward"
                  )
                }
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="yellow_card">
                  🟨 Yellow Card
                </option>

                <option value="red_card">
                  🟥 Red Card
                </option>

                <option value="penalty_kick">
                  🎯 Penalty Kick
                </option>

                <option value="reward">
                  🏆 Reward
                </option>
              </select>

              <input
                type="text"
                placeholder="Player name"
                value={eventPlayer}
                onChange={(e) => setEventPlayer(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <input
                type="number"
                min="0"
                max="120"
                placeholder="Minute"
                value={eventMinute}
                onChange={(e) => setEventMinute(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              {eventType === "reward" && (
                <input
                  type="number"
                  placeholder="Bonus points"
                  value={eventPoints}
                  onChange={(e) => setEventPoints(e.target.value)}
                  disabled={!canAddEvents || actionLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}

              <input
                type="text"
                placeholder="Reason / note"
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <button
                onClick={handleEvent}
                disabled={!canAddEvents || actionLoading}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Event
              </button>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-blue-400">
                Match Activity
              </p>

              <h2 className="mt-1 text-2xl font-semibold">
                Event Timeline
              </h2>
            </div>

            {socketConnected && (
              <span className="text-xs font-semibold text-green-400">
                ● Realtime
              </span>
            )}
          </div>

          {events.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center">
              <p className="text-slate-500">
                No events recorded yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800">
                    {eventIcon(event.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {eventLabel(event.type)}
                      </span>

                      <span className="text-sm text-blue-400">
                        {event.minute}'
                      </span>

                      <span className="text-sm text-slate-500">
                        {teamName(event.team)}
                      </span>
                    </div>

                    {event.player_name && (
                      <p className="mt-1 text-sm text-slate-300">
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
                        <p className="mt-1 text-sm font-semibold text-yellow-400">
                          +{event.points} reward points
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

