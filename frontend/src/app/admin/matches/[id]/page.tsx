
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

  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);

  if (!match) {
    throw new Error("CSRF token was not found.");
  }

  return decodeURIComponent(match[1]);
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

  const [socketConnected, setSocketConnected] = useState(false);

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

//   useEffect(() => {
//     refresh();
//   }, [matchId]);
 useEffect(() => {
  refresh();

  const socket = new WebSocket(
    `ws://localhost:8000/ws/matches/${matchId}/`
  );

  socket.onopen = () => {
    setSocketConnected(true);
    console.log("WebSocket connected");
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
    console.log("WebSocket disconnected");
  };

  socket.onerror = (error) => {
    setSocketConnected(false);
  };

  return () => {
    socket.close();
  };
}, [matchId]);  

  function teamName(teamId: number) {
    const team = eventTeams.find((item) => item.team_id === teamId);

    return team?.team?.name || `Team #${teamId}`;
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
      type: eventType,
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
      <main style={{ padding: 40 }}>
        <p>Loading match...</p>
      </main>
    );
  }

  if (!match) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Match Control</h1>
        <p>{error || "Match not found."}</p>
      </main>
    );
  }

  const homeTeam = teamName(match.home_team);
  const awayTeam = teamName(match.away_team);

  const canStart = match.status === "scheduled";
  const canAddEvents = match.status === "live";
  const canFinish = match.status === "live";

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 40,
      }}
    >
      <button
        onClick={() => router.push("/admin/matches")}
        style={{
          marginBottom: 20,
          padding: "8px 14px",
          cursor: "pointer",
        }}
      >
        ← Back to Matches
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Match Control</h1>
          <p style={{ margin: 0 }}>
            {homeTeam} vs {awayTeam}
          </p>
        </div>

        <strong
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        >
          {match.status.toUpperCase()}
        </strong>
      </div>

      {error && (
        <div
          style={{
            padding: 14,
            marginBottom: 20,
            border: "1px solid #dc2626",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {/* SCOREBOARD */}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 30,
          marginBottom: 30,
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: 20 }}>Scoreboard</h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 35,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          <span>{homeTeam}</span>

          <span>
            {match.home_score} - {match.away_score}
          </span>

          <span>{awayTeam}</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginTop: 25,
          }}
        >
          {canStart && (
            <button
              disabled={actionLoading}
              onClick={handleStart}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              ▶ Start Match
            </button>
          )}

          {canFinish && (
            <button
              disabled={actionLoading}
              onClick={handleFinish}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              ⏹ Finish Match
            </button>
          )}
        </div>
      </section>

      {/* GOAL */}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 25,
          marginBottom: 25,
        }}
      >
        <h2>Add Goal</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <select
            value={goalTeam}
            onChange={(e) => setGoalTeam(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          >
            <option value="">Select team</option>
            <option value={match.home_team}>{homeTeam}</option>
            <option value={match.away_team}>{awayTeam}</option>
          </select>

          <input
            type="text"
            placeholder="Player name"
            value={goalPlayer}
            onChange={(e) => setGoalPlayer(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          />

          <input
            type="number"
            min="0"
            max="120"
            placeholder="Minute"
            value={goalMinute}
            onChange={(e) => setGoalMinute(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          />

          <button
            onClick={handleGoal}
            disabled={!canAddEvents || actionLoading}
          >
            ⚽ Add Goal
          </button>
        </div>
      </section>

      {/* MATCH EVENT */}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 25,
          marginBottom: 30,
        }}
      >
        <h2>Match Event</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <select
            value={eventTeam}
            onChange={(e) => setEventTeam(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          >
            <option value="">Select team</option>
            <option value={match.home_team}>{homeTeam}</option>
            <option value={match.away_team}>{awayTeam}</option>
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
          >
            <option value="yellow_card">Yellow Card</option>
            <option value="red_card">Red Card</option>
            <option value="penalty_kick">Penalty Kick</option>
            <option value="reward">Reward</option>
          </select>

          <input
            type="text"
            placeholder="Player name"
            value={eventPlayer}
            onChange={(e) => setEventPlayer(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          />

          <input
            type="number"
            min="0"
            max="120"
            placeholder="Minute"
            value={eventMinute}
            onChange={(e) => setEventMinute(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          />

          {eventType === "reward" && (
            <input
              type="number"
              placeholder="Bonus points"
              value={eventPoints}
              onChange={(e) => setEventPoints(e.target.value)}
              disabled={!canAddEvents || actionLoading}
            />
          )}

          <input
            type="text"
            placeholder="Reason / note"
            value={eventNote}
            onChange={(e) => setEventNote(e.target.value)}
            disabled={!canAddEvents || actionLoading}
          />

          <button
            onClick={handleEvent}
            disabled={!canAddEvents || actionLoading}
          >
            Add Event
          </button>
        </div>
      </section>

      {/* TIMELINE */}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 25,
        }}
      >
        <h2>Event Timeline</h2>

        {events.length === 0 ? (
          <p>No events recorded yet.</p>
        ) : (
          <div>
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                  padding: "14px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <strong style={{ minWidth: 45 }}>
                  {event.minute}&apos;
                </strong>

                <strong style={{ minWidth: 130 }}>
                  {event.type.replaceAll("_", " ")}
                </strong>

                <span>{teamName(event.team)}</span>

                {event.player_name && (
                  <span>— {event.player_name}</span>
                )}

                {event.points !== 0 && (
                  <span>
                    — {event.points > 0 ? "+" : ""}
                    {event.points} pts
                  </span>
                )}

                {event.note && <span>— {event.note}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

