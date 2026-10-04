
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
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Clock3,
  MapPin,
  Radio,
  RefreshCw,
  Signal,
  Trophy,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

/* =========================================
   CONFIGURATION
========================================= */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

const WS_BASE_URL = API_BASE_URL
  .replace(/^http/, "ws")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

/* =========================================
   TYPES
========================================= */

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface LiveMatch {
  id: number;
  round: number;
  home_team: number | Team;
  away_team: number | Team;
  home_score: number;
  away_score: number;
  status: "scheduled" | "live" | "finished";
  scheduled_at: string;
  venue: string;
}

interface MatchUpdate {
  type: string;
  event?: string;
  match_id?: number;
  status?: LiveMatch["status"];
  home_score?: number;
  away_score?: number;
}

/* =========================================
   HELPERS
========================================= */

function getTeamName(team: number | Team): string {
  return typeof team === "number"
    ? `Team #${team}`
    : team.name;
}

function getTeamCode(team: number | Team): string {
  if (typeof team === "number") {
    return `T${team}`;
  }

  return team.code || team.name.slice(0, 3).toUpperCase();
}

function getTeamLogo(team: number | Team): string | null {
  return typeof team === "number" ? null : team.logo;
}

function formatDate(value: string): string {
  if (!value) return "Date TBA";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date TBA";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string): string {
  if (!value) return "Time TBA";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time TBA";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveLogo(logo: string | null): string | null {
  if (!logo) return null;

  if (
    logo.startsWith("http://") ||
    logo.startsWith("https://") ||
    logo.startsWith("data:")
  ) {
    return logo;
  }

  try {
    const backendOrigin = new URL(API_BASE_URL).origin;

    return new URL(logo, backendOrigin).toString();
  } catch {
    return logo;
  }
}

/* =========================================
   TEAM CREST
========================================= */

function TeamCrest({
  team,
  large = false,
}: {
  team: number | Team;
  large?: boolean;
}) {
  const logo = resolveLogo(getTeamLogo(team));

  return (
    <div
      className={`
        relative flex shrink-0 items-center justify-center
        overflow-hidden border border-[#F5C66C]/25
        bg-[linear-gradient(145deg,#303640,#151E28)]
        font-heading font-extrabold tracking-tight text-[#F5C66C]
        ${
          large
            ? "h-[72px] w-[72px] rounded-2xl text-lg sm:h-24 sm:w-24 sm:text-2xl"
            : "h-12 w-12 rounded-xl text-xs sm:h-14 sm:w-14 sm:text-sm"
        }
      `}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`${getTeamName(team)} crest`}
          className="h-full w-full object-contain p-2.5"
        />
      ) : (
        getTeamCode(team).slice(0, 3).toUpperCase()
      )}
    </div>
  );
}

/* =========================================
   FEATURED BROADCAST MATCH
========================================= */

function FeaturedBroadcast({
  match,
}: {
  match: LiveMatch;
}) {
  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group relative block overflow-hidden
        rounded-2xl border border-[#F5C66C]/30
        bg-[linear-gradient(135deg,#252B31,#111922_70%)]
        shadow-[0_25px_90px_rgba(0,0,0,0.3)]
        transition duration-300 hover:border-[#F5C66C]/70
      "
    >
      {/* Stadium background */}

      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.13]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80')",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101821] via-[#101821]/70 to-transparent" />

      {/* Decorative centre circle */}

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035]" />

      <div className="relative">
        {/* Broadcast header */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2.5">
            <Radio
              size={15}
              className="text-[#F5C66C]"
            />

            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F5C66C]">
              Featured Live Broadcast
            </span>
          </div>

          <span className="inline-flex items-center gap-2 rounded-md border border-[#EF6672]/40 bg-[#EF6672]/10 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.15em] text-[#FF818A]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />

            LIVE NOW
          </span>
        </div>

        {/* Match number */}

        <div className="pt-7 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#94A3B0]">
            Match {String(match.id).padStart(3, "0")}
            {" / "}
            Round {match.round}
          </p>
        </div>

        {/* Main scoreboard */}

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 pb-9 pt-8 sm:gap-5 sm:px-8 sm:pb-12">
          {/* Home team */}

          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamCrest team={match.home_team} large />

            <h3 className="font-heading mt-5 max-w-[180px] break-words text-sm font-extrabold leading-tight sm:text-xl">
              {getTeamName(match.home_team)}
            </h3>

            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A9AA7]">
              Home
            </p>
          </div>

          {/* Score */}

          <div className="min-w-[105px] text-center sm:min-w-[185px]">
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <span className="font-mono text-[clamp(43px,6vw,83px)] font-extrabold leading-none tracking-[-0.1em] text-white">
                {match.home_score}
              </span>

              <span className="font-mono text-4xl font-light text-[#7B8792] sm:text-5xl">
                :
              </span>

              <span className="font-mono text-[clamp(43px,6vw,83px)] font-extrabold leading-none tracking-[-0.1em] text-white">
                {match.away_score}
              </span>
            </div>

            <div className="mt-5 inline-flex items-center gap-2 border-y border-[#EF6672]/30 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#FF818A]">
              <Activity size={12} />

              In Play
            </div>
          </div>

          {/* Away team */}

          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamCrest team={match.away_team} large />

            <h3 className="font-heading mt-5 max-w-[180px] break-words text-sm font-extrabold leading-tight sm:text-xl">
              {getTeamName(match.away_team)}
            </h3>

            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A9AA7]">
              Away
            </p>
          </div>
        </div>

        {/* Bottom information */}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-black/20 px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#A8B6C1]">
            <span className="inline-flex items-center gap-2">
              <MapPin size={13} className="text-[#F5C66C]" />

              {match.venue || "Venue TBA"}
            </span>

            <span className="inline-flex items-center gap-2">
              <Clock3 size={13} className="text-[#F5C66C]" />

              {formatTime(match.scheduled_at)}
            </span>
          </div>

          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-[#F5C66C]">
            Enter Match Centre

            <ArrowUpRight
              size={15}
              className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* =========================================
   COMPACT LIVE MATCH ROW
========================================= */

function LiveMatchRow({
  match,
  index,
}: {
  match: LiveMatch;
  index: number;
}) {
  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group relative block border-b border-white/[0.075]
        px-4 py-5 transition hover:bg-[#F5C66C]/[0.035]
        last:border-b-0 sm:px-6
      "
    >
      <div className="absolute bottom-0 left-0 top-0 w-[2px] bg-[#F5C66C] opacity-0 transition group-hover:opacity-100" />

      {/* Row heading */}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#72818F]">
            {String(index + 1).padStart(2, "0")}
          </span>

          <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#FF818A]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />

            Live
          </span>

          <span className="text-[10px] text-[#81909D]">
            Round {match.round}
          </span>
        </div>

        <span className="font-mono text-[10px] text-[#8493A0]">
          MATCH #{match.id}
        </span>
      </div>

      {/* Score strip */}

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamCrest team={match.home_team} />

          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white sm:text-sm">
              {getTeamName(match.home_team)}
            </p>

            <p className="mt-1 font-mono text-[10px] text-[#80909D]">
              {getTeamCode(match.home_team)}
            </p>
          </div>
        </div>

        <div className="min-w-[80px] text-center sm:min-w-[110px]">
          <p className="whitespace-nowrap font-mono text-3xl font-extrabold tracking-[-0.09em] text-white sm:text-4xl">
            {match.home_score}

            <span className="mx-2 text-[#71808E]">
              :
            </span>

            {match.away_score}
          </p>

          <p className="mt-1 text-[9px] font-extrabold tracking-[0.15em] text-[#FF818A]">
            IN PLAY
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white sm:text-sm">
              {getTeamName(match.away_team)}
            </p>

            <p className="mt-1 font-mono text-[10px] text-[#80909D]">
              {getTeamCode(match.away_team)}
            </p>
          </div>

          <TeamCrest team={match.away_team} />
        </div>
      </div>

      {/* Footer */}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-[#81909D]">
          <MapPin size={12} className="shrink-0" />

          <span className="truncate">
            {match.venue || "Venue TBA"}
          </span>
        </p>

        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#F5C66C]">
          Match Details

          <ChevronRight
            size={14}
            className="transition group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}

/* =========================================
   MAIN PAGE
========================================= */

export default function LiveScoreboardPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [socketConnected, setSocketConnected] =
    useState(false);

  const reconnectTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const refreshTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  /* =========================================
     FETCH LIVE MATCHES
  ========================================= */

  const loadMatches = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        const response = await fetch(
          `${API_BASE_URL}/live/`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load live matches (HTTP ${response.status}).`
          );
        }

        const data = await response.json();

        const results: LiveMatch[] = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
            ? data.results
            : [];

        setMatches(
          results.filter(
            (match) => match.status === "live"
          )
        );

        setError("");
      } catch (err) {
        console.error(
          "Live scoreboard fetch error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect to the backend."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* =========================================
     GLOBAL LIVE WEBSOCKET
  ========================================= */

  useEffect(() => {
    let active = true;

    let socket: WebSocket | null = null;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (active) {
          void loadMatches();
        }
      }, 350);
    }

    function connect() {
      if (!active) return;

      const currentSocket = new WebSocket(
        `${WS_BASE_URL}/ws/live/`
      );

      socket = currentSocket;

      currentSocket.onopen = () => {
        if (!active) {
          currentSocket.close();
          return;
        }

        setSocketConnected(true);

        // Recover updates missed while disconnected.
        scheduleRefresh();
      };

      currentSocket.onmessage = (message) => {
        if (!active) return;

        try {
          const data: MatchUpdate = JSON.parse(
            message.data
          );

          if (data.type === "connection") {
            return;
          }

          if (data.type !== "match_update") {
            return;
          }

          /*
            A newly started match requires the full API
            response to obtain team names, round and venue.
          */

          if (data.event === "match_started") {
            scheduleRefresh();
            return;
          }

          if (data.match_id === undefined) {
            scheduleRefresh();
            return;
          }

          const matchId = data.match_id;

          /*
            Remove a match immediately after full time.
            The /live/ endpoint only contains live matches.
          */

          if (
            data.event === "match_finished" ||
            data.status === "finished"
          ) {
            setMatches((current) =>
              current.filter(
                (match) => match.id !== matchId
              )
            );

            scheduleRefresh();
            return;
          }

          /*
            Update existing scores immediately without
            waiting for an additional HTTP request.
          */

          setMatches((current) =>
            current.map((match) => {
              if (match.id !== matchId) {
                return match;
              }

              return {
                ...match,
                status: data.status ?? match.status,
                home_score:
                  data.home_score ?? match.home_score,
                away_score:
                  data.away_score ?? match.away_score,
              };
            })
          );

          /*
            Also synchronize with the authoritative API.
            This handles newly added matches and any
            updates that were not included in the payload.
          */

          scheduleRefresh();
        } catch (err) {
          console.error(
            "Invalid scoreboard WebSocket update:",
            err
          );
        }
      };

      currentSocket.onerror = () => {
        if (active) {
          setSocketConnected(false);
        }
      };

      currentSocket.onclose = () => {
        if (!active) return;

        setSocketConnected(false);

        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
        }

        reconnectTimer.current = setTimeout(
          connect,
          3000
        );
      };
    }

    // Initial load.
    void loadMatches(true);

    // Establish realtime connection.
    connect();

    return () => {
      active = false;

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      }
    };
  }, [loadMatches]);

  /* =========================================
     DERIVED DATA
  ========================================= */

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => a.id - b.id);
  }, [matches]);

  const featuredMatch =
    sortedMatches.length > 0 ? sortedMatches[0] : null;

  const otherMatches = featuredMatch
    ? sortedMatches.filter(
        (match) => match.id !== featuredMatch.id
      )
    : [];

  const totalGoals = matches.reduce(
    (total, match) =>
      total + match.home_score + match.away_score,
    0
  );

  const activeTeams = new Set(
    matches.flatMap((match) => [
      typeof match.home_team === "number"
        ? match.home_team
        : match.home_team.id,

      typeof match.away_team === "number"
        ? match.away_team
        : match.away_team.id,
    ])
  ).size;

  /* =========================================
     PAGE
  ========================================= */

  return (
    <main className="min-h-screen overflow-hidden bg-[#090E13] text-white">

      {/* =====================================
          CINEMATIC LIVE ARENA HERO
      ===================================== */}

      <section className="relative isolate overflow-hidden border-b border-white/[0.08]">

        {/* Stadium photograph */}

        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=2000&q=85')",
          }}
        />

        {/* Dark broadcast overlays */}

        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090E13_0%,rgba(9,14,19,.94)_48%,rgba(9,14,19,.45)_100%)]" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#090E13] via-transparent to-[#090E13]/30" />

        {/* Hero content */}

        <div className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-8 md:px-8 lg:pb-16 xl:px-12">

          {/* Navigation and connection */}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/matches"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#AFBCC6] transition hover:text-[#F5C66C]"
            >
              <ArrowLeft size={15} />

              Match Centre
            </Link>

            <div className="flex flex-wrap items-center gap-2">

              {/* Connection indicator */}

              <span
                className={`
                  inline-flex items-center gap-2 rounded-md
                  border px-3 py-2 text-[10px] font-bold
                  ${
                    socketConnected
                      ? "border-[#F5C66C]/35 bg-[#F5C66C]/10 text-[#F5C66C]"
                      : "border-white/15 bg-black/30 text-[#B0BBC5]"
                  }
                `}
              >
                {socketConnected ? (
                  <Wifi size={13} />
                ) : (
                  <WifiOff size={13} />
                )}

                {socketConnected
                  ? "REALTIME CONNECTED"
                  : "RECONNECTING"}
              </span>

              {/* Manual refresh */}

              <button
                type="button"
                onClick={() => void loadMatches(true)}
                disabled={loading}
                className="
                  inline-flex items-center gap-2 rounded-md
                  border border-white/20 bg-black/25
                  px-3 py-2 text-[10px] font-bold
                  text-[#D3DCE4] transition
                  hover:border-[#F5C66C]/50 hover:text-[#F5C66C]
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                <RefreshCw
                  size={13}
                  className={loading ? "animate-spin" : ""}
                />

                Refresh
              </button>
            </div>
          </div>

          {/* Hero headline */}

          <div className="mt-14 max-w-3xl sm:mt-20">
            <div className="mb-7 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#EF6672]/35 bg-[#EF6672]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#FF818A]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />

                On Air
              </span>

              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#B5C0CA]">
                Football / Live Broadcast
              </span>
            </div>

            <div className="mb-5 h-[3px] w-14 bg-[#F5C66C]" />

            <h1 className="font-heading text-[clamp(55px,8vw,112px)] font-extrabold leading-[0.91] tracking-[-0.085em]">
              LIVE
              <br />

              <span className="text-[#F5C66C]">
                ARENA.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-sm leading-7 text-[#B4C0CA] sm:text-base">
              No delays. No missed moments. Experience every
              goal, every score change and every live fixture
              as the action unfolds.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-white">
                <Radio
                  size={15}
                  className="text-[#FF818A]"
                />

                {matches.length} Matches On Air
              </span>

              <span className="h-4 w-px bg-white/20" />

              <span className="inline-flex items-center gap-2 text-xs text-[#B3C0CA]">
                <Zap
                  size={15}
                  className="text-[#F5C66C]"
                />

                Automatic Score Updates
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          BROADCAST STATS RIBBON
      ===================================== */}

      <section className="border-b border-white/[0.08] bg-[#151D26]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 md:px-8 xl:px-12">
          {[
            {
              icon: Radio,
              value: matches.length,
              label: "Live Fixtures",
            },
            {
              icon: CircleDot,
              value: totalGoals,
              label: "Goals On Air",
            },
            {
              icon: Trophy,
              value: activeTeams,
              label: "Teams Playing",
            },
            {
              icon: Signal,
              value: socketConnected ? "ON" : "OFF",
              label: "Live Connection",
            },
          ].map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className={`
                  flex items-center gap-4 py-5
                  ${
                    index > 0
                      ? "sm:border-l sm:border-white/[0.08] sm:pl-6"
                      : ""
                  }
                  ${
                    index >= 2
                      ? "border-t border-white/[0.08] sm:border-t-0"
                      : ""
                  }
                `}
              >
                <Icon
                  size={20}
                  strokeWidth={1.6}
                  className="shrink-0 text-[#F5C66C]"
                />

                <div>
                  <p className="font-mono text-2xl font-extrabold leading-none text-white sm:text-3xl">
                    {loading && matches.length === 0
                      ? "—"
                      : item.value}
                  </p>

                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8796A3]">
                    {item.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================
          ERROR MESSAGE
      ===================================== */}

      {error && (
        <div className="mx-auto max-w-[1440px] px-5 pt-8 md:px-8 xl:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#EF6672]/30 bg-[#EF6672]/10 p-5">
            <p className="text-sm text-[#FFC0C5]">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadMatches(true)}
              className="text-xs font-bold text-white underline underline-offset-4"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* =====================================
          LIVE BROADCAST CONTENT
      ===================================== */}

      <section className="mx-auto max-w-[1440px] px-5 py-12 md:px-8 lg:py-16 xl:px-12">

        {/* Section heading */}

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              Broadcasting Right Now
            </p>

            <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
              The Live Feed
            </h2>

            <p className="mt-3 text-sm text-[#92A0AC]">
              Real-time scores delivered directly from the pitch.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-[11px] text-[#A8B6C1]">
            <Activity
              size={15}
              className="text-[#F5C66C]"
            />

            {socketConnected
              ? "Listening for live updates"
              : "Waiting for connection"}
          </div>
        </div>

        {/* =====================================
            LOADING
        ===================================== */}

        {loading && matches.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
            <div className="h-[420px] animate-pulse rounded-2xl border border-[#F5C66C]/15 bg-[#17212B]" />

            <div className="h-[420px] animate-pulse rounded-2xl border border-white/10 bg-[#141D26]" />
          </div>
        ) : matches.length === 0 ? (
          /* =====================================
             CINEMATIC EMPTY STATE
          ===================================== */

          <div className="relative isolate overflow-hidden rounded-2xl border border-[#F5C66C]/20 bg-[#141D26]">

            {/* Background */}

            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80')",
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#101821] via-[#101821]/90 to-[#101821]/50" />

            <div className="relative flex min-h-[400px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#F5C66C]/30 bg-[#F5C66C]/10">
                <Radio
                  size={29}
                  strokeWidth={1.5}
                  className="text-[#F5C66C]"
                />
              </div>

              <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
                Broadcast Standby
              </p>

              <h3 className="font-heading mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
                The pitch is quiet.
                <br />

                <span className="text-[#F5C66C]">
                  For now.
                </span>
              </h3>

              <p className="mt-5 max-w-md text-sm leading-7 text-[#A6B5C1]">
                There are no matches in progress. As soon as
                a fixture kicks off, it will automatically
                appear here through the live connection.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/matches"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold text-[#11161C] transition hover:bg-[#FFDA91]"
                >
                  Explore Fixtures

                  <ArrowRight size={15} />
                </Link>

                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/25 px-5 py-3 text-xs font-bold text-white transition hover:border-[#F5C66C]/50"
                >
                  View Tournaments
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* =====================================
             FEATURED LIVE MATCH + SIDEBAR
          ===================================== */

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">

            {/* Featured broadcast */}

            <div className="min-w-0">
              {featuredMatch && (
                <FeaturedBroadcast
                  match={featuredMatch}
                />
              )}

              {/* Broadcast information strip */}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-[#34414C] py-4">
                <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#AAB8C3]">
                  <CalendarDays
                    size={14}
                    className="text-[#F5C66C]"
                  />

                  {featuredMatch
                    ? formatDate(featuredMatch.scheduled_at)
                    : "Live Broadcast"}
                </span>

                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F5C66C]">
                  <Zap size={13} />

                  Scores update automatically
                </span>
              </div>
            </div>

            {/* Right editorial sidebar */}

            <aside className="min-w-0 overflow-hidden rounded-xl border border-[#303C47] bg-[#141D26]">

              {/* Sidebar heading */}

              <div className="flex items-center justify-between gap-3 border-b border-[#34414C] bg-[linear-gradient(90deg,#282A2D,#1B2732)] px-5 py-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#F5C66C]">
                    Live Directory
                  </p>

                  <h3 className="font-heading mt-1 text-xl font-bold tracking-[-0.04em]">
                    On Air Now
                  </h3>
                </div>

                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F5C66C]/20 bg-[#F5C66C]/10">
                  <Radio
                    size={19}
                    className="text-[#F5C66C]"
                  />
                </span>
              </div>

              {/* Compact live ticker */}

              <div className="divide-y divide-white/[0.07]">
                {sortedMatches.map((match) => (
                  <Link
                    href={`/matches/${match.id}`}
                    key={match.id}
                    className="group block px-5 py-4 transition hover:bg-[#F5C66C]/[0.04]"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#FF818A]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />

                        LIVE
                      </span>

                      <span className="font-mono text-[10px] text-[#7E8D9B]">
                        #{match.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-2.5">
                        <p className="truncate text-xs font-semibold text-white">
                          {getTeamName(match.home_team)}
                        </p>

                        <p className="truncate text-xs font-semibold text-white">
                          {getTeamName(match.away_team)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 font-mono text-sm font-extrabold text-[#F5C66C]">
                        <span>{match.home_score}</span>

                        <span>{match.away_score}</span>
                      </div>

                      <ChevronRight
                        size={15}
                        className="shrink-0 text-[#697A88] transition group-hover:translate-x-1 group-hover:text-[#F5C66C]"
                      />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Sidebar footer */}

              <Link
                href="/matches"
                className="flex items-center justify-between border-t border-[#34414C] px-5 py-4 text-xs font-bold text-[#F5C66C] transition hover:bg-[#F5C66C]/[0.05]"
              >
                Full Match Programme

                <ArrowUpRight size={15} />
              </Link>
            </aside>
          </div>
        )}

        {/* =====================================
            OTHER LIVE MATCHES
        ===================================== */}

        {!loading && otherMatches.length > 0 && (
          <div className="mt-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#F5C66C]">
                  More From The Pitch
                </p>

                <h2 className="font-heading mt-2 text-2xl font-bold tracking-[-0.045em] sm:text-3xl">
                  More Live Action
                </h2>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8393A0]">
                {otherMatches.length} Additional Fixtures
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]">
              {otherMatches.map((match, index) => (
                <LiveMatchRow
                  key={match.id}
                  match={match}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =====================================
          CLOSING BROADCAST BANNER
      ===================================== */}

      <section className="relative isolate mt-4 overflow-hidden border-t border-white/[0.08]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#090E13] via-[#090E13]/90 to-[#090E13]/50" />

        <div className="relative mx-auto flex max-w-[1440px] flex-col justify-between gap-7 px-5 py-14 md:flex-row md:items-center md:px-8 xl:px-12">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              Beyond The Broadcast
            </p>

            <h2 className="font-heading mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
              Every fixture.
              <br />

              Every final whistle.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-[#A6B3BE]">
              Explore the complete tournament schedule,
              upcoming kickoffs and previous match results.
            </p>
          </div>

          <Link
            href="/matches"
            className="
              inline-flex shrink-0 items-center gap-3
              self-start rounded-lg bg-[#F5C66C]
              px-6 py-3.5 text-xs font-extrabold
              uppercase text-[#11161C]
              transition hover:bg-[#FFDA91]
            "
          >
            <Trophy size={16} />

            Explore Match Centre

            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
