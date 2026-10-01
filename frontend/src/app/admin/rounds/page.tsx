"use client";

import { FormEvent, useEffect, useState } from "react";
import { Event } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Round {
  id: number;
  event: number;
  name: string;
  order_number: number;
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

export default function AdminRoundsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);

  const [selectedEventId, setSelectedEventId] = useState("");

  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

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

    const data = await response.json();

    setEvents(data.results || []);

    if (data.results?.length && !selectedEventId) {
      setSelectedEventId(String(data.results[0].id));
    }
  }

  async function loadRounds(eventId: string) {
    if (!eventId) {
      setRounds([]);
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

    const data = await response.json();

    setRounds(data.results || []);
  }

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        await loadEvents();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load events."
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;

    loadRounds(selectedEventId).catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load rounds."
      );
    });
  }, [selectedEventId]);

  async function handleCreateRound(event: FormEvent) {
    event.preventDefault();

    if (!selectedEventId) {
      setError("Select an event first.");
      return;
    }

    if (!name.trim()) {
      setError("Round name is required.");
      return;
    }

    if (!orderNumber || Number(orderNumber) < 1) {
      setError("Order number must be at least 1.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/rounds/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "",
          },
          body: JSON.stringify({
            event: Number(selectedEventId),
            name: name.trim(),
            order_number: Number(orderNumber),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.order_number?.[0] ||
            data.name?.[0] ||
            "Unable to create round."
        );
      }

      setName("");
      setOrderNumber("");

      setMessage("Round created successfully.");

      await loadRounds(selectedEventId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create round."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRound(roundId: number) {
    if (
      !confirm(
        "Delete this round? Matches belonging to it will also be affected."
      )
    ) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/rounds/${roundId}/`,
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
          data.detail || "Unable to delete round."
        );
      }

      setMessage("Round deleted.");

      await loadRounds(selectedEventId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete round."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b16] p-8 text-white">
        <p className="text-slate-400">Loading rounds...</p>
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
            Rounds
          </h1>

          <p className="mt-2 text-slate-400">
            Create and organize tournament rounds.
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
            Create Round
          </h2>

          <form
            onSubmit={handleCreateRound}
            className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <select
              value={selectedEventId}
              onChange={(e) =>
                setSelectedEventId(e.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none focus:border-blue-500"
            >
              {events.length === 0 && (
                <option value="">
                  No events available
                </option>
              )}

              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Round name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <input
              type="number"
              min="1"
              placeholder="Order number"
              value={orderNumber}
              onChange={(e) =>
                setOrderNumber(e.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#111a2d] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={saving || !selectedEventId}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Round"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-xl">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Tournament Rounds
              </h2>

              <p className="text-sm text-slate-400">
                {events.find(
                  (event) =>
                    event.id === Number(selectedEventId)
                )?.name || "Select an event"}
              </p>
            </div>

            <span className="rounded-full bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
              {rounds.length} rounds
            </span>
          </div>

          {rounds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center text-slate-500">
              No rounds created for this event.
            </div>
          ) : (
            <div className="space-y-3">
              {rounds
                .sort(
                  (a, b) =>
                    a.order_number - b.order_number
                )
                .map((round) => (
                  <div
                    key={round.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111a2d] p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 font-bold text-blue-300">
                        {round.order_number}
                      </div>

                      <div>
                        <p className="font-semibold">
                          {round.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          Round {round.order_number}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteRound(round.id)
                      }
                      className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                    >
                      Delete
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
