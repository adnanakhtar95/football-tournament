
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface TournamentEvent {
  id: number;
  name: string;
  status: "draft" | "active" | "completed";
}

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface EventTeam {
  id: number;
  event_id: number;
  team_id: number;
  team: Team;
}

const selectClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

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
    throw new Error("CSRF token missing. Please refresh the page.");
  }

  return token;
}

function getApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const errors = data as Record<string, unknown>;

  if (typeof errors.detail === "string") {
    return errors.detail;
  }

  return (
    Object.entries(errors)
      .map(([field, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value);

        return `${field}: ${message}`;
      })
      .join(" | ") || fallback
  );
}

// Handles both paginated and non-paginated DRF list responses.
async function fetchAllPages<T>(
  initialUrl: string,
  signal?: AbortSignal
): Promise<T[]> {
  const items: T[] = [];

  let nextUrl: string | null = initialUrl;

  while (nextUrl !== null) {
    const currentUrl: string = nextUrl;

    const response = await fetch(currentUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load records (HTTP ${response.status}).`
      );
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      items.push(...data);
      nextUrl = null;
    } else {
      items.push(...(data.results ?? []));

      nextUrl = data.next
        ? new URL(data.next, currentUrl).toString()
        : null;
    }
  }

  return items;
}

export default function AdminEventTeamsPage() {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [registrations, setRegistrations] = useState<EventTeam[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBaseData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError("");

      const [eventData, teamData] = await Promise.all([
        fetchAllPages<TournamentEvent>(
          `${API_BASE_URL}/admin/events/`,
          signal
        ),
        fetchAllPages<Team>(
          `${API_BASE_URL}/admin/teams/`,
          signal
        ),
      ]);

      if (signal?.aborted) return;

      setEvents(eventData);
      setTeams(teamData);

      setSelectedEventId((current) => {
        if (
          current &&
          eventData.some((event) => String(event.id) === current)
        ) {
          return current;
        }

        return eventData.length > 0
          ? String(eventData[0].id)
          : "";
      });
    } catch (err) {
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events and teams."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadRegistrations = useCallback(
    async (eventId: string, signal?: AbortSignal) => {
      if (!eventId) {
        setRegistrations([]);
        return;
      }

      try {
        setLoadingRegistrations(true);
        setError("");

        const data = await fetchAllPages<EventTeam>(
          `${API_BASE_URL}/admin/event-teams/?event_id=${encodeURIComponent(
            eventId
          )}`,
          signal
        );

        if (signal?.aborted) return;

        setRegistrations(data);
      } catch (err) {
        if (signal?.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load registered teams."
        );
      } finally {
        if (!signal?.aborted) {
          setLoadingRegistrations(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadBaseData(controller.signal);

    return () => controller.abort();
  }, [loadBaseData]);

  useEffect(() => {
    const controller = new AbortController();

    setSelectedTeamId("");
    setRegistrations([]);

    if (selectedEventId) {
      void loadRegistrations(selectedEventId, controller.signal);
    }

    return () => controller.abort();
  }, [selectedEventId, loadRegistrations]);

  const registeredTeamIds = useMemo(
    () => new Set(registrations.map((item) => item.team_id)),
    [registrations]
  );

  const availableTeams = useMemo(
    () => teams.filter((team) => !registeredTeamIds.has(team.id)),
    [teams, registeredTeamIds]
  );

  const selectedEvent = events.find(
    (event) => event.id === Number(selectedEventId)
  );

  async function handleAddTeam() {
    if (!selectedEventId || !selectedTeamId || saving) {
      if (!selectedEventId || !selectedTeamId) {
        setError("Please select an event and a team.");
      }

      return;
    }

    const eventId = selectedEventId;
    const teamId = selectedTeamId;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/event-teams/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify({
            event_id: Number(eventId),
            team_id: Number(teamId),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(data, "Unable to register the team.")
        );
      }

      setSelectedTeamId("");
      setMessage("Team registered successfully.");

      await loadRegistrations(eventId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to register the team."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveTeam(registration: EventTeam) {
    if (removingId !== null) return;

    const confirmed = window.confirm(
      `Remove "${registration.team.name}" from this tournament?\n\nThe team itself will remain in the system.`
    );

    if (!confirmed) return;

    const eventId = selectedEventId;

    setRemovingId(registration.id);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/event-teams/${registration.id}/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRFToken": csrfToken,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          getApiError(data, "Unable to remove the team.")
        );
      }

      setMessage("Team removed from the tournament.");

      await loadRegistrations(eventId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove the team."
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {/* Header */}

        <header className="mb-9">
          <Link
            href="/admin"
            className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
          >
            ← Admin Dashboard
          </Link>

          <p className="mt-7 text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            Tournament Administration
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Event Teams
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Register existing football teams for specific tournaments.
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

        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-green-900 bg-green-950/30 px-5 py-4 text-sm text-green-300"
          >
            {message}
          </div>
        )}

        {/* Registration form */}

        <section className="mb-9 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Register Team
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Choose a tournament, then select a team to enroll.
              </p>
            </div>

            <Link
              href="/admin/teams"
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white"
            >
              Manage Teams →
            </Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Loading tournaments and teams...
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div>
                <label
                  htmlFor="event-select"
                  className="mb-2 block text-sm font-semibold text-slate-300"
                >
                  Tournament
                </label>

                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setMessage("");
                    setError("");
                  }}
                  disabled={saving || removingId !== null}
                  className={selectClass}
                >
                  <option value="">Select tournament</option>

                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} ({event.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="team-select"
                  className="mb-2 block text-sm font-semibold text-slate-300"
                >
                  Available Team
                </label>

                <select
                  id="team-select"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={
                    !selectedEventId ||
                    loadingRegistrations ||
                    availableTeams.length === 0 ||
                    saving ||
                    removingId !== null
                  }
                  className={selectClass}
                >
                  <option value="">
                    {loadingRegistrations
                      ? "Loading available teams..."
                      : availableTeams.length === 0
                        ? "No available teams"
                        : "Select team"}
                  </option>

                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.code})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void handleAddTeam()}
                disabled={
                  !selectedEventId ||
                  !selectedTeamId ||
                  saving ||
                  loadingRegistrations ||
                  removingId !== null
                }
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Registering..." : "+ Add Team"}
              </button>
            </div>
          )}
        </section>

        {/* Summary */}

        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Registered Teams
            </p>

            <p className="mt-3 text-3xl font-bold">
              {registrations.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Available Teams
            </p>

            <p className="mt-3 text-3xl font-bold">
              {selectedEventId ? availableTeams.length : 0}
            </p>
          </div>
        </section>

        {/* Registered teams */}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Registered Teams
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {selectedEvent
                  ? selectedEvent.name
                  : "Select a tournament to view registrations."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedEventId) {
                  void loadRegistrations(selectedEventId);
                }
              }}
              disabled={!selectedEventId || loadingRegistrations}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {loadingRegistrations ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingRegistrations ? (
            <div className="py-14 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

              <p className="mt-4 text-sm text-slate-400">
                Loading registered teams...
              </p>
            </div>
          ) : !selectedEventId ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center text-sm text-slate-400">
              Please select a tournament first.
            </div>
          ) : registrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center">
              <div className="text-4xl">⚽</div>

              <h3 className="mt-4 text-lg font-semibold">
                No teams registered
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Enroll a team using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {registrations.map((registration) => (
                <article
                  key={registration.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-2">
                      {registration.team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={registration.team.logo}
                          alt={`${registration.team.name} logo`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="font-extrabold text-blue-400">
                          {registration.team.code.slice(0, 3)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white">
                        {registration.team.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold tracking-wider text-blue-400">
                        {registration.team.code}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-800 pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        void handleRemoveTeam(registration)
                      }
                      disabled={removingId !== null || saving}
                      className="w-full rounded-xl border border-red-900 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {removingId === registration.id
                        ? "Removing..."
                        : "Remove From Event"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Team Enrollment
        </footer>
      </div>
    </main>
  );
}
