
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Radio,
  RefreshCw,
  Search,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

type EventFilter = "all" | Event["status"];

/*
  Image-led card design.

  These are public remote background images used through CSS,
  so Next.js Image remotePatterns configuration is not required.
*/

const cardImages = [
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1100&q=85",
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1100&q=85",
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1100&q=85",
  "https://images.unsplash.com/photo-1508098682722-e99c43a748b4?auto=format&fit=crop&w=1100&q=85",
];

function getCardImage(index: number) {
  return cardImages[index % cardImages.length];
}

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
  if (Array.isArray(data)) return data as Event[];

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

function formatDate(value: string) {
  if (!value) return "TBA";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "TBA";

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: Event["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    default:
      return "Draft";
  }
}

function statusStyle(status: Event["status"]) {
  switch (status) {
    case "active":
      return "border-[#F5C66C]/50 bg-[#1C1A13]/90 text-[#F5C66C]";
    case "completed":
      return "border-white/25 bg-[#151D26]/90 text-[#CBD5DF]";
    default:
      return "border-[#E9A84C]/40 bg-[#271C12]/90 text-[#F4B85D]";
  }
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const [filter, setFilter] = useState<EventFilter>("all");
  const [search, setSearch] = useState("");

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /* =========================================
     DATA FETCHING
  ========================================= */

  const loadEvents = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);

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
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents(true);
  }, [loadEvents]);

  /* =========================================
     REALTIME WEBSOCKET
     Existing functionality preserved.
  ========================================= */

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (active) void loadEvents();
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

      // Strict Mode safe cleanup for CONNECTING sockets.
      currentSocket.addEventListener("open", () => {
        if (!active) {
          currentSocket.close(1000, "Component unmounted");
        }
      });

      currentSocket.onopen = () => {
        if (!active) return;

        setConnected(true);
        scheduleRefresh();
      };

      currentSocket.onmessage = (message: MessageEvent) => {
        if (!active) return;

        try {
          const data = JSON.parse(message.data) as MatchUpdate;

          if (data.type === "connection") return;

          if (
            data.match_id !== undefined ||
            data.event === "match_started" ||
            data.event === "match_finished"
          ) {
            scheduleRefresh();
          }
        } catch (err) {
          console.error("Events WebSocket message error:", err);
        }
      };

      currentSocket.onerror = () => {
        if (active) setConnected(false);
      };

      currentSocket.onclose = () => {
        if (!active) return;

        setConnected(false);

        if (reconnectTimer) clearTimeout(reconnectTimer);

        reconnectTimer = setTimeout(() => {
          if (active) connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      active = false;

      if (reconnectTimer) clearTimeout(reconnectTimer);

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      const currentSocket = socket;

      if (!currentSocket) return;

      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;

      if (currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.close(1000, "Component unmounted");
      }
    };
  }, [loadEvents]);

  /* =========================================
     STATISTICS & FILTERING
  ========================================= */

  const activeCount = events.filter(
    (event) => event.status === "active"
  ).length;

  const completedCount = events.filter(
    (event) => event.status === "completed"
  ).length;

  const draftCount = events.filter(
    (event) => event.status === "draft"
  ).length;

  const filteredEvents = useMemo(() => {
    const priority: Record<Event["status"], number> = {
      active: 0,
      draft: 1,
      completed: 2,
    };

    return events
      .filter((event) => filter === "all" || event.status === filter)
      .filter((event) => {
        const query = search.trim().toLowerCase();

        if (!query) return true;

        return (
          event.name.toLowerCase().includes(query) ||
          (event.description || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => priority[a.status] - priority[b.status]);
  }, [events, filter, search]);

  const tabs = [
    { value: "all", label: "All Tournaments", count: events.length },
    { value: "active", label: "Active", count: activeCount },
    { value: "completed", label: "Completed", count: completedCount },
    { value: "draft", label: "Draft", count: draftCount },
  ] as const;

  return (
    <main className="min-h-screen bg-[#090E13] text-white">

      {/* =====================================
          CINEMATIC HERO
      ===================================== */}

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2000&q=90')",
          }}
        />

        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090E13_5%,rgba(9,14,19,0.94)_40%,rgba(9,14,19,0.38)_100%)]" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#090E13] via-transparent to-[#090E13]/20" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-10 md:px-8 lg:pb-20 lg:pt-14 xl:px-12">

          <Link
            href="/"
            className="mb-12 inline-flex items-center gap-2 text-xs font-semibold text-[#A4B0BA] transition hover:text-[#F5C66C]"
          >
            <ArrowLeft size={15} />
            Back to Home
          </Link>

          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="h-[2px] w-9 bg-[#F5C66C]" />

              <span className="text-[11px] font-bold uppercase tracking-[0.23em] text-[#D1D8DE]">
                The Competition Directory
              </span>
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold backdrop-blur ${
                connected
                  ? "border-[#F5C66C]/40 bg-[#F5C66C]/10 text-[#F5C66C]"
                  : "border-white/20 bg-black/40 text-[#A5B1BB]"
              }`}
            >
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}

              {connected ? "Realtime Connected" : "Connecting"}
            </span>
          </div>

          <h1 className="font-heading max-w-[1000px] text-[clamp(44px,5.4vw,76px)] font-extrabold leading-[1.05] tracking-[-0.065em]">
            THE STAGE IS SET.
            <br />
            <span className="text-[#F5C66C]">
              EXPLORE THE GAME.
            </span>
          </h1>

          <p className="mt-6 max-w-[590px] text-sm leading-7 text-[#B2BDC6] sm:text-base">
            Discover the competitions, meet the contenders and follow
            every fixture. One destination for tournament football.
          </p>

          {/* Compact statistics strip */}

          <div className="mt-11 grid max-w-[1050px] grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Tournaments",
                value: events.length,
                icon: Trophy,
              },
              {
                label: "Active",
                value: activeCount,
                icon: Radio,
              },
              {
                label: "Completed",
                value: completedCount,
                icon: CheckCircle2,
              },
              {
                label: "In Preparation",
                value: draftCount,
                icon: Clock3,
              },
            ].map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 rounded-lg border border-white/15 bg-[#101820]/80 px-4 py-4 backdrop-blur-md transition hover:border-[#F5C66C]/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5C66C]/10 text-[#F5C66C]">
                    <Icon size={20} strokeWidth={1.7} />
                  </div>

                  <div>
                    <p className="font-mono text-2xl font-bold leading-none text-white">
                      {loading ? "—" : stat.value}
                    </p>

                    <p className="mt-1.5 text-[10px] text-[#A1ADB8]">
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================
          DIRECTORY
      ===================================== */}

      <section className="mx-auto max-w-[1440px] px-5 py-11 md:px-8 xl:px-12">

        {/* Heading */}

        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#F5C66C]">
              Discover Competitions
            </p>

            <h2 className="font-heading text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
              Tournament Directory
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void loadEvents(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[#33404B] bg-[#141D25] px-4 py-2.5 text-xs font-bold text-[#D4DEE6] transition hover:border-[#F5C66C]/50 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Filters and search */}

        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold transition ${
                  filter === tab.value
                    ? "border-[#F5C66C] bg-[#F5C66C] text-[#10151B]"
                    : "border-[#303B46] bg-[#141C24] text-[#B1BDC7] hover:border-[#F5C66C]/50 hover:text-white"
                }`}
              >
                {tab.label}

                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    filter === tab.value
                      ? "bg-black/10"
                      : "bg-white/10"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-[300px]">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#83919E]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tournaments..."
              aria-label="Search tournaments"
              className="w-full rounded-lg border border-[#303B46] bg-[#141C24] py-3 pl-10 pr-4 text-xs text-white outline-none transition placeholder:text-[#71808D] focus:border-[#F5C66C]/60"
            />
          </div>
        </div>

        {/* Result count */}

        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs text-[#83919E]">
            Showing{" "}
            <span className="font-bold text-white">
              {filteredEvents.length}
            </span>{" "}
            competitions
          </p>

          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71808D]">
            Football Cup / Events
          </span>
        </div>

        {/* Error */}

        {error && (
          <div className="mb-6 rounded-lg border border-red-400/25 bg-red-400/10 p-5 text-sm text-red-200">
            <p className="font-bold">Unable to load tournaments</p>

            <p className="mt-2">{error}</p>

            <button
              type="button"
              onClick={() => void loadEvents(true)}
              className="mt-3 font-bold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* =====================================
            IMAGE-LED TOURNAMENT CARDS
        ===================================== */}

        {loading && events.length === 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="animate-pulse overflow-hidden rounded-xl border border-[#303B46] bg-[#111A22]"
              >
                <div className="h-44 bg-[#26323D]" />

                <div className="p-5">
                  <div className="h-6 w-2/3 rounded bg-[#26323D]" />
                  <div className="mt-4 h-4 w-full rounded bg-[#26323D]" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-[#26323D]" />
                  <div className="mt-6 h-10 rounded bg-[#26323D]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-[#303B46] bg-[#111A22] px-6 py-16 text-center">
            <Trophy size={35} className="text-[#F5C66C]" />

            <h3 className="font-heading mt-5 text-2xl font-bold">
              No tournaments found
            </h3>

            <p className="mt-3 max-w-sm text-sm leading-6 text-[#91A0AC]">
              Try changing your search or selecting a different
              competition category.
            </p>

            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-bold text-[#10151B]"
            >
              <X size={14} />
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((event, index) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[#34404B] bg-[#111A22] transition-all duration-300 hover:-translate-y-1 hover:border-[#F5C66C]/60 hover:shadow-[0_16px_45px_rgba(0,0,0,0.35)]"
              >

                {/* Photographic banner */}

                <div className="relative h-[170px] overflow-hidden bg-[#1E2A35]">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{
                      backgroundImage: `url("${getCardImage(index)}")`,
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#111A22] via-black/10 to-black/20" />

                  {/* Status badge */}

                  <span
                    className={`absolute right-4 top-4 rounded-md border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] backdrop-blur-md ${statusStyle(event.status)}`}
                  >
                    {statusLabel(event.status)}
                  </span>

                  {/* Tournament number */}

                  <div className="absolute bottom-4 left-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-white/90">
                    <Trophy size={15} className="text-[#F5C66C]" />
                    Competition {String(event.id).padStart(3, "0")}
                  </div>
                </div>

                {/* Compact content */}

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-[21px] font-bold leading-tight tracking-[-0.045em] text-white transition group-hover:text-[#F5C66C]">
                      {event.name}
                    </h3>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#F5C66C]/35 bg-[#F5C66C]/10 text-[#F5C66C] transition group-hover:bg-[#F5C66C] group-hover:text-[#10151B]">
                      <ArrowUpRight size={17} />
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 min-h-[40px] text-[12px] leading-5 text-[#9DAAB5]">
                    {event.description ||
                      "Explore the teams, fixtures, standings and tournament results."}
                  </p>

                  {/* Compact metadata strip */}

                  <div className="mt-auto grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-4">
                    <div className="flex items-start gap-2">
                      <CalendarDays
                        size={15}
                        className="mt-0.5 shrink-0 text-[#F5C66C]"
                      />

                      <div className="min-w-0">
                        <p className="text-[10px] text-[#788794]">
                          Start Date
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-[#E2E8ED]">
                          {formatDate(event.start_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock3
                        size={15}
                        className="mt-0.5 shrink-0 text-[#F5C66C]"
                      />

                      <div className="min-w-0">
                        <p className="text-[10px] text-[#788794]">
                          End Date
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-[#E2E8ED]">
                          {formatDate(event.end_date)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Optional team / round counts */}

                  {(Array.isArray(event.teams) ||
                    Array.isArray(event.rounds)) && (
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-white/[0.06] pt-3">
                      {Array.isArray(event.teams) && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[#A9B5BE]">
                          <Users size={13} className="text-[#F5C66C]" />
                          {event.teams.length} Teams
                        </span>
                      )}

                      {Array.isArray(event.rounds) && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[#A9B5BE]">
                          <Trophy size={13} className="text-[#F5C66C]" />
                          {event.rounds.length} Rounds
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* =====================================
          BOTTOM CTA
      ===================================== */}

      <section className="relative mt-8 overflow-hidden border-t border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#0A1016] via-[#0A1016]/90 to-[#0A1016]/60" />

        <div className="relative mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-8 px-5 py-14 md:flex-row md:items-center md:px-8 xl:px-12">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#F5C66C]">
              The Action Never Stops
            </p>

            <h2 className="font-heading mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
              Every goal. Every moment.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-[#A4B0BA]">
              Follow matches as they happen with real-time scores
              and match event updates.
            </p>
          </div>

          <Link
            href="/live"
            className="inline-flex shrink-0 items-center gap-3 rounded-lg bg-[#F5C66C] px-6 py-3.5 text-xs font-extrabold uppercase tracking-wide text-[#10151B] transition hover:bg-[#FFDA91]"
          >
            <Radio size={17} />
            Open Live Scoreboard
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
