
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getMatches } from "@/lib/api";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Clock3,
  Flag,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  Trophy,
  Wifi,
  WifiOff,
} from "lucide-react";

/* =========================================
   CONFIGURATION
========================================= */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

/* =========================================
   TYPES
========================================= */

type MatchStatus = "scheduled" | "live" | "finished";

type MatchFilter = "all" | MatchStatus;

interface Team {
  id: number;
  name: string;
  code: string;
  logo?: string | null;
}

interface FootballMatch {
  id: number;
  home_team: Team;
  away_team: Team;
  home_score: number;
  away_score: number;
  scheduled_at: string;
  venue: string;
  status: MatchStatus;
}

interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
  status?: MatchStatus;
  home_score?: number;
  away_score?: number;
}

/* =========================================
   HELPERS
========================================= */

function getValidDate(value: string): Date | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: string): string {
  const date = getValidDate(value);

  if (!date) return "Date to be announced";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string): string {
  const date = getValidDate(value);

  if (!date) return "TBA";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string): string {
  const date = getValidDate(value);

  if (!date) return "TBA";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeekday(value: string): string {
  const date = getValidDate(value);

  if (!date) return "TBA";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case "live":
      return "LIVE NOW";

    case "finished":
      return "FULL TIME";

    default:
      return "UPCOMING";
  }
}

function statusStyle(status: MatchStatus): string {
  switch (status) {
    case "live":
      return "border-[#EF6672]/40 bg-[#EF6672]/10 text-[#FF818A]";

    case "finished":
      return "border-white/10 bg-white/[0.05] text-[#AAB7C3]";

    default:
      return "border-[#F5C66C]/30 bg-[#F5C66C]/[0.07] text-[#F5C66C]";
  }
}

function sortMatches(items: FootballMatch[]): FootballMatch[] {
  const priority: Record<MatchStatus, number> = {
    live: 0,
    scheduled: 1,
    finished: 2,
  };

  return [...items].sort((a, b) => {
    const statusDifference =
      priority[a.status] - priority[b.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const dateA =
      getValidDate(a.scheduled_at)?.getTime() ?? 0;

    const dateB =
      getValidDate(b.scheduled_at)?.getTime() ?? 0;

    if (a.status === "finished") {
      return dateB - dateA;
    }

    return dateA - dateB;
  });
}

/* =========================================
   TEAM CREST
========================================= */

function TeamCrest({
  team,
  size = "normal",
}: {
  team: Team;
  size?: "normal" | "large";
}) {
  const large = size === "large";

  return (
    <div
      className={`
        relative flex shrink-0 items-center justify-center
        overflow-hidden border border-[#F5C66C]/25
        bg-[linear-gradient(145deg,#33363B,#171E27)]
        font-heading font-extrabold tracking-tight text-[#F5C66C]
        ${
          large
            ? "h-16 w-16 rounded-2xl text-base sm:h-20 sm:w-20 sm:text-xl"
            : "h-11 w-11 rounded-xl text-xs sm:h-13 sm:w-13 sm:text-sm"
        }
      `}
    >
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt={`${team.name} logo`}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        team.code.slice(0, 3).toUpperCase()
      )}
    </div>
  );
}

/* =========================================
   FEATURED MATCH
========================================= */

function FeaturedMatch({
  match,
}: {
  match: FootballMatch;
}) {
  const played = match.status !== "scheduled";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group relative block overflow-hidden rounded-2xl
        border border-[#F5C66C]/25
        bg-[linear-gradient(135deg,#252B31_0%,#111B25_65%,#17222C_100%)]
        p-5 transition duration-300
        hover:border-[#F5C66C]/60 sm:p-8
      "
    >
      {/* Decorative pitch rings */}

      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-[#F5C66C]/[0.07]" />

      <div className="pointer-events-none absolute -right-4 -top-10 h-52 w-52 rounded-full border border-[#F5C66C]/[0.06]" />

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F5C66C]/35 to-transparent" />

      {/* Header */}

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F5C66C]" />

          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#F5C66C]">
            Featured Fixture
          </p>
        </div>

        <span
          className={`
            inline-flex items-center gap-2 rounded-md border
            px-3 py-1.5 text-[10px] font-extrabold
            uppercase tracking-[0.1em]
            ${statusStyle(match.status)}
          `}
        >
          {match.status === "live" && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />
          )}

          {statusLabel(match.status)}
        </span>
      </div>

      {/* Fixture information */}

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.09] pb-5 text-[11px] text-[#A4B2BE]">
        <span className="flex items-center gap-2">
          <CalendarDays
            size={13}
            className="text-[#D6B06F]"
          />

          {formatDateTime(match.scheduled_at)}
        </span>

        <span className="flex items-center gap-2">
          <MapPin
            size={13}
            className="text-[#D6B06F]"
          />

          {match.venue || "Venue TBA"}
        </span>
      </div>

      {/* Big scoreboard */}

      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-10 sm:gap-5 sm:py-12">

        {/* Home */}

        <div className="flex min-w-0 flex-col items-center text-center">
          <TeamCrest
            team={match.home_team}
            size="large"
          />

          <p className="mt-4 break-words font-heading text-sm font-bold leading-tight sm:text-lg">
            {match.home_team.name}
          </p>

          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8796A3]">
            Home
          </p>
        </div>

        {/* Central score */}

        <div className="min-w-[90px] text-center sm:min-w-[150px]">
          <p className="font-mono text-[clamp(31px,5vw,62px)] font-extrabold leading-none tracking-[-0.09em] text-white">
            {played ? match.home_score : "–"}

            <span className="mx-2 text-[#6B7782] sm:mx-3">
              :
            </span>

            {played ? match.away_score : "–"}
          </p>

          <p
            className={`
              mt-4 text-[10px] font-extrabold
              uppercase tracking-[0.2em]
              ${
                match.status === "live"
                  ? "text-[#FF818A]"
                  : "text-[#D9B679]"
              }
            `}
          >
            {match.status === "scheduled"
              ? "KICK OFF"
              : match.status === "live"
                ? "IN PLAY"
                : "FINAL"}
          </p>
        </div>

        {/* Away */}

        <div className="flex min-w-0 flex-col items-center text-center">
          <TeamCrest
            team={match.away_team}
            size="large"
          />

          <p className="mt-4 break-words font-heading text-sm font-bold leading-tight sm:text-lg">
            {match.away_team.name}
          </p>

          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8796A3]">
            Away
          </p>
        </div>
      </div>

      {/* Footer */}

      <div className="relative flex items-center justify-between border-t border-white/[0.09] pt-5">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#7E8D9B]">
          MATCH / {String(match.id).padStart(3, "0")}
        </span>

        <span className="flex items-center gap-2 text-xs font-extrabold text-[#F5C66C]">
          Match Centre

          <ArrowUpRight
            size={15}
            className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

/* =========================================
   FIXTURE STRIP
========================================= */

function FixtureStrip({
  match,
  index,
}: {
  match: FootballMatch;
  index: number;
}) {
  const played = match.status !== "scheduled";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group relative grid gap-4 border-b border-white/[0.075]
        px-4 py-5 transition hover:bg-[#F5C66C]/[0.035]
        last:border-b-0 sm:px-6
        lg:grid-cols-[100px_minmax(0,1fr)_170px_24px]
        lg:items-center lg:gap-6
      "
    >
      {/* Gold hover marker */}

      <div className="absolute bottom-0 left-0 top-0 w-[2px] bg-[#F5C66C] opacity-0 transition group-hover:opacity-100" />

      {/* Date column */}

      <div className="flex items-center justify-between gap-3 lg:block">
        <div>
          <p className="font-heading text-lg font-extrabold leading-none text-white">
            {formatShortDate(match.scheduled_at)}
          </p>

          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#82919E]">
            {formatWeekday(match.scheduled_at)}
          </p>
        </div>

        <span className="font-mono text-[10px] text-[#71808D] lg:mt-3 lg:block">
          #{String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Teams and scoreboard */}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">

        {/* Home */}

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamCrest team={match.home_team} />

          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white sm:text-sm">
              {match.home_team.name}
            </p>

            <p className="mt-1 font-mono text-[10px] text-[#83919E]">
              {match.home_team.code}
            </p>
          </div>
        </div>

        {/* Score */}

        <div className="min-w-[72px] text-center sm:min-w-[105px]">
          <p className="font-mono text-2xl font-extrabold tracking-[-0.08em] text-white sm:text-3xl">
            {played ? match.home_score : "–"}

            <span className="mx-1.5 text-[#6C7883] sm:mx-2">
              :
            </span>

            {played ? match.away_score : "–"}
          </p>

          <p
            className={`
              mt-1 text-[9px] font-extrabold tracking-[0.12em]
              ${
                match.status === "live"
                  ? "text-[#FF818A]"
                  : "text-[#83919E]"
              }
            `}
          >
            {match.status === "scheduled"
              ? formatTime(match.scheduled_at)
              : match.status === "live"
                ? "LIVE"
                : "FT"}
          </p>
        </div>

        {/* Away */}

        <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white sm:text-sm">
              {match.away_team.name}
            </p>

            <p className="mt-1 font-mono text-[10px] text-[#83919E]">
              {match.away_team.code}
            </p>
          </div>

          <TeamCrest team={match.away_team} />
        </div>
      </div>

      {/* Status and venue */}

      <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
        <span
          className={`
            inline-flex items-center gap-1.5 rounded-md border
            px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em]
            ${statusStyle(match.status)}
          `}
        >
          {match.status === "live" && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />
          )}

          {statusLabel(match.status)}
        </span>

        <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-[#8795A2] lg:mt-2 lg:justify-end">
          <MapPin
            size={11}
            className="shrink-0"
          />

          <span className="truncate">
            {match.venue || "Venue TBA"}
          </span>
        </p>
      </div>

      {/* Arrow */}

      <ChevronRight
        size={18}
        className="hidden text-[#7E8D99] transition group-hover:translate-x-1 group-hover:text-[#F5C66C] lg:block"
      />
    </Link>
  );
}

/* =========================================
   MAIN PAGE
========================================= */

export default function MatchesPage() {
  const [matches, setMatches] =
    useState<FootballMatch[]>([]);

  const [filter, setFilter] =
    useState<MatchFilter>("all");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [connected, setConnected] = useState(false);

  const refreshTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  /* =========================================
     FETCH MATCHES
  ========================================= */

  const loadMatches = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const data = await getMatches();

        setMatches(
          Array.isArray(data)
            ? (data as FootballMatch[])
            : []
        );

        setError("");
      } catch (err) {
        console.error(
          "Failed to load matches:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load matches."
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
    void loadMatches(true);
  }, [loadMatches]);

  /* =========================================
     GLOBAL REALTIME WEBSOCKET
  ========================================= */

  useEffect(() => {
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
          void loadMatches();
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

      const socketUrl =
        `${protocol}//${backendUrl.host}/ws/live/`;

      const currentSocket =
        new WebSocket(socketUrl);

      socket = currentSocket;

      /*
        Safe React Strict Mode cleanup.

        If the component unmounts while
        connecting, close after opening.
      */

      currentSocket.addEventListener(
        "open",
        () => {
          if (!active) {
            currentSocket.close(
              1000,
              "Component unmounted"
            );
          }
        }
      );

      currentSocket.onopen = () => {
        if (!active) return;

        setConnected(true);

        // Recover missed changes.
        scheduleRefresh();
      };

      currentSocket.onmessage = (
        message: MessageEvent
      ) => {
        if (!active) return;

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          if (data.type === "connection") {
            return;
          }

          if (data.match_id !== undefined) {
            // Immediate local update.

            setMatches((currentMatches) =>
              currentMatches.map((match) => {
                if (
                  match.id !== data.match_id
                ) {
                  return match;
                }

                return {
                  ...match,

                  status:
                    data.status ??
                    match.status,

                  home_score:
                    data.home_score ??
                    match.home_score,

                  away_score:
                    data.away_score ??
                    match.away_score,
                };
              })
            );

            // Authoritative backend refresh.
            scheduleRefresh();
          } else if (
            data.event ===
              "match_started" ||
            data.event ===
              "match_finished"
          ) {
            scheduleRefresh();
          }
        } catch (err) {
          console.error(
            "Matches WebSocket message error:",
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

        reconnectTimer = setTimeout(
          () => {
            if (active) {
              connect();
            }
          },
          3000
        );
      };
    }

    connect();

    /* =====================================
       CLEANUP
    ===================================== */

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (refreshTimer.current) {
        clearTimeout(
          refreshTimer.current
        );

        refreshTimer.current = null;
      }

      const currentSocket = socket;

      if (!currentSocket) return;

      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;

      if (
        currentSocket.readyState ===
        WebSocket.OPEN
      ) {
        currentSocket.close(
          1000,
          "Component unmounted"
        );
      }

      // CONNECTING socket closes via open listener.
    };
  }, [loadMatches]);

  /* =========================================
     MATCH COUNTS
  ========================================= */

  const liveCount = matches.filter(
    (match) =>
      match.status === "live"
  ).length;

  const scheduledCount = matches.filter(
    (match) =>
      match.status === "scheduled"
  ).length;

  const finishedCount = matches.filter(
    (match) =>
      match.status === "finished"
  ).length;

  /* =========================================
     FEATURED MATCH

     Priority:
     1. Live
     2. Nearest upcoming
     3. Most recent finished
  ========================================= */

  const featuredMatch = useMemo(() => {
    const sorted = sortMatches(matches);

    return sorted.length > 0
      ? sorted[0]
      : null;
  }, [matches]);

  /* =========================================
     FILTERED & SORTED MATCHES
  ========================================= */

  const filteredMatches = useMemo(() => {
    const selected =
      filter === "all"
        ? matches
        : matches.filter(
            (match) =>
              match.status === filter
          );

    const searchTerm =
      search.trim().toLowerCase();

    const searched = searchTerm
      ? selected.filter((match) => {
          const searchableText = [
            match.home_team.name,
            match.home_team.code,
            match.away_team.name,
            match.away_team.code,
            match.venue,
            String(match.id),
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            searchTerm
          );
        })
      : selected;

    return sortMatches(searched);
  }, [matches, filter, search]);

  /* =========================================
     FILTER OPTIONS
  ========================================= */

  const filters: {
    value: MatchFilter;
    label: string;
    count: number;
  }[] = [
    {
      value: "all",
      label: "All Fixtures",
      count: matches.length,
    },
    {
      value: "live",
      label: "Live Now",
      count: liveCount,
    },
    {
      value: "scheduled",
      label: "Upcoming",
      count: scheduledCount,
    },
    {
      value: "finished",
      label: "Results",
      count: finishedCount,
    },
  ];

  /* =========================================
     PAGE UI
  ========================================= */

  return (
    <main className="min-h-screen bg-[#090E13] text-white">

      {/* =====================================
          CINEMATIC SPLIT HERO
      ===================================== */}

      <section className="relative isolate overflow-hidden border-b border-white/[0.08]">

        {/* Background */}

        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=2000&q=85')",
          }}
        />

        {/* Overlay */}

        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090E13_0%,rgba(9,14,19,.94)_46%,rgba(9,14,19,.45)_100%)]" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#090E13] via-transparent to-[#090E13]/30" />

        {/* Hero content */}

        <div className="relative mx-auto grid max-w-[1440px] gap-12 px-5 pb-14 pt-9 md:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-16 lg:pb-20 lg:pt-14 xl:px-12">

          {/* Left content */}

          <div>
            <Link
              href="/"
              className="mb-12 inline-flex items-center gap-2 text-xs font-semibold text-[#A9B6C1] transition hover:text-[#F5C66C]"
            >
              <ArrowLeft size={15} />

              Back to Home
            </Link>

            <div className="flex flex-wrap items-center gap-3">

              {/* Section tag */}

              <span className="inline-flex items-center gap-2 rounded-md border border-[#F5C66C]/35 bg-[#F5C66C]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F5C66C]">
                <CircleDot size={12} />

                Football / Match Centre
              </span>

              {/* WebSocket status */}

              <span
                className={`
                  inline-flex items-center gap-1.5 rounded-md border
                  px-3 py-1.5 text-[10px] font-bold
                  ${
                    connected
                      ? "border-[#F5C66C]/30 bg-[#F5C66C]/10 text-[#F5C66C]"
                      : "border-white/15 bg-black/25 text-[#A3B0BC]"
                  }
                `}
              >
                {connected ? (
                  <Wifi size={12} />
                ) : (
                  <WifiOff size={12} />
                )}

                {connected
                  ? "Live Feed Connected"
                  : "Connecting to Live Feed"}
              </span>
            </div>

            {/* Main heading */}

            <div className="mt-7">
              <div className="mb-5 h-[3px] w-12 bg-[#F5C66C]" />

              <h1 className="font-heading text-[clamp(49px,6vw,86px)] font-extrabold leading-[0.99] tracking-[-0.075em]">
                THE MATCH
                <br />

                <span className="text-[#F5C66C]">
                  CENTRE.
                </span>
              </h1>

              <p className="mt-6 max-w-[520px] text-sm leading-7 text-[#B3C0CA] sm:text-base">
                Every kickoff. Every goal. Every final whistle.
                Your front-row seat to the competition.
              </p>
            </div>

            {/* Actions */}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/live"
                className="inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-[#11161C] transition hover:bg-[#FFDA91]"
              >
                <Radio size={15} />

                Live Scoreboard

                <ArrowUpRight size={15} />
              </Link>

              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/25 px-5 py-3 text-xs font-bold text-white backdrop-blur transition hover:border-[#F5C66C]/60"
              >
                <Trophy size={15} />

                Tournaments
              </Link>
            </div>
          </div>

          {/* Right: featured match */}

          <div className="relative">
            {loading && !featuredMatch ? (
              <div className="h-[340px] animate-pulse rounded-2xl border border-[#F5C66C]/15 bg-[#17212B]/90" />
            ) : featuredMatch ? (
              <FeaturedMatch
                match={featuredMatch}
              />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-[#F5C66C]/20 bg-[#17212B]/90 p-8 text-center backdrop-blur">
                <Trophy
                  size={38}
                  className="text-[#F5C66C]"
                />

                <p className="font-heading mt-5 text-xl font-bold">
                  The Stage Is Set
                </p>

                <p className="mt-2 text-sm text-[#9DAAB6]">
                  Featured fixtures will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================
          COMPACT STATS RIBBON
      ===================================== */}

      <section className="border-b border-white/[0.08] bg-[#141C25]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 md:px-8 xl:px-12">

          {[
            {
              icon: Flag,
              label: "Total Fixtures",
              value: matches.length,
            },
            {
              icon: Activity,
              label: "Live Now",
              value: liveCount,
            },
            {
              icon: CalendarDays,
              label: "Upcoming",
              value: scheduledCount,
            },
            {
              icon: Trophy,
              label: "Completed",
              value: finishedCount,
            },
          ].map((stat, index) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
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
                    {loading &&
                    matches.length === 0
                      ? "—"
                      : stat.value}
                  </p>

                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#8795A2]">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================
          FIXTURE DIRECTORY
      ===================================== */}

      <section className="mx-auto max-w-[1440px] px-5 py-12 md:px-8 lg:py-16 xl:px-12">

        {/* Section heading */}

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              The Official Schedule
            </p>

            <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
              Fixtures & Results
            </h2>

            <p className="mt-3 text-sm text-[#92A0AC]">
              Browse upcoming matches, live scores and
              completed fixtures.
            </p>
          </div>

          {/* Refresh */}

          <button
            type="button"
            onClick={() =>
              void loadMatches(true)
            }
            disabled={loading}
            className="
              inline-flex items-center gap-2 rounded-lg
              border border-[#394651] bg-[#18212A]
              px-4 py-2.5 text-xs font-bold text-[#D2DCE4]
              transition hover:border-[#F5C66C]/50
              hover:text-[#F5C66C]
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            {loading
              ? "Refreshing..."
              : "Refresh Fixtures"}
          </button>
        </div>

        {/* =====================================
            FILTER AND SEARCH TOOLBAR
        ===================================== */}

        <div className="mb-6 flex flex-col gap-4 border-y border-[#303C47] py-4 xl:flex-row xl:items-center xl:justify-between">

          {/* Filter navigation */}

          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setFilter(item.value)
                }
                className={`
                  inline-flex items-center gap-2
                  rounded-md px-3.5 py-2.5
                  text-xs font-bold transition
                  ${
                    filter === item.value
                      ? "bg-[#F5C66C] text-[#11161C]"
                      : "border border-[#34414C] bg-[#141D26] text-[#9EACB8] hover:border-[#F5C66C]/35 hover:text-white"
                  }
                `}
              >
                {item.value === "live" && (
                  <span
                    className={`
                      h-1.5 w-1.5 rounded-full
                      ${
                        filter === "live"
                          ? "bg-[#11161C]"
                          : "bg-[#EF6672]"
                      }
                    `}
                  />
                )}

                {item.label}

                <span
                  className={`
                    rounded px-1.5 py-0.5
                    font-mono text-[10px]
                    ${
                      filter === item.value
                        ? "bg-black/10"
                        : "bg-white/[0.06]"
                    }
                  `}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}

          <div className="relative w-full xl:w-[280px]">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7E8D9A]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search team, venue, match..."
              className="
                w-full rounded-lg border border-[#34414C]
                bg-[#141D26] py-2.5 pl-10 pr-4
                text-xs text-white outline-none transition
                placeholder:text-[#71808D]
                focus:border-[#F5C66C]/65
              "
            />
          </div>
        </div>

        {/* Results counter */}

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8493A0]">
            Showing{" "}
            <span className="font-bold text-[#F5C66C]">
              {filteredMatches.length}
            </span>{" "}
            fixtures
          </p>

          <span className="hidden items-center gap-2 text-[10px] text-[#8493A0] sm:flex">
            <Clock3 size={12} />

            Live → Upcoming → Finished
          </span>
        </div>

        {/* =====================================
            ERROR
        ===================================== */}

        {error && (
          <div className="mb-6 rounded-lg border border-[#EF6672]/30 bg-[#EF6672]/10 p-5 text-sm text-[#FFC0C5]">
            <p className="font-bold">
              Unable to load matches
            </p>

            <p className="mt-2">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadMatches(true)
              }
              className="mt-4 font-bold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* =====================================
            LOADING STATE
        ===================================== */}

        {loading &&
        matches.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-[150px] animate-pulse border-b border-white/[0.07] p-5 last:border-0"
                >
                  <div className="h-3 w-24 rounded bg-white/[0.08]" />

                  <div className="mt-6 h-8 w-2/3 rounded bg-white/[0.06]" />

                  <div className="mt-4 h-3 w-1/3 rounded bg-white/[0.04]" />
                </div>
              )
            )}
          </div>
        ) : filteredMatches.length ===
          0 ? (
          /* =====================================
             EMPTY STATE
          ===================================== */

          <div className="rounded-xl border border-[#303C47] bg-[#121B24] px-6 py-16 text-center">
            <CircleDot
              size={38}
              strokeWidth={1.4}
              className="mx-auto text-[#F5C66C]"
            />

            <h3 className="font-heading mt-5 text-xl font-bold">
              No Fixtures Found
            </h3>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#91A0AD]">
              {search.trim()
                ? "No matches match your search. Try another team, venue or match number."
                : filter === "all"
                  ? "No tournament matches are available yet."
                  : `There are no ${filter} matches at the moment.`}
            </p>

            {(filter !== "all" ||
              search.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold text-[#11161C] transition hover:bg-[#FFDA91]"
              >
                Reset Filters

                <ArrowRight size={14} />
              </button>
            )}
          </div>
        ) : (
          /* =====================================
             HORIZONTAL FIXTURE LIST
          ===================================== */

          <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]">

            {/* List header */}

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#34414C] bg-[linear-gradient(90deg,#282A2D,#1B2732)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Flag
                  size={15}
                  className="text-[#F5C66C]"
                />

                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-white">
                  Match Programme
                </p>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#A1AFBA]">
                {filteredMatches.length} Listed
              </p>
            </div>

            {/* Fixtures */}

            <div>
              {filteredMatches.map(
                (match, index) => (
                  <FixtureStrip
                    key={match.id}
                    match={match}
                    index={index}
                  />
                )
              )}
            </div>
          </div>
        )}
      </section>

      {/* =====================================
          CLOSING EDITORIAL BANNER
      ===================================== */}

      <section className="relative mt-4 isolate overflow-hidden border-t border-white/[0.08]">

        {/* Stadium photo */}

        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        {/* Gradient */}

        <div className="absolute inset-0 bg-gradient-to-r from-[#090E13] via-[#090E13]/90 to-[#090E13]/50" />

        {/* Content */}

        <div className="relative mx-auto flex max-w-[1440px] flex-col justify-between gap-7 px-5 py-14 md:flex-row md:items-center md:px-8 xl:px-12">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              Football Never Stops
            </p>

            <h2 className="font-heading mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
              Don&apos;t miss a moment.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-[#A6B3BE]">
              Follow live match action, score changes and
              every moment that defines the competition.
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

            Go To Live Scores

            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
