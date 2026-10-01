"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Event, Team } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Round {
  id: number;
  event: number;
  name: string;
  order_number: number;
}

interface Match {
  id: number;
  round: number;
  home_team: number;
  away_team: number;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
}

interface EventTeam {
  id: number;
  event_id: number;
  team_id: number;
  team: Team;
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

function getCookie(name: string): string | null {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}

async function getCsrfToken(): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to initialize CSRF protection.");
  }

  return getCookie("csrftoken");
}

export default function AdminMatchesPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [venue, setVenue] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadEvents() {
    const response = await fetch(`${API_BASE_URL}/admin/events/`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to load events.");
    }

    const data = await readJson(response);

    const results = data.results || [];

    setEvents(results);

    if (results.length > 0) {
      setSelectedEventId(String(results[0].id));
    } else {
      setSelectedEventId("");
    }
  }

  async function loadRounds(eventId: string) {
    if (!eventId) {
      setRounds([]);
      setSelectedRoundId("");
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/rounds/?event=${eventId}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load rounds.");
    }

    const data = await readJson(response);

    const results = data.results || [];

    setRounds(results);

    if (results.length > 0) {
      setSelectedRoundId(String(results[0].id));
    } else {
      setSelectedRoundId("");
    }
  }

  async function loadEventTeams(eventId: string) {
    if (!eventId) {
      setEventTeams([]);
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/event-teams/?event_id=${eventId}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load registered teams.");
    }

    const data = await readJson(response);

    setEventTeams(Array.isArray(data) ? data : []);
  }

  async function loadMatches() {
    const response = await fetch(
      `${API_BASE_URL}/admin/matches/`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load matches.");
    }

    const data = await readJson(response);

    setMatches(data.results || []);
  }

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setError("");

        await loadEvents();
        await loadMatches();
      } catch (err) {
        console.error("MATCHES INITIALIZATION ERROR:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load data."
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setRounds([]);
      setEventTeams([]);
      setSelectedRoundId("");
      setHomeTeamId("");
      setAwayTeamId("");
      return;
    }

    async function loadEventData() {
      try {
        setError("");

        await Promise.all([
          loadRounds(selectedEventId),
          loadEventTeams(selectedEventId),
        ]);

        setHomeTeamId("");
        setAwayTeamId("");
      } catch (err) {
        console.error("EVENT MATCH DATA ERROR:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load event data."
        );
      }
    }

    loadEventData();
  }, [selectedEventId]);

  const selectedRound = rounds.find(
    (round) => round.id === Number(selectedRoundId)
  );

  const filteredMatches = useMemo(() => {
    if (!selectedRoundId) {
      return [];
    }

    return matches.filter(
      (match) => match.round === Number(selectedRoundId)
    );
  }, [matches, selectedRoundId]);

  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();

    eventTeams.forEach((eventTeam) => {
      map.set(eventTeam.team_id, eventTeam.team);
    });

    return map;
  }, [eventTeams]);

  async function handleCreateMatch(event: FormEvent) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!selectedEventId) {
      setError("Select an event.");
      return;
    }

    if (!selectedRoundId) {
      setError("Select a round.");
      return;
    }

    if (!homeTeamId || !awayTeamId) {
      setError("Select both teams.");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError("A team cannot play against itself.");
      return;
    }

    if (!scheduledAt) {
      setError("Scheduled date and time are required.");
      return;
    }

    try {
      setSaving(true);

      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/matches/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "",
          },
          body: JSON.stringify({
            round: Number(selectedRoundId),
            home_team: Number(homeTeamId),
            away_team: Number(awayTeamId),
            scheduled_at: new Date(scheduledAt).toISOString(),
            venue: venue.trim(),
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        const validationMessage =
          data.non_field_errors?.[0] ||
          data.detail ||
          data.home_team?.[0] ||
          data.away_team?.[0] ||
          data.round?.[0] ||
          "Unable to create match.";

        throw new Error(validationMessage);
      }

      setMessage("Match created successfully.");

      setHomeTeamId("");
      setAwayTeamId("");
      setScheduledAt("");
      setVenue("");

      await loadMatches();
    } catch (err) {
      console.error("CREATE MATCH ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create match."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMatch(matchId: number) {
    if (!confirm("Delete this match?")) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/matches/${matchId}/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRFToken": csrfToken || "",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.detail || "Unable to delete match."
        );
      }

      setMessage("Match deleted.");

      await loadMatches();
    } catch (err) {
      console.error("DELETE MATCH ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete match."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b16] p-8 text-white">
        <p className="text-slate-400">
          Loading matches...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b16] p-8 text-white">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            Tournament Admin
          </p>

          <h1 className="text-4xl font-bold">
            Matches
          </h1>

          <p className="mt-2 text-slate-400">
            Schedule matches and manage tournament fixtures.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-xl">
          <h2 className="mb-5 text-xl font-semibold">
            Schedule Match
          </h2>

          <form
            onSubmit={handleCreateMatch}
            className="grid gap-4 md:grid-cols-2"
          >
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
              }}
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="">
                Select event
              </option>

              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>

            <select
              value={selectedRoundId}
              onChange={(e) =>
                setSelectedRoundId(e.target.value)
              }
              disabled={rounds.length === 0}
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">
                Select round
              </option>

              {rounds
                .slice()
                .sort(
                  (a, b) =>
                    a.order_number - b.order_number
                )
                .map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.name}
                  </option>
                ))}
            </select>

            <select
              value={homeTeamId}
              onChange={(e) =>
                setHomeTeamId(e.target.value)
              }
              disabled={eventTeams.length === 0}
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">
                Home team
              </option>

              {eventTeams.map((eventTeam) => (
                <option
                  key={eventTeam.team_id}
                  value={eventTeam.team_id}
                >
                  {eventTeam.team.name} (
                  {eventTeam.team.code})
                </option>
              ))}
            </select>

            <select
              value={awayTeamId}
              onChange={(e) =>
                setAwayTeamId(e.target.value)
              }
              disabled={eventTeams.length === 0}
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">
                Away team
              </option>

              {eventTeams.map((eventTeam) => (
                <option
                  key={eventTeam.team_id}
                  value={eventTeam.team_id}
                >
                  {eventTeam.team.name} (
                  {eventTeam.team.code})
                </option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) =>
                setScheduledAt(e.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500"
            />

            <input
              type="text"
              placeholder="Venue"
              value={venue}
              onChange={(e) =>
                setVenue(e.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={
                saving ||
                !selectedRoundId ||
                eventTeams.length < 2
              }
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
            >
              {saving
                ? "Scheduling..."
                : "Schedule Match"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-xl">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {selectedRound?.name || "Matches"}
              </h2>

              <p className="text-sm text-slate-400">
                Scheduled fixtures for the selected round.
              </p>
            </div>

            <span className="rounded-full bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
              {filteredMatches.length} matches
            </span>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center text-slate-500">
              No matches scheduled for this round.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">

              {filteredMatches.map((match) => {
                const homeTeam = teamMap.get(match.home_team);
                const awayTeam = teamMap.get(match.away_team);

                return (
                  <div
                    key={match.id}
                    className="rounded-xl border border-white/10 bg-[#111a2d] p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          match.status === "live"
                            ? "bg-red-500/10 text-red-300"
                            : match.status === "finished"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-blue-500/10 text-blue-300"
                        }`}
                      >
                        {match.status.toUpperCase()}
                      </span>

                      <span className="text-xs text-slate-500">
                        #{match.id}
                      </span>
                    </div>

                    <div className="mb-5 text-center">
                      <p className="text-lg font-bold">
                        {homeTeam?.name ||
                          `Team #${match.home_team}`}
                      </p>

                      <p className="my-2 text-sm text-slate-500">
                        VS
                      </p>

                      <p className="text-lg font-bold">
                        {awayTeam?.name ||
                          `Team #${match.away_team}`}
                      </p>
                    </div>

                    <div className="mb-4 space-y-1 text-sm text-slate-400">
                      <p>
                        🕐{" "}
                        {new Date(
                          match.scheduled_at
                        ).toLocaleString()}
                      </p>

                      <p>
                        📍{" "}
                        {match.venue ||
                          "Venue not specified"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteMatch(match.id)
                      }
                      disabled={match.status !== "scheduled"}
                      className="w-full rounded-lg border border-red-500/20 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Delete Match
                    </button>
                  </div>
                );
              })}

            </div>
          )}
        </section>
      </div>
    </main>
  );
}

