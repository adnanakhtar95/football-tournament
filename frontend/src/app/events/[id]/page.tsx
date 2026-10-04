
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  Flag,
  MapPin,
  Radio,
  RefreshCw,
  Shield,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/* =========================================
   TYPES
========================================= */

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

interface TournamentEvent {
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

interface TopScorer {
  player_id: number;
  player_name: string;
  jersey_number: number;
  team_id: number;
  team_name: string;
  team_code: string;
  goals: number;
}

interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
  status?: Match["status"];
  home_score?: number;
  away_score?: number;
}

type Tab = "fixtures" | "teams" | "standings" | "scorers";

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

function formatDate(value: string) {
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

function formatDateTime(value: string) {
  if (!value) return "To be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "To be announced";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchStatusLabel(status: Match["status"]) {
  switch (status) {
    case "live":
      return "LIVE";

    case "finished":
      return "FULL TIME";

    default:
      return "UPCOMING";
  }
}

function matchStatusClass(status: Match["status"]) {
  switch (status) {
    case "live":
      return "border-[#EF6672]/40 bg-[#EF6672]/10 text-[#FF818A]";

    case "finished":
      return "border-white/15 bg-white/[0.06] text-[#BAC5CE]";

    default:
      return "border-[#F5C66C]/25 bg-[#F5C66C]/[0.07] text-[#E7C181]";
  }
}

/* =========================================
   TEAM EMBLEM
========================================= */

function TeamMark({
  team,
  large = false,
}: {
  team: Team;
  large?: boolean;
}) {
  return (
    <div
      className={`
        flex shrink-0 items-center justify-center overflow-hidden
        rounded-xl border border-[#F5C66C]/25
        bg-[linear-gradient(145deg,#30333B,#151C25)]
        font-heading font-extrabold tracking-tight text-[#F5C66C]
        ${
          large
            ? "h-14 w-14 text-base sm:h-16 sm:w-16"
            : "h-10 w-10 text-xs sm:h-12 sm:w-12"
        }
      `}
    >
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt={`${team.name} logo`}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        team.code.slice(0, 3).toUpperCase()
      )}
    </div>
  );
}

/* =========================================
   FIXTURE / MATCH ROW
========================================= */

function MatchRow({ match }: { match: Match }) {
  const played = match.status !== "scheduled";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group block border-b border-white/[0.07]
        px-4 py-5 transition
        hover:bg-[#F5C66C]/[0.035]
        last:border-b-0 sm:px-7
      "
    >
      {/* Match date and status */}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8D9BA8]">
        <span className="flex items-center gap-2">
          <CalendarDays
            size={13}
            className="text-[#C6A469]"
          />

          {formatDateTime(match.scheduled_at)}
        </span>

        <span
          className={`
            rounded-md border px-2.5 py-1
            text-[10px] font-extrabold tracking-[0.09em]
            ${matchStatusClass(match.status)}
          `}
        >
          {match.status === "live" ? "● " : ""}
          {matchStatusLabel(match.status)}
        </span>
      </div>

      {/* Scoreboard */}

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">

        {/* Home team */}

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamMark team={match.home_team} />

          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white sm:text-base">
              {match.home_team.name}
            </p>

            <p className="mt-1 font-mono text-[10px] text-[#82909D]">
              {match.home_team.code}
            </p>
          </div>
        </div>

        {/* Score */}

        <div className="min-w-[80px] text-center sm:min-w-[130px]">
          <p className="font-mono text-2xl font-bold tracking-[-0.075em] text-white sm:text-4xl">
            {played ? match.home_score : "–"}

            <span className="mx-2 text-[#64717C]">
              :
            </span>

            {played ? match.away_score : "–"}
          </p>

          <p
            className={`
              mt-1 text-[9px] font-extrabold tracking-[0.16em]
              ${
                match.status === "live"
                  ? "text-[#FF818A]"
                  : "text-[#8997A3]"
              }
            `}
          >
            {match.status === "scheduled"
              ? "VS"
              : match.status === "live"
                ? "IN PLAY"
                : "FT"}
          </p>
        </div>

        {/* Away team */}

        <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white sm:text-base">
              {match.away_team.name}
            </p>

            <p className="mt-1 font-mono text-[10px] text-[#82909D]">
              {match.away_team.code}
            </p>
          </div>

          <TeamMark team={match.away_team} />
        </div>
      </div>

      {/* Match footer */}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.055] pt-3 text-[11px] text-[#8493A0]">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <MapPin size={12} />

          {match.venue || "Venue TBA"}
        </span>

        <span className="flex shrink-0 items-center gap-1 font-bold text-[#F5C66C] transition group-hover:gap-2">
          Match Centre

          <ArrowUpRight size={13} />
        </span>
      </div>
    </Link>
  );
}

/* =========================================
   TOURNAMENT DETAILS PAGE
========================================= */

export default function EventDetailsPage() {
  const params = useParams();

  const eventId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [event, setEvent] =
    useState<TournamentEvent | null>(null);

  const [standings, setStandings] =
    useState<Standing[]>([]);

  const [topScorers, setTopScorers] =
    useState<TopScorer[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [connected, setConnected] = useState(false);

  const [selectedTab, setSelectedTab] =
    useState<Tab>("fixtures");

  const refreshTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  /* =========================================
     FETCH TOURNAMENT DATA
  ========================================= */

  const loadTournament = useCallback(
    async (showLoader = false) => {
      if (!eventId) return;

      try {
        if (showLoader) {
          setLoading(true);
        }

        const [
          eventResponse,
          standingsResponse,
          scorersResponse,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/events/${eventId}/`, {
            cache: "no-store",
          }),

          fetch(
            `${API_BASE_URL}/events/${eventId}/standings/`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `${API_BASE_URL}/events/${eventId}/top-scorers/`,
            {
              cache: "no-store",
            }
          ),
        ]);

        if (!eventResponse.ok) {
          throw new Error(
            `Unable to load tournament (HTTP ${eventResponse.status}).`
          );
        }

        if (!standingsResponse.ok) {
          throw new Error(
            `Unable to load standings (HTTP ${standingsResponse.status}).`
          );
        }

        if (!scorersResponse.ok) {
          throw new Error(
            `Unable to load top scorers (HTTP ${scorersResponse.status}).`
          );
        }

        const eventData =
          (await readJson(eventResponse)) as TournamentEvent;

        const standingsData =
          (await readJson(standingsResponse)) as Standing[];

        const scorersData =
          (await readJson(scorersResponse)) as TopScorer[];

        setEvent(eventData);

        setStandings(
          Array.isArray(standingsData)
            ? standingsData
            : []
        );

        setTopScorers(
          Array.isArray(scorersData)
            ? scorersData
            : []
        );

        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournament."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [eventId]
  );

  /* =========================================
     INITIAL LOAD
  ========================================= */

  useEffect(() => {
    void loadTournament(true);
  }, [loadTournament]);

  /* =========================================
     GLOBAL WEBSOCKET

     Existing functionality preserved:
     - One socket for the page
     - Immediate local match updates
     - Debounced API refresh
     - Reconnection
     - Strict Mode safe cleanup
  ========================================= */

  useEffect(() => {
    if (!eventId) return;

    let active = true;

    let socket: WebSocket | null = null;

    let reconnectTimer:
      | ReturnType<typeof setTimeout>
      | null = null;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (active) {
          void loadTournament();
        }
      }, 350);
    }

    function connect() {
      if (!active) return;

      const backendUrl = new URL(API_BASE_URL);

      const protocol =
        backendUrl.protocol === "https:"
          ? "wss:"
          : "ws:";

      const websocketUrl =
        `${protocol}//${backendUrl.host}/ws/live/`;

      const currentSocket = new WebSocket(websocketUrl);

      socket = currentSocket;

      // Handle React Strict Mode unmounting
      // before the WebSocket connection opens.

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

        // Catch up on updates missed during disconnection.
        scheduleRefresh();
      };

      currentSocket.onmessage = (message) => {
        if (!active) return;

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          if (data.type === "connection") {
            return;
          }

          if (data.match_id !== undefined) {
            /*
              Immediately update the known match in
              local state.

              Then refresh tournament, standings and
              top scorers from the backend.
            */

            setEvent((currentEvent) => {
              if (!currentEvent) {
                return currentEvent;
              }

              let matchFound = false;

              const updatedRounds =
                currentEvent.rounds.map((round) => ({
                  ...round,

                  matches: round.matches.map((match) => {
                    if (match.id !== data.match_id) {
                      return match;
                    }

                    matchFound = true;

                    return {
                      ...match,

                      status:
                        data.status ?? match.status,

                      home_score:
                        data.home_score ??
                        match.home_score,

                      away_score:
                        data.away_score ??
                        match.away_score,
                    };
                  }),
                }));

              return matchFound
                ? {
                    ...currentEvent,
                    rounds: updatedRounds,
                  }
                : currentEvent;
            });

            scheduleRefresh();
          }
        } catch (err) {
          console.error(
            "Tournament WebSocket message error:",
            err
          );
        }
      };

      currentSocket.onerror = () => {
        if (active) {
          setConnected(false);
        }
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

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      const currentSocket = socket;

      if (currentSocket) {
        currentSocket.onopen = null;
        currentSocket.onmessage = null;
        currentSocket.onerror = null;
        currentSocket.onclose = null;

        if (
          currentSocket.readyState === WebSocket.OPEN
        ) {
          currentSocket.close(
            1000,
            "Component unmounted"
          );
        }
      }
    };
  }, [eventId, loadTournament]);

  /* =========================================
     DERIVED DATA
  ========================================= */

  const rounds = useMemo(() => {
    if (!event) return [];

    return [...event.rounds].sort(
      (a, b) => a.order_number - b.order_number
    );
  }, [event]);

  const matches = useMemo(
    () => rounds.flatMap((round) => round.matches),
    [rounds]
  );

  const liveMatches = matches.filter(
    (match) => match.status === "live"
  );

  const finishedMatches = matches.filter(
    (match) => match.status === "finished"
  );

  const scheduledMatches = matches.filter(
    (match) => match.status === "scheduled"
  );

  /* =========================================
     LOADING
  ========================================= */

  if (loading) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#090E13] px-5 text-white">
        <div className="text-center">
          <Trophy
            size={42}
            className="mx-auto mb-5 animate-pulse text-[#F5C66C]"
          />

          <h1 className="font-heading text-2xl font-bold">
            Preparing the competition
          </h1>

          <p className="mt-2 text-sm text-[#8998A5]">
            Loading fixtures, standings and player rankings...
          </p>
        </div>
      </main>
    );
  }

  /* =========================================
     NOT FOUND
  ========================================= */

  if (!event) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#090E13] px-5 text-white">
        <div className="max-w-lg text-center">
          <Trophy
            size={48}
            className="mx-auto text-[#F5C66C]"
          />

          <h1 className="font-heading mt-5 text-3xl font-bold">
            Tournament not found
          </h1>

          <p className="mt-3 text-sm text-[#9DAAB5]">
            {error ||
              "The requested tournament is unavailable."}
          </p>

          <Link
            href="/events"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-6 py-3 text-xs font-extrabold text-[#10151B]"
          >
            <ArrowLeft size={15} />

            All Tournaments
          </Link>
        </div>
      </main>
    );
  }

  /* =========================================
     NAVIGATION TABS
  ========================================= */

  const tabs: {
    value: Tab;
    label: string;
    count?: number;
    icon: typeof Trophy;
  }[] = [
    {
      value: "fixtures",
      label: "Fixtures & Results",
      count: matches.length,
      icon: CalendarDays,
    },
    {
      value: "teams",
      label: "The Contenders",
      count: event.teams.length,
      icon: Shield,
    },
    {
      value: "standings",
      label: "League Table",
      count: standings.length,
      icon: Trophy,
    },
    {
      value: "scorers",
      label: "Top Scorers",
      count: topScorers.length,
      icon: Zap,
    },
  ];

  /* =========================================
     PAGE
  ========================================= */

  return (
    <main className="min-h-screen bg-[#090E13] text-white">

      {/* =====================================
          CINEMATIC TOURNAMENT COVER
      ===================================== */}

      <section className="relative isolate overflow-hidden border-b border-white/10">

        {/* Stadium background */}

        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2000&q=85')",
          }}
        />

        {/* Cinematic overlays */}

        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090E13_4%,rgba(9,14,19,.93)_43%,rgba(9,14,19,.35)_100%)]" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#090E13] via-transparent to-[#090E13]/20" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:pb-16 sm:pt-12 md:px-8 xl:px-12">

          {/* Breadcrumb */}

          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#B0BCC6] transition hover:text-[#F5C66C]"
          >
            <ArrowLeft size={15} />

            All Tournaments
          </Link>

          {/* Competition badges */}

          <div className="mt-14 flex flex-wrap items-center gap-3 sm:mt-20">

            <span className="inline-flex items-center gap-2 rounded-md border border-[#F5C66C]/40 bg-[#F5C66C]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5C66C]">
              <Trophy size={13} />

              Competition / {String(event.id).padStart(3, "0")}
            </span>

            <span className="rounded-md border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#D9E1E8]">
              {event.status}
            </span>

            <span
              className={`
                inline-flex items-center gap-1.5 rounded-md border
                px-3 py-1.5 text-[10px] font-bold
                ${
                  connected
                    ? "border-[#F5C66C]/35 bg-[#F5C66C]/10 text-[#F5C66C]"
                    : "border-white/20 bg-black/30 text-[#A0ADB8]"
                }
              `}
            >
              {connected ? (
                <Wifi size={12} />
              ) : (
                <WifiOff size={12} />
              )}

              {connected
                ? "Realtime Connected"
                : "Connecting"}
            </span>
          </div>

          {/* Tournament title */}

          <div className="mt-6 max-w-[850px]">
            <div className="mb-4 h-[3px] w-12 bg-[#F5C66C]" />

            <h1 className="font-heading text-[clamp(39px,5.5vw,76px)] font-extrabold leading-[1.06] tracking-[-.065em]">
              {event.name}
            </h1>

            <p className="mt-5 max-w-[660px] text-sm leading-7 text-[#B3C0CA] sm:text-base">
              {event.description ||
                "Every fixture. Every goal. Follow the contenders and the road to the final."}
            </p>
          </div>

          {/* Actions */}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-[#11161C] transition hover:bg-[#FFDA91]"
            >
              <Radio size={16} />

              Live Scoreboard

              <ArrowUpRight size={15} />
            </Link>

            <button
              type="button"
              onClick={() => void loadTournament()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/30 px-5 py-3 text-xs font-bold text-white backdrop-blur transition hover:border-[#F5C66C]/60"
            >
              <RefreshCw size={15} />

              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* =====================================
          COMPACT COMPETITION INFO STRIP
      ===================================== */}

      <section className="border-b border-white/[.08] bg-[#121A22]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x-0 divide-y divide-white/[.07] px-5 sm:grid-cols-4 sm:divide-x sm:divide-y-0 md:px-8 xl:px-12">
          {[
            {
              icon: CalendarDays,
              label: "Competition Dates",
              value: `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`,
            },
            {
              icon: Users,
              label: "Registered Teams",
              value: String(event.teams.length),
            },
            {
              icon: Flag,
              label: "Total Fixtures",
              value: String(matches.length),
            },
            {
              icon: Radio,
              label: "Live / Completed",
              value: `${liveMatches.length} / ${finishedMatches.length}`,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="flex items-center gap-3 py-5 sm:px-5 first:pl-0 last:pr-0"
              >
                <Icon
                  size={20}
                  className="shrink-0 text-[#F5C66C]"
                  strokeWidth={1.6}
                />

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#82919F]">
                    {item.label}
                  </p>

                  <p className="mt-1 break-words font-heading text-sm font-bold text-white sm:text-base">
                    {item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================
          MAIN CONTENT
      ===================================== */}

      <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-8 xl:px-12">

        {/* Error */}

        {error && (
          <div className="mb-7 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* =====================================
            LIVE MATCH BROADCAST PANELS
        ===================================== */}

        {liveMatches.length > 0 && (
          <section className="mb-12">

            {/* Section heading */}

            <div className="mb-5 flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#EF6672]" />

              <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#FF818A]">
                On Air Now
              </p>

              <span className="h-px flex-1 bg-white/[.08]" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {liveMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="
                    group relative overflow-hidden rounded-xl
                    border border-[#EF6672]/35
                    bg-[linear-gradient(125deg,#281C26,#151E29_70%)]
                    p-5 transition hover:border-[#EF6672]/75 sm:p-7
                  "
                >
                  {/* Decorative background circle */}

                  <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-[#EF6672]/10" />

                  {/* Match header */}

                  <div className="relative mb-7 flex items-center justify-between gap-3 text-[11px] text-[#AEBAC5]">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin size={13} />

                      {match.venue || "Venue TBA"}
                    </span>

                    <span className="rounded bg-[#EF6672] px-2.5 py-1 text-[10px] font-extrabold tracking-[.12em] text-[#150F13]">
                      ● LIVE
                    </span>
                  </div>

                  {/* Main live scoreboard */}

                  <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">

                    {/* Home */}

                    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                      <TeamMark
                        team={match.home_team}
                        large
                      />

                      <p className="break-words text-xs font-bold sm:text-sm">
                        {match.home_team.name}
                      </p>
                    </div>

                    {/* Live score */}

                    <div className="text-center">
                      <p className="font-mono text-3xl font-bold tracking-[-.08em] sm:text-5xl">
                        {match.home_score}

                        <span className="mx-2 text-[#77818B]">
                          :
                        </span>

                        {match.away_score}
                      </p>

                      <p className="mt-2 text-[9px] font-extrabold tracking-[.2em] text-[#FF818A]">
                        IN PLAY
                      </p>
                    </div>

                    {/* Away */}

                    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                      <TeamMark
                        team={match.away_team}
                        large
                      />

                      <p className="break-words text-xs font-bold sm:text-sm">
                        {match.away_team.name}
                      </p>
                    </div>
                  </div>

                  {/* Match link */}

                  <div className="relative mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-[11px] font-bold text-[#F5C66C]">
                    Follow Match

                    <ArrowUpRight
                      size={14}
                      className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* =====================================
            EDITORIAL TAB NAVIGATION
        ===================================== */}

        <section>
          <div className="mb-9 overflow-x-auto border-b border-[#34414C]">
            <nav
              aria-label="Tournament sections"
              className="flex min-w-max gap-1"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() =>
                      setSelectedTab(tab.value)
                    }
                    className={`
                      relative flex items-center gap-2.5
                      px-4 pb-4 pt-2 text-xs font-bold transition
                      sm:px-6 sm:text-sm
                      ${
                        selectedTab === tab.value
                          ? "text-[#F5C66C]"
                          : "text-[#8E9CA9] hover:text-white"
                      }
                    `}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.8}
                    />

                    {tab.label}

                    <span
                      className={`
                        rounded px-1.5 py-0.5
                        font-mono text-[10px]
                        ${
                          selectedTab === tab.value
                            ? "bg-[#F5C66C]/15"
                            : "bg-white/[.06]"
                        }
                      `}
                    >
                      {tab.count}
                    </span>

                    {selectedTab === tab.value && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F5C66C]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* =====================================
              TAB 1 — FIXTURES & RESULTS
          ===================================== */}

          {selectedTab === "fixtures" && (
            <div className="space-y-7">

              {/* Section title */}

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">
                    The Match Programme
                  </p>

                  <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-.055em]">
                    Fixtures & Results
                  </h2>
                </div>

                <p className="text-xs text-[#91A0AD]">
                  {scheduledMatches.length} upcoming

                  <span className="mx-1 text-[#566572]">
                    /
                  </span>

                  {liveMatches.length} live

                  <span className="mx-1 text-[#566572]">
                    /
                  </span>

                  {finishedMatches.length} completed
                </p>
              </div>

              {/* Rounds */}

              {rounds.length === 0 ? (
                <div className="border-y border-white/10 py-14 text-center text-sm text-[#91A0AD]">
                  No rounds have been created yet.
                </div>
              ) : (
                rounds.map((round) => (
                  <section
                    key={round.id}
                    className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]"
                  >
                    {/* Round header */}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#303C47] bg-[linear-gradient(90deg,#29292B,#19232D)] px-5 py-4 sm:px-7">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-3xl font-bold tracking-[-.08em] text-[#F5C66C]">
                          {String(
                            round.order_number
                          ).padStart(2, "0")}
                        </span>

                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#B89B6C]">
                            Competition Round
                          </p>

                          <h3 className="font-heading text-lg font-bold tracking-[-.03em]">
                            {round.name}
                          </h3>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-[#9BA8B4]">
                        {round.matches.length}{" "}
                        {round.matches.length === 1
                          ? "fixture"
                          : "fixtures"}
                      </span>
                    </div>

                    {/* Round fixtures */}

                    {round.matches.length === 0 ? (
                      <p className="px-6 py-8 text-sm text-[#91A0AD]">
                        No matches scheduled for this round.
                      </p>
                    ) : (
                      round.matches.map((match) => (
                        <MatchRow
                          key={match.id}
                          match={match}
                        />
                      ))
                    )}
                  </section>
                ))
              )}
            </div>
          )}

          {/* =====================================
              TAB 2 — REGISTERED TEAMS
          ===================================== */}

          {selectedTab === "teams" && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">
                The Participants
              </p>

              <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-.055em]">
                Meet the Contenders
              </h2>

              <p className="mt-2 text-sm text-[#91A0AD]">
                {event.teams.length} registered teams
                competing in this tournament.
              </p>

              {event.teams.length === 0 ? (
                <div className="mt-7 border-y border-white/10 py-14 text-center text-sm text-[#91A0AD]">
                  No teams have been enrolled yet.
                </div>
              ) : (
                <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {event.teams.map((team, index) => (
                    <div
                      key={team.id}
                      className="
                        group relative flex items-center gap-4
                        overflow-hidden rounded-xl
                        border border-[#303C47] bg-[#141D26]
                        p-5 transition hover:border-[#F5C66C]/45
                      "
                    >
                      {/* Large decorative team number */}

                      <span className="absolute -right-1 -top-3 font-mono text-[74px] font-bold tracking-[-.12em] text-white/[.025]">
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <TeamMark team={team} large />

                      <div className="relative min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#BE9E69]">
                          Team{" "}
                          {String(index + 1).padStart(
                            2,
                            "0"
                          )}
                        </p>

                        <h3 className="mt-1 truncate font-heading text-lg font-bold">
                          {team.name}
                        </h3>

                        <p className="mt-1 font-mono text-[11px] text-[#8F9DAA]">
                          {team.code}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================
              TAB 3 — LEAGUE TABLE
          ===================================== */}

          {selectedTab === "standings" && (
            <div>

              {/* Heading */}

              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">
                    Competition Rankings
                  </p>

                  <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-.055em]">
                    League Table
                  </h2>

                  <p className="mt-2 text-sm text-[#91A0AD]">
                    Match points plus awarded reward points.
                  </p>
                </div>

                <Trophy
                  size={30}
                  strokeWidth={1.3}
                  className="text-[#F5C66C]"
                />
              </div>

              {/* Standings table */}

              <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs sm:text-sm">

                    {/* Header */}

                    <thead className="border-b border-[#36424C] bg-[#202B35] text-[10px] font-extrabold uppercase tracking-[.1em] text-[#9DAAB5]">
                      <tr>
                        <th className="px-5 py-4">
                          #
                        </th>

                        <th className="px-5 py-4">
                          Club
                        </th>

                        {[
                          "P",
                          "W",
                          "D",
                          "L",
                          "GF",
                          "GA",
                          "GD",
                          "Reward",
                          "Pts",
                        ].map((label) => (
                          <th
                            key={label}
                            className="px-3 py-4 text-center"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    {/* Rows */}

                    <tbody>
                      {standings.map(
                        (standing, index) => (
                          <tr
                            key={standing.team_id}
                            className={`
                              border-b border-white/[.065]
                              transition last:border-0
                              hover:bg-white/[.035]
                              ${
                                index === 0
                                  ? "bg-[#F5C66C]/[.045]"
                                  : ""
                              }
                            `}
                          >
                            {/* Position */}

                            <td className="px-5 py-4">
                              <span
                                className={`
                                  inline-flex h-7 w-7
                                  items-center justify-center
                                  rounded-md font-mono font-bold
                                  ${
                                    index === 0
                                      ? "bg-[#F5C66C] text-[#10151B]"
                                      : "bg-white/[.06] text-[#A5B2BD]"
                                  }
                                `}
                              >
                                {index + 1}
                              </span>
                            </td>

                            {/* Team */}

                            <td className="whitespace-nowrap px-5 py-4 font-bold text-white">
                              {standing.team}

                              {index === 0 && (
                                <Trophy
                                  size={13}
                                  className="ml-2 inline text-[#F5C66C]"
                                />
                              )}
                            </td>

                            {/* Match statistics */}

                            {[
                              standing.played,
                              standing.won,
                              standing.drawn,
                              standing.lost,
                              standing.goals_for,
                              standing.goals_against,
                              standing.goal_difference,
                            ].map((value, i) => (
                              <td
                                key={i}
                                className="px-3 py-4 text-center font-mono text-[#C0CAD3]"
                              >
                                {value}
                              </td>
                            ))}

                            {/* Reward points */}

                            <td className="px-3 py-4 text-center font-mono text-[#E2B66D]">
                              {standing.reward_points}
                            </td>

                            {/* Total points */}

                            <td className="px-3 py-4 text-center font-mono text-base font-extrabold text-[#F5C66C]">
                              {standing.points}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Empty state */}

                {standings.length === 0 && (
                  <p className="px-6 py-12 text-center text-sm text-[#91A0AD]">
                    No standings available yet.
                  </p>
                )}
              </div>

              {/* Legend */}

              <p className="mt-4 text-[11px] leading-6 text-[#788895]">
                P: Played · W: Won · D: Drawn · L: Lost ·
                GF: Goals For · GA: Goals Against ·
                GD: Goal Difference · Reward: Bonus Points
              </p>
            </div>
          )}

          {/* =====================================
              TAB 4 — GOLDEN BOOT LEADERBOARD
          ===================================== */}

          {selectedTab === "scorers" && (
            <div>

              {/* Heading */}

              <div className="mb-7">
                <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">
                  Golden Boot Race
                </p>

                <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-.055em]">
                  Tournament Top Scorers
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#91A0AD]">
                  Registered player goals, updated as
                  match events are recorded.
                </p>
              </div>

              {topScorers.length === 0 ? (
                <div className="border-y border-white/10 py-14 text-center">
                  <Trophy
                    size={34}
                    className="mx-auto text-[#F5C66C]"
                  />

                  <p className="mt-4 text-sm text-[#91A0AD]">
                    No registered player goals have
                    been recorded yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]">

                  {/* Leaderboard heading */}

                  <div className="border-b border-white/10 bg-[linear-gradient(95deg,#34302A,#1A2530)] px-5 py-5 sm:px-7">
                    <div className="flex items-center gap-3">
                      <Trophy
                        size={23}
                        className="text-[#F5C66C]"
                      />

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#C6A36B]">
                          The Golden Boot
                        </p>

                        <p className="font-heading text-lg font-bold">
                          Player Leaderboard
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Player rankings */}

                  <div className="divide-y divide-white/[.07]">
                    {topScorers.map(
                      (scorer, index) => (
                        <Link
                          key={scorer.player_id}
                          href={`/players/${scorer.player_id}`}
                          className="
                            group flex items-center gap-3
                            px-4 py-4 transition
                            hover:bg-[#F5C66C]/[.045]
                            sm:gap-5 sm:px-7
                          "
                        >
                          {/* Rank */}

                          <span
                            className={`
                              flex h-10 w-10 shrink-0
                              items-center justify-center
                              rounded-lg font-mono
                              text-lg font-extrabold
                              ${
                                index === 0
                                  ? "bg-[#F5C66C] text-[#141820]"
                                  : index === 1
                                    ? "bg-[#B9C0C7]/15 text-[#D4DCE2]"
                                    : index === 2
                                      ? "bg-[#BE8D5A]/15 text-[#D5A77C]"
                                      : "bg-white/[.045] text-[#8D9BA8]"
                              }
                            `}
                          >
                            {String(index + 1).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          {/* Jersey number */}

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#F5C66C]/20 bg-[#F5C66C]/10 font-mono text-xs font-bold text-[#F5C66C]">
                            #{scorer.jersey_number}
                          </div>

                          {/* Player */}

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-heading text-sm font-bold text-white transition group-hover:text-[#F5C66C] sm:text-base">
                              {scorer.player_name}
                            </p>

                            <p className="mt-1 truncate text-[11px] text-[#91A0AD]">
                              {scorer.team_name} ·{" "}
                              {scorer.team_code}
                            </p>
                          </div>

                          {/* Goals */}

                          <div className="shrink-0 text-right">
                            <p className="font-mono text-2xl font-extrabold leading-none text-[#F5C66C] sm:text-3xl">
                              {scorer.goals}
                            </p>

                            <p className="mt-1 text-[9px] font-bold uppercase tracking-[.13em] text-[#82919F]">
                              Goals
                            </p>
                          </div>

                          <ArrowUpRight
                            size={17}
                            className="hidden shrink-0 text-[#F5C66C] opacity-0 transition group-hover:opacity-100 sm:block"
                          />
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}

              <p className="mt-4 text-[11px] leading-5 text-[#788895]">
                Goals without a registered player
                association are excluded from these rankings.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* =====================================
          PHOTOGRAPHIC CLOSING BANNER
      ===================================== */}

      <section className="relative mt-10 overflow-hidden border-t border-white/10">

        {/* Background image */}

        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        {/* Overlay */}

        <div className="absolute inset-0 bg-gradient-to-r from-[#090E13] via-[#090E13]/90 to-[#090E13]/50" />

        {/* Content */}

        <div className="relative mx-auto flex max-w-[1440px] flex-col justify-between gap-7 px-5 py-14 md:flex-row md:items-center md:px-8 xl:px-12">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">
              Stay In The Game
            </p>

            <h2 className="font-heading mt-3 text-3xl font-bold tracking-[-.055em] sm:text-4xl">
              Every goal. Every result.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-[#A4B0BA]">
              Follow every match with live scores and
              tournament updates.
            </p>
          </div>

          <Link
            href="/live"
            className="
              inline-flex shrink-0 items-center gap-3
              self-start rounded-lg bg-[#F5C66C]
              px-6 py-3.5 text-xs font-extrabold
              uppercase text-[#11161C]
              transition hover:bg-[#FFDA91]
            "
          >
            <Radio size={16} />

            Open Live Scoreboard

            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
