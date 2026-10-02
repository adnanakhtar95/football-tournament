
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/* =========================================
   TYPES
========================================= */

interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "completed";
  teams?: unknown[];
  rounds?: unknown[];
}

interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
}

/* =========================================
   HELPERS
========================================= */

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      `Empty response from ${response.url} (HTTP ${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON from ${response.url} (HTTP ${response.status}).`
    );
  }
}

function extractEvents(data: unknown): Event[] {
  if (Array.isArray(data)) {
    return data as Event[];
  }

  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray(data.results)
  ) {
    return data.results as Event[];
  }

  return [];
}

function formatDate(value: string): string {
  if (!value) return "To be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "To be announced";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusStyle(status: Event["status"]): string {
  switch (status) {
    case "active":
      return "border-green-800 bg-green-500/10 text-green-400";

    case "completed":
      return "border-slate-700 bg-slate-800 text-slate-300";

    default:
      return "border-amber-800 bg-amber-500/10 text-amber-400";
  }
}

function statusLabel(status: Event["status"]): string {
  switch (status) {
    case "active":
      return "● Active";

    case "completed":
      return "Completed";

    default:
      return "Draft";
  }
}

/* =========================================
   EVENTS PAGE
========================================= */

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const [filter, setFilter] = useState<
    "all" | Event["status"]
  >("all");

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /* =========================================
     FETCH EVENTS
  ========================================= */

  const loadEvents = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const response = await fetch(`${API_BASE_URL}/events/`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load tournaments (HTTP ${response.status}).`
          );
        }

        const data = await readJson(response);

        setEvents(extractEvents(data));
        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournaments."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    []
  );

  /* =========================================
     INITIAL LOAD
  ========================================= */

  useEffect(() => {
    void loadEvents(true);
  }, [loadEvents]);

  /* =========================================
     GLOBAL REALTIME WEBSOCKET

     Fixes:
     - React Strict Mode cleanup warning.
     - Reconnection after unexpected disconnect.
     - Safe cleanup while socket is CONNECTING.
     - Prevents reconnect after component unmount.
  ========================================= */

  useEffect(() => {
    let active = true;

    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null =
      null;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (active) {
          void loadEvents();
        }
      }, 350);
    }

    function connect() {
      if (!active) return;

      const backendUrl = new URL(API_BASE_URL);

      const protocol =
        backendUrl.protocol === "https:" ? "wss:" : "ws:";

      const websocketUrl = `${protocol}//${backendUrl.host}/ws/live/`;

      const currentSocket = new WebSocket(websocketUrl);

      socket = currentSocket;

      /*
        IMPORTANT:

        React Strict Mode may unmount the component before
        the WebSocket connection finishes opening.

        If that happens, wait until OPEN before closing.
      */

      currentSocket.addEventListener("open", () => {
        if (!active) {
          currentSocket.close(
            1000,
            "Component unmounted"
          );
        }
      });

      currentSocket.onopen = () => {
        if (!active) return;

        setConnected(true);

        // Refresh data after a successful connection.
        scheduleRefresh();
      };

      currentSocket.onmessage = (message: MessageEvent) => {
        if (!active) return;

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          if (data.type === "connection") {
            return;
          }

          if (
            data.match_id !== undefined ||
            data.event === "match_started" ||
            data.event === "match_finished"
          ) {
            scheduleRefresh();
          }
        } catch (err) {
          console.error(
            "Events WebSocket message error:",
            err
          );
        }
      };

      currentSocket.onerror = () => {
        if (!active) return;

        setConnected(false);
      };

      currentSocket.onclose = () => {
        if (!active) return;

        setConnected(false);

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          if (active) {
            connect();
          }
        }, 3000);
      };
    }

    connect();

    /* =========================================
       SAFE WEBSOCKET CLEANUP
    ========================================= */

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      const currentSocket = socket;

      if (!currentSocket) return;

      // Remove handlers to prevent updates after unmount.
      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;

      if (currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.close(
          1000,
          "Component unmounted"
        );
      }

      /*
        Do NOT call close() while CONNECTING.

        The addEventListener("open") handler above
        will close the abandoned socket safely.
      */
    };
  }, [loadEvents]);

  /* =========================================
     EVENT STATISTICS
  ========================================= */

  const activeEvents = events.filter(
    (event) => event.status === "active"
  );

  const completedEvents = events.filter(
    (event) => event.status === "completed"
  );

  const draftEvents = events.filter(
    (event) => event.status === "draft"
  );

  /* =========================================
     FILTERED EVENTS
  ========================================= */

  const filteredEvents = useMemo(() => {
    const selected =
      filter === "all"
        ? events
        : events.filter((event) => event.status === filter);

    const priority: Record<Event["status"], number> = {
      active: 0,
      draft: 1,
      completed: 2,
    };

    return [...selected].sort(
      (a, b) => priority[a.status] - priority[b.status]
    );
  }, [events, filter]);

  /* =========================================
     PAGE UI
  ========================================= */

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* PAGE HERO */}

      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-14 sm:py-20">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-blue-400"
          >
            ← Back to Home
          </Link>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-800 bg-blue-950/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-300">
              Football Competitions
            </span>

            {/* CONNECTION INDICATOR */}

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                connected
                  ? "border-green-800 bg-green-500/10 text-green-400"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected
                    ? "bg-green-400"
                    : "bg-slate-500"
                }`}
              />

              {connected
                ? "Live Updates Connected"
                : "Connecting to Live Updates..."}
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Explore{" "}
            <span className="text-blue-400">
              Tournaments.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
            Discover football competitions, follow your favourite
            teams, explore match fixtures and stay up to date
            with tournament standings.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/live"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold transition hover:bg-blue-500"
            >
              ● Watch Live Matches →
            </Link>

            <Link
              href="/matches"
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-bold transition hover:border-blue-600"
            >
              Match Centre
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-6 py-12">
        {/* SUMMARY CARDS */}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Total Tournaments",
              value: events.length,
              icon: "🏆",
            },
            {
              label: "Active",
              value: activeEvents.length,
              icon: "🟢",
            },
            {
              label: "Completed",
              value: completedEvents.length,
              icon: "🏁",
            },
            {
              label: "Draft",
              value: draftEvents.length,
              icon: "📋",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400 sm:text-sm">
                  {stat.label}
                </span>

                <span className="text-xl">
                  {stat.icon}
                </span>
              </div>

              <p className="mt-5 text-3xl font-black">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* TOURNAMENT DIRECTORY */}

        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Competition Directory
              </p>

              <h2 className="mt-2 text-3xl font-black">
                All Football Events
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Select a tournament to view its teams, fixtures
                and league table.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadEvents(true)}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          {/* FILTER TABS */}

          <div className="mb-7 flex flex-wrap gap-2">
            {(
              [
                {
                  value: "all",
                  label: "All Events",
                  count: events.length,
                },
                {
                  value: "active",
                  label: "Active",
                  count: activeEvents.length,
                },
                {
                  value: "completed",
                  label: "Completed",
                  count: completedEvents.length,
                },
                {
                  value: "draft",
                  label: "Draft",
                  count: draftEvents.length,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  filter === tab.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
              >
                {tab.label}

                <span className="ml-2 opacity-70">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ERROR MESSAGE */}

          {error && (
            <div className="mb-7 rounded-xl border border-red-900 bg-red-950/40 p-5 text-sm text-red-300">
              <p className="font-bold">
                Unable to load tournaments
              </p>

              <p className="mt-2">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadEvents(true)}
                className="mt-4 font-bold text-red-200 underline underline-offset-4 hover:text-white"
              >
                Try again
              </button>
            </div>
          )}

          {/* LOADING STATE */}

          {loading && events.length === 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-6"
                >
                  <div className="mb-7 h-12 w-12 rounded-xl bg-slate-800" />

                  <div className="h-6 w-2/3 rounded bg-slate-800" />

                  <div className="mt-5 h-4 w-full rounded bg-slate-800" />

                  <div className="mt-3 h-4 w-4/5 rounded bg-slate-800" />

                  <div className="mt-9 h-12 rounded-xl bg-slate-800" />
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            /* EMPTY STATE */

            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-16 text-center">
              <div className="text-5xl">🏆</div>

              <h3 className="mt-5 text-xl font-black">
                No tournaments found
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">
                {filter === "all"
                  ? "There are currently no football tournaments to display."
                  : `There are no ${filter} tournaments available at the moment.`}
              </p>

              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold transition hover:bg-blue-500"
                >
                  View All Events
                </button>
              )}
            </div>
          ) : (
            /* EVENT CARDS */

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:-translate-y-1 hover:border-blue-700 hover:shadow-xl hover:shadow-blue-950/20"
                >
                  {/* CARD HEADER */}

                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-800/30 p-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-900 bg-blue-950/50 text-3xl">
                      🏆
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${statusStyle(
                        event.status
                      )}`}
                    >
                      {statusLabel(event.status)}
                    </span>
                  </div>

                  {/* CARD BODY */}

                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-xl font-black transition group-hover:text-blue-400">
                      {event.name}
                    </h3>

                    <p className="mt-4 line-clamp-3 min-h-[72px] text-sm leading-6 text-slate-400">
                      {event.description ||
                        "Follow the competition, discover participating teams and explore match fixtures."}
                    </p>

                    {/* EVENT DATES */}

                    <div className="mt-6 space-y-4 border-t border-slate-800 pt-6">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">
                          Start Date
                        </span>

                        <span className="text-right font-semibold text-slate-200">
                          {formatDate(event.start_date)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">
                          End Date
                        </span>

                        <span className="text-right font-semibold text-slate-200">
                          {formatDate(event.end_date)}
                        </span>
                      </div>
                    </div>

                    {/* VIEW TOURNAMENT */}

                    <div className="mt-auto pt-7">
                      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-bold text-blue-400 transition group-hover:border-blue-700 group-hover:bg-blue-950/30">
                        <span>View Tournament</span>
                        <span>→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* FOOTER CTA */}

        <section className="rounded-3xl border border-blue-900 bg-gradient-to-r from-blue-950/60 to-slate-900 px-7 py-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
            Football Match Centre
          </p>

          <h2 className="mt-4 text-2xl font-black sm:text-3xl">
            Never Miss a Goal.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Follow matches as they happen with realtime scores
            and match event updates.
          </p>

          <Link
            href="/live"
            className="mt-7 inline-block rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold transition hover:bg-blue-500"
          >
            Open Live Scoreboard →
          </Link>
        </section>
      </div>
    </main>
  );
}
