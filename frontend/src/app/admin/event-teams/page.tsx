"use client";

import { useEffect, useMemo, useState } from "react";
import { Event, Team } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface EventTeam {
  id: number;
  event_id: number;
  team_id: number;
  team: Team;
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

export default function AdminEventTeamsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [registrations, setRegistrations] = useState<EventTeam[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadBaseData() {
    try {
      setLoading(true);
      setError("");

      const [eventsResponse, teamsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/events/`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/admin/teams/`, {
          credentials: "include",
        }),
      ]);

      if (!eventsResponse.ok) {
        throw new Error("Unable to load events.");
      }

      if (!teamsResponse.ok) {
        throw new Error("Unable to load teams.");
      }

      const eventsData = await eventsResponse.json();
      const teamsData = await teamsResponse.json();

      setEvents(eventsData.results || []);
      setTeams(teamsData.results || []);

      if (eventsData.results?.length > 0) {
        setSelectedEventId(String(eventsData.results[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRegistrations(eventId: string) {
    if (!eventId) {
      setRegistrations([]);
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/admin/event-teams/?event_id=${eventId}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load registered teams.");
      }

      const data = await response.json();
      setRegistrations(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load registered teams."
      );
    }
  }

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadRegistrations(selectedEventId);
      setSelectedTeamId("");
    }
  }, [selectedEventId]);

  async function handleAddTeam() {
  if (!selectedEventId || !selectedTeamId) {
    setError("Select an event and a team.");
    return;
  }

  try {
    setSaving(true);
    setError("");
    setMessage("");

    const csrfToken = await getCsrfToken();

    const response = await fetch(
      `${API_BASE_URL}/admin/event-teams/`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
        body: JSON.stringify({
          event_id: Number(selectedEventId),
          team_id: Number(selectedTeamId),
        }),
      }
    );

    const responseText = await response.text();

    let data: any = {};

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Server returned HTML instead of JSON (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.detail ||
          data.non_field_errors?.[0] ||
          data.team_id?.[0] ||
          "Unable to add team."
      );
    }

    setMessage("Team added to event.");
    setSelectedTeamId("");

    await loadRegistrations(selectedEventId);
  } catch (err) {
    console.error("ADD TEAM ERROR:", err);

    setError(
      err instanceof Error
        ? err.message
        : "Unable to add team."
    );
  } finally {
    setSaving(false);
  }
}

  async function handleRemoveTeam(registrationId: number) {
    if (!confirm("Remove this team from the event?")) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/event-teams/${registrationId}/`,
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
          data.detail || "Unable to remove team."
        );
      }

      setMessage("Team removed from event.");

      await loadRegistrations(selectedEventId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove team."
      );
    }
  }

  const registeredTeamIds = useMemo(
    () => new Set(registrations.map((item) => item.team_id)),
    [registrations]
  );

  const availableTeams = teams.filter(
    (team) => !registeredTeamIds.has(team.id)
  );

  const selectedEvent = events.find(
    (event) => event.id === Number(selectedEventId)
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b16] p-8 text-white">
        <p className="text-slate-400">Loading event teams...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b16] p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            Tournament Admin
          </p>

          <h1 className="text-4xl font-bold">
            Event Teams
          </h1>

          <p className="mt-2 text-slate-400">
            Register teams for each football event.
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
            Register Team
          </h2>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <select
              value={selectedEventId}
              onChange={(event) =>
                setSelectedEventId(event.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              <option value="">Select event</option>

              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>

            <select
              value={selectedTeamId}
              onChange={(event) =>
                setSelectedTeamId(event.target.value)
              }
              disabled={!selectedEventId || availableTeams.length === 0}
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {availableTeams.length === 0
                  ? "All teams registered"
                  : "Select team"}
              </option>

              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.code})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleAddTeam}
              disabled={saving || !selectedTeamId}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Team"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-xl">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Registered Teams
              </h2>

              <p className="text-sm text-slate-400">
                {selectedEvent
                  ? selectedEvent.name
                  : "Select an event"}
              </p>
            </div>

            <span className="rounded-full bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
              {registrations.length} teams
            </span>
          </div>

          {registrations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center text-slate-500">
              No teams registered for this event yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {registrations.map((registration) => (
                <div
                  key={registration.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111a2d] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-blue-500/10 font-bold text-blue-300">
                      {registration.team.logo ? (
                        <img
                          src={registration.team.logo}
                          alt={registration.team.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        registration.team.code.slice(0, 3)
                      )}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {registration.team.name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {registration.team.code}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveTeam(registration.id)
                    }
                    className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}