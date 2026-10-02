
"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

interface TournamentRound {
  id: number;
  event: number;
  name: string;
  order_number: number;
}

interface EventTeam {
  id: number;
  event_id: number;
  team_id: number;
  team: Team;
}

interface Match {
  id: number;
  round: number;
  home_team: number;
  away_team: number;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  home_score?: number;
  away_score?: number;
}

interface MatchForm {
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  venue: string;
}

const EMPTY_FORM: MatchForm = {
  homeTeamId: "",
  awayTeamId: "",
  scheduledAt: "",
  venue: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-300";

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
    throw new Error("CSRF cookie missing. Please refresh the page.");
  }

  return token;
}

function getApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

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

function toDateTimeLocal(value: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (number: number) => String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : date.toLocaleString();
}

function statusClass(status: Match["status"]): string {
  switch (status) {
    case "live":
      return "border-red-900 bg-red-950/40 text-red-300";
    case "finished":
      return "border-green-900 bg-green-950/30 text-green-300";
    default:
      return "border-blue-900 bg-blue-950/40 text-blue-300";
  }
}

export default function AdminMatchesPage() {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");

  const [form, setForm] = useState<MatchForm>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingEventData, setLoadingEventData] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMatches = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadingMatches(true);

      const data = await fetchAllPages<Match>(
        `${API_BASE_URL}/admin/matches/`,
        signal
      );

      if (!signal?.aborted) {
        setMatches(data);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load matches."
        );
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingMatches(false);
      }
    }
  }, []);

  const loadEvents = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError("");

      const data = await fetchAllPages<TournamentEvent>(
        `${API_BASE_URL}/admin/events/`,
        signal
      );

      if (signal?.aborted) return;

      setEvents(data);

      setSelectedEventId((current) => {
        if (
          current &&
          data.some((event) => String(event.id) === current)
        ) {
          return current;
        }

        return data.length > 0 ? String(data[0].id) : "";
      });
    } catch (err) {
      if (!signal?.aborted) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournaments."
        );
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadEventData = useCallback(
    async (eventId: string, signal?: AbortSignal) => {
      if (!eventId) {
        setRounds([]);
        setEventTeams([]);
        setSelectedRoundId("");
        return;
      }

      try {
        setLoadingEventData(true);
        setError("");

        const [roundData, registrationData] = await Promise.all([
          fetchAllPages<TournamentRound>(
            `${API_BASE_URL}/admin/rounds/?event=${encodeURIComponent(
              eventId
            )}`,
            signal
          ),
          fetchAllPages<EventTeam>(
            `${API_BASE_URL}/admin/event-teams/?event_id=${encodeURIComponent(
              eventId
            )}`,
            signal
          ),
        ]);

        if (signal?.aborted) return;

        const filteredRounds = roundData
          .filter((round) => round.event === Number(eventId))
          .sort(
            (a, b) =>
              a.order_number - b.order_number || a.id - b.id
          );

        setRounds(filteredRounds);

        setEventTeams(
          registrationData.filter(
            (registration) =>
              registration.event_id === Number(eventId)
          )
        );

        setSelectedRoundId((current) => {
          if (
            current &&
            filteredRounds.some(
              (round) => String(round.id) === current
            )
          ) {
            return current;
          }

          return filteredRounds.length > 0
            ? String(filteredRounds[0].id)
            : "";
        });
      } catch (err) {
        if (!signal?.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tournament data."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingEventData(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      loadEvents(controller.signal),
      loadMatches(controller.signal),
    ]);

    return () => controller.abort();
  }, [loadEvents, loadMatches]);

  useEffect(() => {
    const controller = new AbortController();

    setRounds([]);
    setEventTeams([]);
    setSelectedRoundId("");
    resetForm();

    if (selectedEventId) {
      void loadEventData(selectedEventId, controller.signal);
    }

    return () => controller.abort();
  }, [selectedEventId, loadEventData]);

  const sortedRounds = useMemo(
    () =>
      [...rounds].sort(
        (a, b) =>
          a.order_number - b.order_number || a.id - b.id
      ),
    [rounds]
  );

  const filteredMatches = useMemo(() => {
    if (!selectedRoundId) return [];

    return matches
      .filter(
        (match) => match.round === Number(selectedRoundId)
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime()
      );
  }, [matches, selectedRoundId]);

  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();

    eventTeams.forEach((registration) => {
      map.set(registration.team_id, registration.team);
    });

    return map;
  }, [eventTeams]);

  const usedTeamIds = useMemo(() => {
    const used = new Set<number>();

    filteredMatches.forEach((match) => {
      if (match.id === editingId) return;

      used.add(match.home_team);
      used.add(match.away_team);
    });

    return used;
  }, [filteredMatches, editingId]);

  const selectedRound = sortedRounds.find(
    (round) => round.id === Number(selectedRoundId)
  );

  const selectedEvent = events.find(
    (event) => event.id === Number(selectedEventId)
  );

  const scheduledCount = filteredMatches.filter(
    (match) => match.status === "scheduled"
  ).length;

  const liveCount = filteredMatches.filter(
    (match) => match.status === "live"
  ).length;

  const finishedCount = filteredMatches.filter(
    (match) => match.status === "finished"
  ).length;

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function beginEditing(match: Match) {
    if (match.status !== "scheduled") {
      setError("Only scheduled matches can be edited.");
      return;
    }

    setEditingId(match.id);

    setForm({
      homeTeamId: String(match.home_team),
      awayTeamId: String(match.away_team),
      scheduledAt: toDateTimeLocal(match.scheduled_at),
      venue: match.venue ?? "",
    });

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const { homeTeamId, awayTeamId, scheduledAt, venue } = form;

    if (!selectedEventId || !selectedRoundId) {
      setError("Select a tournament and a round.");
      return;
    }

    if (!homeTeamId || !awayTeamId) {
      setError("Please select both teams.");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError("A team cannot play against itself.");
      return;
    }

    if (
      usedTeamIds.has(Number(homeTeamId)) ||
      usedTeamIds.has(Number(awayTeamId))
    ) {
      setError(
        "One of the selected teams already has a match in this round."
      );
      return;
    }

    if (!scheduledAt) {
      setError("Scheduled date and time are required.");
      return;
    }

    const parsedDate = new Date(scheduledAt);

    if (Number.isNaN(parsedDate.getTime())) {
      setError("Please enter a valid scheduled date and time.");
      return;
    }

    const isEditing = editingId !== null;
    const roundId = Number(selectedRoundId);

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const url = isEditing
        ? `${API_BASE_URL}/admin/matches/${editingId}/`
        : `${API_BASE_URL}/admin/matches/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          round: roundId,
          home_team: Number(homeTeamId),
          away_team: Number(awayTeamId),
          scheduled_at: parsedDate.toISOString(),
          venue: venue.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            isEditing
              ? "Unable to update match."
              : "Unable to schedule match."
          )
        );
      }

      resetForm();

      await loadMatches();

      setMessage(
        isEditing
          ? "Match updated successfully."
          : "Match scheduled successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save match."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMatch(match: Match) {
    if (match.status !== "scheduled") {
      setError("Only scheduled matches can be deleted.");
      return;
    }

    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete match #${match.id}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(match.id);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/matches/${match.id}/`,
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
          getApiError(data, "Unable to delete match.")
        );
      }

      if (editingId === match.id) {
        resetForm();
      }

      await loadMatches();

      setMessage("Match deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete match."
      );
    } finally {
      setDeletingId(null);
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
            Match Management
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Schedule fixtures, manage matches and monitor their status.
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

        {/* Tournament and round selection */}

        <section className="mb-7 grid gap-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 md:grid-cols-2">
          <div>
            <label htmlFor="event-select" className={labelClass}>
              Tournament
            </label>

            <select
              id="event-select"
              value={selectedEventId}
              onChange={(event) => {
                setSelectedEventId(event.target.value);
                setError("");
                setMessage("");
              }}
              disabled={loading || saving || deletingId !== null}
              className={inputClass}
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
            <label htmlFor="round-select" className={labelClass}>
              Round
            </label>

            <select
              id="round-select"
              value={selectedRoundId}
              onChange={(event) => {
                setSelectedRoundId(event.target.value);
                resetForm();
                setError("");
                setMessage("");
              }}
              disabled={
                loadingEventData ||
                sortedRounds.length === 0 ||
                saving ||
                deletingId !== null
              }
              className={inputClass}
            >
              <option value="">Select round</option>

              {sortedRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.order_number}. {round.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Summary */}

        <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Total Matches",
              count: filteredMatches.length,
            },
            {
              label: "Scheduled",
              count: scheduledCount,
            },
            {
              label: "Live",
              count: liveCount,
            },
            {
              label: "Finished",
              count: finishedCount,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {item.label}
              </p>

              <p className="mt-3 text-3xl font-bold">
                {item.count}
              </p>
            </div>
          ))}
        </section>

        {/* Create / Edit form */}

        <section className="mb-9 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {editingId !== null
                  ? `Edit Match #${editingId}`
                  : "Schedule Match"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {selectedEvent
                  ? `${selectedEvent.name} · ${
                      selectedRound?.name ?? "Select a round"
                    }`
                  : "Select a tournament and round first."}
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
              >
                Cancel Editing
              </button>
            )}
          </div>

          {selectedEventId &&
            !loadingEventData &&
            eventTeams.length < 2 && (
              <div className="mb-6 rounded-xl border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
                This tournament needs at least two registered teams
                before a match can be scheduled.{" "}
                <Link
                  href="/admin/event-teams"
                  className="font-semibold underline"
                >
                  Register teams
                </Link>
              </div>
            )}

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-2"
          >
            <div>
              <label htmlFor="home-team" className={labelClass}>
                Home Team
              </label>

              <select
                id="home-team"
                value={form.homeTeamId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    homeTeamId: event.target.value,
                  }))
                }
                disabled={
                  !selectedRoundId ||
                  loadingEventData ||
                  saving
                }
                className={inputClass}
                required
              >
                <option value="">Select home team</option>

                {eventTeams.map((registration) => {
                  const team = registration.team;
                  const unavailable =
                    usedTeamIds.has(registration.team_id) ||
                    form.awayTeamId ===
                      String(registration.team_id);

                  return (
                    <option
                      key={registration.id}
                      value={registration.team_id}
                      disabled={unavailable}
                    >
                      {team.name} ({team.code})
                      {usedTeamIds.has(registration.team_id)
                        ? " — already scheduled"
                        : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="away-team" className={labelClass}>
                Away Team
              </label>

              <select
                id="away-team"
                value={form.awayTeamId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    awayTeamId: event.target.value,
                  }))
                }
                disabled={
                  !selectedRoundId ||
                  loadingEventData ||
                  saving
                }
                className={inputClass}
                required
              >
                <option value="">Select away team</option>

                {eventTeams.map((registration) => {
                  const team = registration.team;
                  const unavailable =
                    usedTeamIds.has(registration.team_id) ||
                    form.homeTeamId ===
                      String(registration.team_id);

                  return (
                    <option
                      key={registration.id}
                      value={registration.team_id}
                      disabled={unavailable}
                    >
                      {team.name} ({team.code})
                      {usedTeamIds.has(registration.team_id)
                        ? " — already scheduled"
                        : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="scheduled-at" className={labelClass}>
                Scheduled Date &amp; Time
              </label>

              <input
                id="scheduled-at"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheduledAt: event.target.value,
                  }))
                }
                disabled={!selectedRoundId || saving}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="venue" className={labelClass}>
                Venue
              </label>

              <input
                id="venue"
                type="text"
                value={form.venue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    venue: event.target.value,
                  }))
                }
                placeholder="e.g. Jinnah Stadium, Islamabad"
                disabled={!selectedRoundId || saving}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={
                saving ||
                loadingEventData ||
                loadingMatches ||
                !selectedRoundId ||
                eventTeams.length < 2 ||
                deletingId !== null
              }
              className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Save Match Changes"
                  : "+ Schedule Match"}
            </button>
          </form>
        </section>

        {/* Match list */}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {selectedRound?.name ?? "Tournament Fixtures"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Matches belonging to the selected round.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadMatches()}
              disabled={loadingMatches}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {loadingMatches ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingMatches ? (
            <div className="py-14 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

              <p className="mt-4 text-sm text-slate-400">
                Loading matches...
              </p>
            </div>
          ) : !selectedRoundId ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center text-sm text-slate-400">
              Select a tournament round to view its matches.
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center">
              <div className="text-4xl">⚽</div>

              <h3 className="mt-4 text-lg font-semibold">
                No matches scheduled
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Use the form above to schedule the first fixture.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredMatches.map((match) => {
                const homeTeam = teamMap.get(match.home_team);
                const awayTeam = teamMap.get(match.away_team);

                return (
                  <article
                    key={match.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusClass(
                          match.status
                        )}`}
                      >
                        {match.status}
                      </span>

                      <span className="text-xs text-slate-500">
                        Match #{match.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                      <div className="min-w-0">
                        <p className="break-words text-base font-bold">
                          {homeTeam?.name ??
                            `Team #${match.home_team}`}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Home
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-extrabold text-slate-400">
                        {match.status === "scheduled"
                          ? "VS"
                          : `${match.home_score ?? 0} - ${
                              match.away_score ?? 0
                            }`}
                      </div>

                      <div className="min-w-0">
                        <p className="break-words text-base font-bold">
                          {awayTeam?.name ??
                            `Team #${match.away_team}`}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Away
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2 border-t border-slate-800 pt-4 text-sm text-slate-400">
                      <p>🕐 {formatDate(match.scheduled_at)}</p>

                      <p>
                        📍 {match.venue || "Venue not specified"}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/matches/${match.id}`}
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
                      >
                        Manage Match
                      </Link>

                      {match.status === "scheduled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEditing(match)}
                            disabled={
                              saving || deletingId !== null
                            }
                            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteMatch(match)
                            }
                            disabled={
                              saving || deletingId !== null
                            }
                            className="rounded-xl border border-red-900 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
                          >
                            {deletingId === match.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Match Administration
        </footer>
      </div>
    </main>
  );
}
