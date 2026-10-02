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

interface Event {
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

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const eventId = params.id;

  const [event, setEvent] = useState<Event | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [connectedMatches, setConnectedMatches] = useState<
    Record<number, boolean>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadEvent() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/events/${eventId}/`
        );

        if (!response.ok) {
          throw new Error("Unable to load tournament.");
        }

        const data = await readJson(response);

        if (!cancelled) {
          setEvent(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tournament."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadStandings() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/events/${eventId}/standings/`
        );

        if (!response.ok) {
          throw new Error("Unable to load standings.");
        }

        const data = await readJson(response);

        if (!cancelled) {
          setStandings(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load standings."
          );
        }
      }
    }

    loadEvent();
    loadStandings();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  /*
   * Realtime updates for every match displayed on the tournament page.
   *
   * The event API provides all rounds and matches, so once the event
   * is loaded we subscribe to each match's WebSocket channel.
   */
  useEffect(() => {
    if (!event) {
      return;
    }

    const sockets: WebSocket[] = [];

    const matches = event.rounds.flatMap((round) => round.matches);

    matches.forEach((match) => {
      const socket = new WebSocket(
        `ws://localhost:8000/ws/matches/${match.id}/`
      );

      sockets.push(socket);

      socket.onopen = () => {
        setConnectedMatches((current) => ({
          ...current,
          [match.id]: true,
        }));
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);

          if (data.type === "connection") {
            return;
          }

          setEvent((currentEvent) => {
            if (!currentEvent) {
              return currentEvent;
            }

            return {
              ...currentEvent,
              rounds: currentEvent.rounds.map((round) => ({
                ...round,
                matches: round.matches.map((currentMatch) => {
                  if (currentMatch.id !== match.id) {
                    return currentMatch;
                  }

                  return {
                    ...currentMatch,
                    status: data.status,
                    home_score: data.home_score,
                    away_score: data.away_score,
                  };
                }),
              })),
            };
          });

          /*
           * A finished match can change the standings.
           * Reload standings only when the backend tells us that
           * the match has finished.
           */
          if (data.event === "match_finished") {
            fetch(
              `${API_BASE_URL}/events/${eventId}/standings/`
            )
              .then(async (response) => {
                if (!response.ok) {
                  return;
                }

                const updatedStandings = await response.json();
                setStandings(updatedStandings);
              })
              .catch(() => {
                // Keep the existing standings if the refresh fails.
              });
          }
        } catch (err) {
          console.error(
            "Invalid WebSocket message:",
            err
          );
        }
      };

      socket.onclose = () => {
        setConnectedMatches((current) => ({
          ...current,
          [match.id]: false,
        }));
      };

      socket.onerror = () => {
        setConnectedMatches((current) => ({
          ...current,
          [match.id]: false,
        }));
      };
    });

    return () => {
      sockets.forEach((socket) => {
        socket.close();
      });
    };
  }, [event, eventId]);

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function statusStyle(status: Match["status"]) {
    if (status === "live") {
      return {
        background: "#fee2e2",
        color: "#b91c1c",
      };
    }

    if (status === "finished") {
      return {
        background: "#e5e7eb",
        color: "#374151",
      };
    }

    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
        <p>Loading tournament...</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
        <button onClick={() => router.push("/events")}>
          ← Back to Events
        </button>

        <h1>Event Details</h1>

        <p>{error || "Tournament not found."}</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 40,
      }}
    >
      <button
        onClick={() => router.push("/events")}
        style={{
          marginBottom: 25,
          padding: "9px 15px",
          border: "1px solid #ccc",
          borderRadius: 8,
          background: "white",
          cursor: "pointer",
        }}
      >
        ← Back to Events
      </button>

      {error && (
        <div
          style={{
            padding: 14,
            marginBottom: 25,
            border: "1px solid #dc2626",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {/* EVENT HEADER */}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 14,
          padding: 30,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
          }}
        >
          <div>
            <h1 style={{ marginTop: 0, marginBottom: 10 }}>
              {event.name}
            </h1>

            <p
              style={{
                color: "#555",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              {event.description || "No description available."}
            </p>

            <div style={{ color: "#666", fontSize: 14 }}>
              {formatDate(event.start_date)} →{" "}
              {formatDate(event.end_date)}
            </div>
          </div>

          <strong
            style={{
              padding: "7px 13px",
              borderRadius: 999,
              background:
                event.status === "active"
                  ? "#dcfce7"
                  : event.status === "completed"
                  ? "#e5e7eb"
                  : "#fef3c7",
              color:
                event.status === "active"
                  ? "#166534"
                  : event.status === "completed"
                  ? "#374151"
                  : "#92400e",
            }}
          >
            {statusLabel(event.status)}
          </strong>
        </div>
      </section>

      {/* TEAMS */}

      <section style={{ marginBottom: 35 }}>
        <h2>Teams</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 15,
          }}
        >
          {event.teams.map((team) => (
            <div
              key={team.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 18,
              }}
            >
              <strong>{team.name}</strong>

              <div
                style={{
                  color: "#777",
                  marginTop: 5,
                  fontSize: 14,
                }}
              >
                {team.code}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ROUNDS & MATCHES */}

      <section style={{ marginBottom: 40 }}>
        <h2>Rounds & Matches</h2>

        {event.rounds.length === 0 ? (
          <p>No rounds have been created yet.</p>
        ) : (
          event.rounds.map((round) => (
            <div
              key={round.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 22,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <h3 style={{ margin: 0 }}>
                  {round.order_number}. {round.name}
                </h3>

                <span style={{ color: "#777" }}>
                  {round.matches.length}{" "}
                  {round.matches.length === 1
                    ? "match"
                    : "matches"}
                </span>
              </div>

              {round.matches.length === 0 ? (
                <p style={{ color: "#777" }}>
                  No matches scheduled yet.
                </p>
              ) : (
                <div>
                  {round.matches.map((match) => {
                    const status = statusStyle(match.status);

                    return (
                      <div
                        key={match.id}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 10,
                          padding: 18,
                          marginBottom: 12,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          router.push(
                            `/matches/${match.id}`
                          )
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            alignItems: "center",
                            gap: 15,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              fontWeight: 600,
                            }}
                          >
                            <span>
                              {match.home_team.name}
                            </span>

                            <strong>
                              {match.home_score} -{" "}
                              {match.away_score}
                            </strong>

                            <span>
                              {match.away_team.name}
                            </span>
                          </div>

                          <span
                            style={{
                              ...status,
                              padding: "5px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {match.status === "live" &&
                              "● "}
                            {statusLabel(match.status)}
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            color: "#777",
                            fontSize: 13,
                          }}
                        >
                          {formatDateTime(
                            match.scheduled_at
                          )}

                          {match.venue && (
                            <>
                              {" "}
                              · {match.venue}
                            </>
                          )}

                          {match.status === "live" &&
                            connectedMatches[
                              match.id
                            ] && (
                              <span
                                style={{
                                  marginLeft: 10,
                                  color: "#15803d",
                                  fontWeight: 600,
                                }}
                              >
                                Live connection
                              </span>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* STANDINGS */}

      <section>
        <h2>Standings</h2>

        {standings.length === 0 ? (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 25,
            }}
          >
            <p>No standings available yet.</p>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #ddd",
              borderRadius: 12,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 750,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #ddd",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: 14 }}>#</th>
                  <th style={{ padding: 14 }}>Team</th>
                  <th style={{ padding: 14 }}>P</th>
                  <th style={{ padding: 14 }}>W</th>
                  <th style={{ padding: 14 }}>D</th>
                  <th style={{ padding: 14 }}>L</th>
                  <th style={{ padding: 14 }}>GF</th>
                  <th style={{ padding: 14 }}>GA</th>
                  <th style={{ padding: 14 }}>GD</th>
                  <th style={{ padding: 14 }}>Reward</th>
                  <th style={{ padding: 14 }}>Pts</th>
                </tr>
              </thead>

              <tbody>
                {standings.map((standing, index) => (
                  <tr
                    key={standing.team_id}
                    style={{
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <td style={{ padding: 14 }}>
                      {index + 1}
                    </td>

                    <td
                      style={{
                        padding: 14,
                        fontWeight: 600,
                      }}
                    >
                      {standing.team}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.played}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.won}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.drawn}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.lost}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.goals_for}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.goals_against}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.goal_difference}
                    </td>

                    <td style={{ padding: 14 }}>
                      {standing.reward_points}
                    </td>

                    <td
                      style={{
                        padding: 14,
                        fontWeight: 700,
                      }}
                    >
                      {standing.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}