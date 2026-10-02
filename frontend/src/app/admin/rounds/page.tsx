
"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface TournamentEvent {
  id: number;
  name: string;
  status: "draft" | "active" | "completed";
}

interface TournamentRound {
  id: number;
  event: number;
  name: string;
  order_number: number;
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50";

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

export default function AdminRoundsPage() {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");

  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tournaments."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadRounds = useCallback(
    async (eventId: string, signal?: AbortSignal) => {
      if (!eventId) {
        setRounds([]);
        return;
      }

      try {
        setLoadingRounds(true);
        setError("");

        const data = await fetchAllPages<TournamentRound>(
          `${API_BASE_URL}/admin/rounds/?event=${encodeURIComponent(
            eventId
          )}`,
          signal
        );

        if (signal?.aborted) return;

        setRounds(
          data
            .filter((round) => round.event === Number(eventId))
            .sort(
              (a, b) =>
                a.order_number - b.order_number || a.id - b.id
            )
        );
      } catch (err) {
        if (signal?.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournament rounds."
        );
      } finally {
        if (!signal?.aborted) {
          setLoadingRounds(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadEvents(controller.signal);

    return () => controller.abort();
  }, [loadEvents]);

  useEffect(() => {
    const controller = new AbortController();

    setRounds([]);
    resetForm();

    if (selectedEventId) {
      void loadRounds(selectedEventId, controller.signal);
    }

    return () => controller.abort();
  }, [selectedEventId, loadRounds]);

  const sortedRounds = useMemo(
    () =>
      [...rounds].sort(
        (a, b) =>
          a.order_number - b.order_number || a.id - b.id
      ),
    [rounds]
  );

  const selectedEvent = events.find(
    (event) => event.id === Number(selectedEventId)
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setOrderNumber("");
  }

  function beginEditing(round: TournamentRound) {
    setEditingId(round.id);
    setName(round.name);
    setOrderNumber(String(round.order_number));

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

    const parsedOrder = Number(orderNumber);

    if (!selectedEventId) {
      setError("Please select a tournament.");
      return;
    }

    if (!name.trim()) {
      setError("Round name is required.");
      return;
    }

    if (
      !orderNumber.trim() ||
      !Number.isInteger(parsedOrder) ||
      parsedOrder < 1
    ) {
      setError("Order number must be a positive whole number.");
      return;
    }

    const duplicateOrder = rounds.find(
      (round) =>
        round.order_number === parsedOrder &&
        round.id !== editingId
    );

    if (duplicateOrder) {
      setError(
        `Order ${parsedOrder} is already used by "${duplicateOrder.name}" in this tournament.`
      );
      return;
    }

    const isEditing = editingId !== null;
    const eventId = selectedEventId;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const url = isEditing
        ? `${API_BASE_URL}/admin/rounds/${editingId}/`
        : `${API_BASE_URL}/admin/rounds/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          event: Number(eventId),
          name: name.trim(),
          order_number: parsedOrder,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            isEditing
              ? "Unable to update round."
              : "Unable to create round."
          )
        );
      }

      resetForm();

      await loadRounds(eventId);

      setMessage(
        isEditing
          ? "Round updated successfully."
          : "Round created successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save round."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRound(round: TournamentRound) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${round.name}" (Round ${round.order_number})?\n\nMatches belonging to this round may also be deleted or affected. This action cannot be undone.`
    );

    if (!confirmed) return;

    const eventId = selectedEventId;

    setDeletingId(round.id);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/rounds/${round.id}/`,
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
          getApiError(data, "Unable to delete round.")
        );
      }

      if (editingId === round.id) {
        resetForm();
      }

      await loadRounds(eventId);

      setMessage("Round deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete round."
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
            Rounds Management
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Organize tournament rounds and manage their sequence.
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

        {/* Event selection */}

        <section className="mb-7 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <label
            htmlFor="event-select"
            className="mb-3 block text-sm font-semibold text-slate-300"
          >
            Select Tournament
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

          {loading && (
            <p className="mt-3 text-xs text-slate-500">
              Loading tournaments...
            </p>
          )}
        </section>

        {/* Summary */}

        <section className="mb-7 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Tournament Rounds
            </p>

            <p className="mt-3 text-3xl font-bold">
              {sortedRounds.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Next Order Number
            </p>

            <p className="mt-3 text-3xl font-bold">
              {sortedRounds.length > 0
                ? Math.max(
                    ...sortedRounds.map(
                      (round) => round.order_number
                    )
                  ) + 1
                : 1}
            </p>
          </div>
        </section>

        {/* Create / Edit form */}

        <section className="mb-9 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {editingId !== null
                  ? `Edit Round #${editingId}`
                  : "Create New Round"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {editingId !== null
                  ? "Update the selected tournament round."
                  : "Give each round a name and unique order number."}
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

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-[2fr_1fr_auto] md:items-end"
          >
            <div>
              <label
                htmlFor="round-name"
                className="mb-2 block text-sm font-semibold text-slate-300"
              >
                Round Name
              </label>

              <input
                id="round-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Group Stage - Round 1"
                disabled={!selectedEventId || saving}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label
                htmlFor="round-order"
                className="mb-2 block text-sm font-semibold text-slate-300"
              >
                Order Number
              </label>

              <input
                id="round-order"
                type="number"
                min="1"
                step="1"
                value={orderNumber}
                onChange={(event) =>
                  setOrderNumber(event.target.value)
                }
                placeholder="e.g. 1"
                disabled={!selectedEventId || saving}
                className={inputClass}
                required
              />
            </div>

            <button
              type="submit"
              disabled={
                !selectedEventId ||
                loadingRounds ||
                saving ||
                deletingId !== null
              }
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "+ Create Round"}
            </button>
          </form>
        </section>

        {/* Existing rounds */}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Tournament Rounds
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {selectedEvent
                  ? selectedEvent.name
                  : "Select a tournament to view its rounds."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedEventId) {
                  void loadRounds(selectedEventId);
                }
              }}
              disabled={!selectedEventId || loadingRounds}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {loadingRounds ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingRounds ? (
            <div className="py-14 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

              <p className="mt-4 text-sm text-slate-400">
                Loading rounds...
              </p>
            </div>
          ) : !selectedEventId ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center text-sm text-slate-400">
              Select a tournament first.
            </div>
          ) : sortedRounds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center">
              <div className="text-4xl">🏆</div>

              <h3 className="mt-4 text-lg font-semibold">
                No rounds created
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Create the first round using the form above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRounds.map((round) => (
                <article
                  key={round.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-900 bg-blue-950/40 text-lg font-extrabold text-blue-300">
                      {round.order_number}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {round.name}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Order {round.order_number} · ID #{round.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => beginEditing(round)}
                      disabled={saving || deletingId !== null}
                      className="rounded-xl border border-blue-800 bg-blue-950/30 px-5 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteRound(round)}
                      disabled={saving || deletingId !== null}
                      className="rounded-xl border border-red-900 bg-red-950/20 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingId === round.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Round Administration
        </footer>
      </div>
    </main>
  );
}
