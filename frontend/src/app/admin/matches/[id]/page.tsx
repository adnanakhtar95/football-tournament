"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}
interface Player {
  id: number;
  team: Team;
  full_name: string;
  jersey_number: number;
  position: string;
  is_active: boolean;
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
  event_id?: number;
  team_id: number;
  team: Team;
}
type MatchEventType =
  | "goal"
  | "yellow_card"
  | "red_card"
  | "penalty_kick"
  | "reward";
type OtherEventType = Exclude<MatchEventType, "goal">;
interface MatchEvent {
  id: number;
  team: number;
  type: MatchEventType;
  player_name: string;
  minute: number;
  points: number;
  note: string;
  created_at: string;
}
interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
  status?: Match["status"];
  home_score?: number;
  away_score?: number;
  match_event?: {
    id: number;
    team_id: number;
    type: MatchEventType;
    player_name: string;
    player_id?: number | null;
    minute: number;
    points: number;
    note: string;
  };
}
const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40";
const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400";
function getCookie(name: string): string | null {
  for (const cookie of document.cookie.split(";")) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }
  return null;
}
async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Unable to initialize CSRF protection.");
  }
  const token = getCookie("csrftoken");
  if (!token) {
    throw new Error("CSRF token was not found. Please refresh.");
  }
  return token;
}
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON from ${response.url} (HTTP ${response.status}).`
    );
  }
}
function apiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  if (typeof record.error === "string") return record.error;
  return (
    Object.entries(record)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value);
        return `${key}: ${message}`;
      })
      .join(" | ") || fallback
  );
}
async function fetchAllPages<T>(initialUrl: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = initialUrl;
  while (nextUrl !== null) {
    const currentUrl: string = nextUrl;
    const response = await fetch(currentUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(apiError(data, "Unable to load records."));
    }
    if (Array.isArray(data)) {
      items.push(...(data as T[]));
      nextUrl = null;
    } else {
      const result = data as {
        results?: T[];
        next?: string | null;
      };
      items.push(...(result.results ?? []));
      nextUrl = result.next
        ? new URL(result.next, currentUrl).toString()
        : null;
    }
  }
  return items;
}
function eventLabel(type: MatchEventType): string {
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
  }
}
function eventIcon(type: MatchEventType): string {
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
  }
}
function eventStyle(type: MatchEventType): string {
  switch (type) {
    case "goal":
      return "border-blue-800 bg-blue-950/40";
    case "yellow_card":
      return "border-yellow-900 bg-yellow-950/20";
    case "red_card":
      return "border-red-900 bg-red-950/20";
    case "penalty_kick":
      return "border-purple-900 bg-purple-950/20";
    case "reward":
      return "border-amber-900 bg-amber-950/20";
  }
}
function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}
function validMinute(value: string): boolean {
  if (value.trim() === "") return false;
  const minute = Number(value);
  return (
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 120
  );
}
export default function MatchControlPage() {
  const params = useParams();
  const matchId = String(params.id ?? "");
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  // Goal form
  const [goalTeam, setGoalTeam] = useState("");
  const [goalPlayer, setGoalPlayer] = useState("");
  const [goalPlayerId, setGoalPlayerId] = useState("");
  const [goalMinute, setGoalMinute] = useState("");
  // Other event form
  const [eventTeam, setEventTeam] = useState("");
  const [eventType, setEventType] =
    useState<OtherEventType>("yellow_card");
  const [eventPlayer, setEventPlayer] = useState("");
  const [eventMinute, setEventMinute] = useState("");
  const [eventPoints, setEventPoints] = useState("");
  const [eventNote, setEventNote] = useState("");
  const refresh = useCallback(
    async (showLoading = false) => {
      if (!matchId) return;
      if (showLoading) setRefreshing(true);
      try {
        const matchResponse = await fetch(
          `${API_BASE_URL}/admin/matches/${matchId}/`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );
        const matchData = await readJson(matchResponse);
        if (!matchResponse.ok) {
          throw new Error(
            apiError(matchData, "Unable to load match.")
          );
        }
        const loadedMatch = matchData as Match;
        const [loadedEvents, roundResponse, homePlayers, awayPlayers] = await Promise.all([
          fetchAllPages<MatchEvent>(
            `${API_BASE_URL}/matches/${matchId}/events/`
          ),
          fetch(
            `${API_BASE_URL}/admin/rounds/${loadedMatch.round}/`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          ),
          fetchAllPages<Player>(
            `${API_BASE_URL}/players/?team=${loadedMatch.home_team}`
          ),
          fetchAllPages<Player>(
            `${API_BASE_URL}/players/?team=${loadedMatch.away_team}`
          ),
        ]);
        if (!roundResponse.ok) {
          throw new Error("Unable to load the match round.");
        }
        const roundData = (await readJson(roundResponse)) as {
          id: number;
          event: number;
        };
        const registrations = await fetchAllPages<EventTeam>(
          `${API_BASE_URL}/admin/event-teams/?event_id=${roundData.event}`
        );
        setMatch(loadedMatch);
        setEvents(loadedEvents);
        setPlayers(
          [...homePlayers, ...awayPlayers].filter(
            (player, index, all) =>
              all.findIndex((item) => item.id === player.id) === index
          )
        );
        setEventTeams(
          registrations.filter(
            (item) =>
              item.event_id === undefined ||
              item.event_id === roundData.event
          )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to refresh match."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [matchId]
  );
  // Initial load and realtime connection
  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    void refresh();
    function connect() {
      if (!active) return;
      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const backendUrl = new URL(API_BASE_URL);
      const socketUrl =
        `${protocol}//${backendUrl.host}/ws/matches/${matchId}/`;
      socket = new WebSocket(socketUrl);
      socket.onopen = () => {
        if (!active) return;
        setSocketConnected(true);
        // Recover any updates missed while disconnected.
        void refresh();
      };
      socket.onmessage = (message) => {
        if (!active) return;
        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;
          if (data.type === "connection") return;
          if (
            data.match_id !== undefined &&
            data.match_id !== Number(matchId)
          ) {
            return;
          }
          setMatch((current) => {
            if (!current) return current;
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
            setEvents((current) => {
              if (
                current.some(
                  (event) => event.id === incoming.id
                )
              ) {
                return current;
              }
              return [
                ...current,
                {
                  id: incoming.id,
                  team: incoming.team_id,
                  type: incoming.type,
                  player_name: incoming.player_name,
                  minute: incoming.minute,
                  points: incoming.points,
                  note: incoming.note,
                  created_at: new Date().toISOString(),
                },
              ];
            });
          }
          // Refresh lifecycle timestamps when a match
          // starts or finishes.
          if (
            data.event === "match_started" ||
            data.event === "match_finished"
          ) {
            void refresh();
          }
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setSocketConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => {
        if (!active) return;
        setSocketConnected(false);
      };
    }
    connect();
    return () => {
      active = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [matchId, refresh]);
  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();
    for (const registration of eventTeams) {
      map.set(registration.team_id, registration.team);
    }
    return map;
  }, [eventTeams]);
  const timeline = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          a.minute - b.minute ||
          a.id - b.id
      ),
    [events]
  );
  function teamName(teamId: number): string {
    return teamMap.get(teamId)?.name ?? `Team #${teamId}`;
  }
  function teamCode(teamId: number): string {
    return teamMap.get(teamId)?.code ?? "";
  }
  async function performAction(
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<boolean> {
    if (actionLoading) return false;
    setActionLoading(true);
    setError("");
    setSuccess("");
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
          body: JSON.stringify(body ?? {}),
        }
      );
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(
          apiError(data, "Unable to perform match action.")
        );
      }
      await refresh();
      setSuccess(
        endpoint === "start"
          ? "Match started successfully."
          : endpoint === "finish"
            ? "Match finished successfully."
            : endpoint === "goal"
              ? "Goal recorded successfully."
              : "Match event recorded successfully."
      );
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Match action failed."
      );
      return false;
    } finally {
      setActionLoading(false);
    }
  }
  async function handleStart() {
    await performAction("start");
  }
  async function handleFinish() {
    if (
      !window.confirm(
        "Finish this match? No further goals or match events can be added afterward."
      )
    ) {
      return;
    }
    await performAction("finish");
  }
  async function handleGoal() {
    if (!goalTeam) {
      setError("Please select the scoring team.");
      return;
    }
    if (!validMinute(goalMinute)) {
      setError("Goal minute must be between 0 and 120.");
      return;
    }
    const successful = await performAction("goal", {
      team_id: Number(goalTeam),
      player_name: goalPlayerId ? "" : goalPlayer.trim(),
      ...(goalPlayerId ? { player_id: Number(goalPlayerId) } : {}),
      minute: Number(goalMinute),
    });
    if (successful) {
      setGoalPlayer("");
      setGoalPlayerId("");
      setGoalMinute("");
    }
  }
  async function handleEvent() {
    if (!eventTeam) {
      setError("Please select a team.");
      return;
    }
    if (!validMinute(eventMinute)) {
      setError("Event minute must be between 0 and 120.");
      return;
    }
    if (
      eventType === "reward" &&
      (!eventPoints.trim() ||
        !Number.isInteger(Number(eventPoints)) ||
        Number(eventPoints) <= 0)
    ) {
      setError("Reward points must be a positive whole number.");
      return;
    }
    if (eventType === "reward" && !eventNote.trim()) {
      setError("Please enter a reason for the reward.");
      return;
    }
    const body: Record<string, unknown> = {
      team_id: Number(eventTeam),
      event_type: eventType,
      player_name: eventPlayer.trim(),
      minute: Number(eventMinute),
      note: eventNote.trim(),
    };
    if (eventType === "reward") {
      body.points = Number(eventPoints);
    }
    const successful = await performAction("event", body);
    if (successful) {
      setEventPlayer("");
      setEventMinute("");
      setEventPoints("");
      setEventNote("");
    }
  }
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-slate-800 border-t-blue-500" />
          <p className="mt-5 text-sm text-slate-400">
            Loading match control room...
          </p>
        </div>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/admin/matches"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            ← Back to Matches
          </Link>
          <div className="mt-8 rounded-3xl border border-red-900 bg-slate-900 p-8">
            <h1 className="text-2xl font-bold">
              Unable to Load Match
            </h1>
            <p className="mt-3 text-sm text-red-300">
              {error || "Match not found."}
            </p>
            <button
              type="button"
              onClick={() => void refresh(true)}
              className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }
  const homeTeam = teamName(match.home_team);
  const awayTeam = teamName(match.away_team);
  const isScheduled = match.status === "scheduled";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const formDisabled = !isLive || actionLoading;
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
        {/* Navigation */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/matches"
            className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
          >
            ← Back to Matches
          </Link>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                socketConnected
                  ? "border-green-900 bg-green-950/40 text-green-400"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              }`}
            >
              {socketConnected
                ? "● Realtime Connected"
                : "○ Reconnecting..."}
            </span>
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-blue-500 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </div>
        {/* Page heading */}
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            Tournament Administration / Live Operations
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Match Control Room
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Match #{match.id} · {match.venue || "Venue not specified"}
          </p>
        </header>
        {/* Feedback */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-900 bg-red-950/40 px-5 py-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-green-900 bg-green-950/30 px-5 py-4 text-sm text-green-300"
          >
            {success}
          </div>
        )}
        {/* Scoreboard */}
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Official Match Scoreboard
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {formatDate(match.scheduled_at)}
              </p>
            </div>
            <span
              className={`rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-widest ${
                isLive
                  ? "border-red-800 bg-red-950/50 text-red-400"
                  : isFinished
                    ? "border-green-900 bg-green-950/40 text-green-400"
                    : "border-amber-900 bg-amber-950/30 text-amber-400"
              }`}
            >
              {isLive
                ? "● Live"
                : isFinished
                  ? "Full Time"
                  : "Scheduled"}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-12 sm:gap-8 sm:px-12">
            {/* Home */}
            <div className="min-w-0 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-800 bg-blue-950/40 text-xl font-extrabold text-blue-300 sm:h-20 sm:w-20 sm:text-2xl">
                {teamCode(match.home_team).slice(0, 3) || "H"}
              </div>
              <h2 className="mt-5 break-words text-sm font-bold sm:text-xl">
                {homeTeam}
              </h2>
              <p className="mt-2 text-xs uppercase tracking-wider text-slate-500">
                Home
              </p>
            </div>
            {/* Score */}
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {isFinished
                  ? "FT"
                  : isLive
                    ? "LIVE"
                    : "VS"}
              </p>
              <div className="mt-3 whitespace-nowrap text-4xl font-black tabular-nums tracking-tight sm:text-7xl">
                {match.home_score}
                <span className="mx-2 text-slate-600 sm:mx-4">
                  :
                </span>
                {match.away_score}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Match #{match.id}
              </p>
            </div>
            {/* Away */}
            <div className="min-w-0 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-800 bg-purple-950/40 text-xl font-extrabold text-purple-300 sm:h-20 sm:w-20 sm:text-2xl">
                {teamCode(match.away_team).slice(0, 3) || "A"}
              </div>
              <h2 className="mt-5 break-words text-sm font-bold sm:text-xl">
                {awayTeam}
              </h2>
              <p className="mt-2 text-xs uppercase tracking-wider text-slate-500">
                Away
              </p>
            </div>
          </div>
          {/* Match lifecycle controls */}
          <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {isScheduled && (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={actionLoading}
                  className="rounded-xl bg-green-600 px-8 py-3 text-sm font-bold transition hover:bg-green-500 disabled:opacity-50"
                >
                  {actionLoading
                    ? "Processing..."
                    : "▶ Start Match"}
                </button>
              )}
              {isLive && (
                <button
                  type="button"
                  onClick={() => void handleFinish()}
                  disabled={actionLoading}
                  className="rounded-xl bg-red-600 px-8 py-3 text-sm font-bold transition hover:bg-red-500 disabled:opacity-50"
                >
                  {actionLoading
                    ? "Processing..."
                    : "■ Finish Match"}
                </button>
              )}
              {isFinished && (
                <span className="rounded-xl border border-green-900 bg-green-950/30 px-6 py-3 text-sm font-semibold text-green-300">
                  ✓ Match Completed
                </span>
              )}
              <Link
                href={`/matches/${match.id}`}
                className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-white"
              >
                Public Match View ↗
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-slate-500">
              <span>
                Started: {formatDate(match.started_at)}
              </span>
              <span>
                Finished: {formatDate(match.ended_at)}
              </span>
            </div>
          </div>
        </section>
        {/* Main control area */}
        <div className="mt-7 grid items-start gap-7 xl:grid-cols-[1fr_0.85fr]">
          {/* Left column: action forms */}
          <div className="space-y-7">
            {/* Goal control */}
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                    Scoring Control
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    ⚽ Record Goal
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Goals update the scoreboard in realtime.
                  </p>
                </div>
              </div>
              {!isLive && (
                <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
                  {isFinished
                    ? "This match is finished. Goal recording is closed."
                    : "Start the match to enable goal recording."}
                </div>
              )}
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>
                    Scoring Team
                  </label>
                  <select
                    value={goalTeam}
                    onChange={(event) => {
                      setGoalTeam(event.target.value);
                      setGoalPlayerId("");
                      setGoalPlayer("");
                    }}
                    disabled={formDisabled}
                    className={inputClass}
                  >
                    <option value="">Select team</option>
                    <option value={match.home_team}>
                      {homeTeam} (Home)
                    </option>
                    <option value={match.away_team}>
                      {awayTeam} (Away)
                    </option>
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <label className={labelClass}>
                      Registered Scorer
                    </label>
                    <select
                      value={goalPlayerId}
                      onChange={(event) => {
                        setGoalPlayerId(event.target.value);
                        if (event.target.value) setGoalPlayer("");
                      }}
                      disabled={formDisabled || !goalTeam}
                      className={inputClass}
                    >
                      <option value="">Manual name / Unknown player</option>
                      {players
                        .filter(
                          (player) =>
                            player.is_active &&
                            player.team.id === Number(goalTeam)
                        )
                        .sort(
                          (a, b) =>
                            a.jersey_number - b.jersey_number
                        )
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} - {player.full_name}
                          </option>
                        ))}
                    </select>
                    {!goalPlayerId && (
                      <input
                        type="text"
                        value={goalPlayer}
                        onChange={(event) =>
                          setGoalPlayer(event.target.value)
                        }
                        placeholder="Optional manual player name"
                        disabled={formDisabled}
                        className={`${inputClass} mt-3`}
                      />
                    )}
                    {goalTeam &&
                      players.filter(
                        (player) =>
                          player.is_active &&
                          player.team.id === Number(goalTeam)
                      ).length === 0 && (
                        <p className="mt-2 text-xs text-amber-400">
                          No active registered players for this team.
                          You can enter a name manually, but manual goals
                          will not count towards Top Scorers.
                        </p>
                      )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Minute
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="1"
                      value={goalMinute}
                      onChange={(event) =>
                        setGoalMinute(event.target.value)
                      }
                      placeholder="45"
                      disabled={formDisabled}
                      className={inputClass}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGoal()}
                  disabled={formDisabled}
                  className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionLoading
                    ? "Processing..."
                    : "+ Add Goal"}
                </button>
              </div>
            </section>
            {/* Match events */}
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                  Match Operations
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Record Match Event
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Manage cards, penalty kicks and bonus rewards.
                </p>
              </div>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>
                    Select Team
                  </label>
                  <select
                    value={eventTeam}
                    onChange={(event) =>
                      setEventTeam(event.target.value)
                    }
                    disabled={formDisabled}
                    className={inputClass}
                  >
                    <option value="">Select team</option>
                    <option value={match.home_team}>
                      {homeTeam}
                    </option>
                    <option value={match.away_team}>
                      {awayTeam}
                    </option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    Event Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(event) =>
                      setEventType(
                        event.target.value as OtherEventType
                      )
                    }
                    disabled={formDisabled}
                    className={inputClass}
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
                      🏆 Bonus Reward
                    </option>
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <label className={labelClass}>
                      Player Name
                    </label>
                    <input
                      type="text"
                      value={eventPlayer}
                      onChange={(event) =>
                        setEventPlayer(event.target.value)
                      }
                      placeholder="Player name"
                      disabled={formDisabled}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Minute
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="1"
                      value={eventMinute}
                      onChange={(event) =>
                        setEventMinute(event.target.value)
                      }
                      placeholder="60"
                      disabled={formDisabled}
                      className={inputClass}
                    />
                  </div>
                </div>
                {eventType === "reward" && (
                  <div>
                    <label className={labelClass}>
                      Bonus Points
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={eventPoints}
                      onChange={(event) =>
                        setEventPoints(event.target.value)
                      }
                      placeholder="e.g. 2"
                      disabled={formDisabled}
                      className={inputClass}
                    />
                  </div>
                )}
                <div>
                  <label className={labelClass}>
                    {eventType === "reward"
                      ? "Reward Reason"
                      : "Additional Note"}
                  </label>
                  <textarea
                    rows={3}
                    value={eventNote}
                    onChange={(event) =>
                      setEventNote(event.target.value)
                    }
                    placeholder={
                      eventType === "reward"
                        ? "Why is this team receiving bonus points?"
                        : "Optional event details"
                    }
                    disabled={formDisabled}
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleEvent()}
                  disabled={formDisabled}
                  className="w-full rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-bold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionLoading
                    ? "Processing..."
                    : "+ Record Event"}
                </button>
              </div>
            </section>
          </div>
          {/* Right column: realtime timeline */}
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                    Live Match Feed
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    Event Timeline
                  </h2>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300">
                  {timeline.length} Events
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Match events are displayed in chronological order.
              </p>
            </div>
            {timeline.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="text-4xl">📋</div>
                <h3 className="mt-5 text-base font-semibold">
                  No match activity yet
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Goals, cards and rewards will appear here.
                </p>
              </div>
            ) : (
              <div className="max-h-[1000px] space-y-4 overflow-y-auto p-5">
                {timeline.map((event) => (
                  <article
                    key={event.id}
                    className={`flex items-start gap-4 rounded-2xl border p-4 ${eventStyle(
                      event.type
                    )}`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xl">
                      {eventIcon(event.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          {eventLabel(event.type)}
                        </span>
                        <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-extrabold tabular-nums text-blue-300">
                          {event.minute}&apos;
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-300">
                        {teamName(event.team)}
                      </p>
                      {event.player_name && (
                        <p className="mt-1 text-xs text-slate-400">
                          Player: {event.player_name}
                        </p>
                      )}
                      {event.note && (
                        <p className="mt-2 break-words text-xs leading-relaxed text-slate-400">
                          {event.note}
                        </p>
                      )}
                      {event.type === "reward" &&
                        event.points !== 0 && (
                          <p className="mt-3 text-sm font-bold text-amber-400">
                            +{event.points} Bonus Points
                          </p>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="border-t border-slate-800 bg-slate-950/40 px-6 py-4">
              <p className="text-center text-xs text-slate-500">
                {socketConnected
                  ? "● Receiving realtime match updates"
                  : "Waiting for realtime connection..."}
              </p>
            </div>
          </section>
        </div>
        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Match Control Room
        </footer>
      </div>
    </main>
  );
}
