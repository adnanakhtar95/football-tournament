
"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

type EventStatus = "draft" | "active" | "completed";

interface TournamentEvent {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: EventStatus;
}

interface EventForm {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: EventStatus;
}

const EMPTY_FORM: EventForm = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  status: "draft",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const labelClass = "mb-2 block text-sm font-semibold text-slate-300";

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
    throw new Error(
      "CSRF cookie missing. Use localhost for both frontend and backend."
    );
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

function toDateTimeLocal(value: string): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function formatDate(value: string): string {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function statusClass(status: EventStatus): string {
  switch (status) {
    case "active":
      return "border-green-800 bg-green-950/50 text-green-400";

    case "completed":
      return "border-blue-800 bg-blue-950/50 text-blue-400";

    default:
      return "border-slate-600 bg-slate-800 text-slate-300";
  }
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [form, setForm] = useState<EventForm>({ ...EMPTY_FORM });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  
const loadEvents = useCallback(async () => {
  try {
    setLoading(true);

    const allEvents: TournamentEvent[] = [];

    let nextUrl: string | null =
      `${API_BASE_URL}/admin/events/`;

    while (nextUrl !== null) {
      const currentUrl: string = nextUrl;

      const response = await fetch(currentUrl, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load events (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        allEvents.push(...data);
        nextUrl = null;
      } else {
        allEvents.push(...(data.results ?? []));

        nextUrl = data.next
          ? new URL(data.next, currentUrl).toString()
          : null;
      }
    }

    setEvents(allEvents);
  } catch (error) {
    setMessageType("error");

    setMessage(
      error instanceof Error
        ? error.message
        : "Unable to connect to the backend."
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  function showMessage(
    text: string,
    type: "success" | "error" = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function beginEditing(event: TournamentEvent) {
    setEditingId(event.id);

    setForm({
      name: event.name,
      description: event.description ?? "",
      start_date: toDateTimeLocal(event.start_date),
      end_date: toDateTimeLocal(event.end_date),
      status: event.status,
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (new Date(form.end_date) < new Date(form.start_date)) {
      showMessage(
        "End date cannot be earlier than the start date.",
        "error"
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const isEditing = editingId !== null;

    try {
      const csrfToken = await getCsrfToken();

      const url = isEditing
        ? `${API_BASE_URL}/admin/events/${editingId}/`
        : `${API_BASE_URL}/admin/events/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            isEditing
              ? "Unable to update event."
              : "Unable to create event."
          )
        );
      }

      resetForm();

      await loadEvents();

      showMessage(
        isEditing
          ? "Event updated successfully."
          : "Event created successfully."
      );
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Unable to save event.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event: TournamentEvent) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${event.name}"?\n\nThis may also remove related tournament data. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(event.id);
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/events/${event.id}/`,
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
          getApiError(data, "Unable to delete event.")
        );
      }

      if (editingId === event.id) {
        resetForm();
      }

      await loadEvents();
      showMessage("Event deleted successfully.");
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Unable to delete event.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const activeCount = events.filter(
    (event) => event.status === "active"
  ).length;

  const draftCount = events.filter(
    (event) => event.status === "draft"
  ).length;

  const completedCount = events.filter(
    (event) => event.status === "completed"
  ).length;

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

          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
              Tournament Administration
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              Event Management
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              Create, edit and manage football tournaments.
            </p>
          </div>
        </header>

        {/* Summary cards */}

        <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Events", value: events.length },
            { label: "Active", value: activeCount },
            { label: "Draft", value: draftCount },
            { label: "Completed", value: completedCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {item.label}
              </p>

              <p className="mt-3 text-3xl font-bold text-white">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        {/* Feedback */}

        {message && (
          <div
            role="alert"
            className={`mb-7 rounded-xl border px-5 py-4 text-sm ${
              messageType === "error"
                ? "border-red-900 bg-red-950/40 text-red-300"
                : "border-green-900 bg-green-950/30 text-green-300"
            }`}
          >
            {message}
          </div>
        )}

        {/* Create / Edit form */}

        <section className="mb-11 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {editingId !== null
                  ? `Edit Event #${editingId}`
                  : "Create New Event"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {editingId !== null
                  ? "Update the selected tournament information."
                  : "Set up a new football tournament."}
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
              >
                Cancel Editing
              </button>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label htmlFor="event-name" className={labelClass}>
                Event Name
              </label>

              <input
                id="event-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g. Islamabad Football Cup"
                className={inputClass}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="event-description" className={labelClass}>
                Description
              </label>

              <textarea
                id="event-description"
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe the tournament..."
                rows={4}
                className={`${inputClass} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="start-date" className={labelClass}>
                Start Date
              </label>

              <input
                id="start-date"
                type="datetime-local"
                value={form.start_date}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    start_date: e.target.value,
                  }))
                }
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="end-date" className={labelClass}>
                End Date
              </label>

              <input
                id="end-date"
                type="datetime-local"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    end_date: e.target.value,
                  }))
                }
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="event-status" className={labelClass}>
                Status
              </label>

              <select
                id="event-status"
                value={form.status}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    status: e.target.value as EventStatus,
                  }))
                }
                className={inputClass}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "+ Create Event"}
              </button>
            </div>
          </form>
        </section>

        {/* Existing events */}

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Existing Events
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Manage your tournament records.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

              <p className="mt-5 text-sm text-slate-400">
                Loading tournament events...
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900 px-6 py-16 text-center">
              <div className="text-5xl">🏆</div>

              <h3 className="mt-5 text-xl font-semibold">
                No events yet
              </h3>

              <p className="mt-3 text-sm text-slate-400">
                Create your first tournament using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(
                        event.status
                      )}`}
                    >
                      {event.status}
                    </span>

                    <span className="text-xs text-slate-500">
                      Event #{event.id}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    {event.name}
                  </h3>

                  <p className="mt-3 min-h-12 flex-1 text-sm leading-6 text-slate-400">
                    {event.description || "No description provided."}
                  </p>

                  <div className="mt-6 space-y-4 border-y border-slate-800 py-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Start Date
                      </p>

                      <p className="mt-1 text-sm text-slate-200">
                        {formatDate(event.start_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        End Date
                      </p>

                      <p className="mt-1 text-sm text-slate-200">
                        {formatDate(event.end_date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => beginEditing(event)}
                      disabled={saving || deletingId !== null}
                      className="flex-1 rounded-xl border border-blue-800 bg-blue-950/30 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteEvent(event)}
                      disabled={saving || deletingId !== null}
                      className="flex-1 rounded-xl border border-red-900 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingId === event.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>

                    <Link
                      href={`/events/${event.id}`}
                      className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                    >
                      View Public Event →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Event Administration
        </footer>
      </div>
    </main>
  );
}
