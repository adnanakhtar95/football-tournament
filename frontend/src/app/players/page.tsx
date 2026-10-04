
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CircleDot,
  Crown,
  Filter,
  Search,
  Shield,
  Trophy,
  Users,
  X,
} from "lucide-react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =========================================
   TYPES
========================================= */

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface Player {
  id: number;
  team: Team | number;
  full_name: string;
  jersey_number: number;
  position: string;
  position_display?: string;
  is_active: boolean;
}

interface PlayerStatistics {
  total_goals: number;
  matches_scored_in: number;
  recorded_matches: number;
  tournaments_scored_in: number;
}

interface PlayerProfile {
  player: Player;
  statistics: PlayerStatistics;
}

interface PlayerWithStats extends Player {
  goals: number | null;
}

type FilterStatus = "all" | "active" | "inactive";

/* =========================================
   HELPERS
========================================= */

function getTeamName(team: Team | number): string {
  return typeof team === "number"
    ? `Team #${team}`
    : team.name;
}

function getTeamId(team: Team | number): number {
  return typeof team === "number" ? team : team.id;
}

function getTeamCode(team: Team | number): string {
  return typeof team === "number"
    ? `T${team}`
    : team.code || team.name.slice(0, 3).toUpperCase();
}

function getTeamLogo(team: Team | number): string | null {
  return typeof team === "number" ? null : team.logo;
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
    return new URL(
      logo,
      new URL(API_BASE_URL).origin
    ).toString();
  } catch {
    return logo;
  }
}

function getPosition(player: Player): string {
  return player.position_display || player.position || "Player";
}

function unpackResults<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray(data.results)
  ) {
    return data.results as T[];
  }

  return [];
}

/* =========================================
   TEAM CREST
========================================= */

function TeamCrest({
  team,
  size = "normal",
}: {
  team: Team | number;
  size?: "normal" | "large";
}) {
  const logo = resolveLogo(getTeamLogo(team));

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#F5C66C]/25 bg-[#202A34] font-heading font-extrabold text-[#F5C66C] ${
        size === "large"
          ? "h-16 w-16 rounded-2xl text-xl"
          : "h-11 w-11 rounded-xl text-xs"
      }`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={getTeamName(team)}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        getTeamCode(team).slice(0, 3).toUpperCase()
      )}
    </div>
  );
}

/* =========================================
   PLAYER TILE
========================================= */

function PlayerTile({
  player,
}: {
  player: PlayerWithStats;
}) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="group relative flex min-h-[245px] flex-col overflow-hidden rounded-xl border border-[#303C47] bg-[#151D26] transition duration-300 hover:-translate-y-1 hover:border-[#F5C66C]/55"
    >
      {/* Background jersey number */}

      <span className="pointer-events-none absolute -right-2 top-7 font-mono text-[130px] font-extrabold leading-none tracking-[-0.13em] text-white/[0.035]">
        {player.jersey_number}
      </span>

      <div className="relative flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <TeamCrest team={player.team} />

          <span className="font-mono text-[11px] font-bold text-[#F5C66C]">
            #{String(player.jersey_number).padStart(2, "0")}
          </span>
        </div>

        <div className="mt-auto pt-9">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F5C66C]">
            {getPosition(player)}
          </p>

          <h3 className="font-heading mt-2 break-words text-xl font-extrabold leading-tight tracking-[-0.045em] text-white">
            {player.full_name}
          </h3>

          <p className="mt-2 truncate text-xs text-[#91A1AE]">
            {getTeamName(player.team)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3.5">
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9CAAB6]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              player.is_active
                ? "bg-[#F5C66C]"
                : "bg-[#657481]"
            }`}
          />

          {player.is_active ? "Active" : "Inactive"}
        </span>

        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F5C66C]">
          Profile

          <ArrowUpRight
            size={14}
            className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

/* =========================================
   MAIN PAGE
========================================= */

export default function PlayersDirectoryPage() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [status, setStatus] = useState<FilterStatus>("all");

  const [goalStatsLoading, setGoalStatsLoading] = useState(false);

  /* =========================================
     FETCH PLAYERS
  ========================================= */

  const loadPlayers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const allPlayers: Player[] = [];
      let nextUrl: string | null = `${API_BASE_URL}/players/`;
      let pageCount = 0;

      /*
        Supports both:
        - Standard DRF arrays
        - Paginated DRF { results, next }
      */

      while (nextUrl && pageCount < 100) {
        const response = await fetch(nextUrl, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load players (HTTP ${response.status}).`
          );
        }

        const data: unknown = await response.json();

        allPlayers.push(...unpackResults<Player>(data));

        if (
          data &&
          typeof data === "object" &&
          "next" in data &&
          typeof data.next === "string" &&
          data.next
        ) {
          nextUrl = new URL(
            data.next,
            nextUrl
          ).toString();
        } else {
          nextUrl = null;
        }

        pageCount += 1;
      }

      const uniquePlayers = Array.from(
        new Map(
          allPlayers.map((player) => [player.id, player])
        ).values()
      );

      setPlayers(
        uniquePlayers.map((player) => ({
          ...player,
          goals: null,
        }))
      );

      setLoading(false);

      /*
        Player statistics are available from the existing
        individual profile endpoint.

        Fetch in small batches rather than launching
        unlimited simultaneous requests.
      */

      if (uniquePlayers.length === 0) return;

      setGoalStatsLoading(true);

      const goalsByPlayer = new Map<number, number>();

      for (let i = 0; i < uniquePlayers.length; i += 5) {
        const batch = uniquePlayers.slice(i, i + 5);

        const results = await Promise.allSettled(
          batch.map(async (player) => {
            const response = await fetch(
              `${API_BASE_URL}/players/${player.id}/profile/`,
              {
                cache: "no-store",
              }
            );

            if (!response.ok) {
              throw new Error(
                `Unable to fetch statistics for player ${player.id}`
              );
            }

            const data: PlayerProfile = await response.json();

            return {
              id: player.id,
              goals: data.statistics.total_goals,
            };
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            goalsByPlayer.set(
              result.value.id,
              result.value.goals
            );
          }
        }

        setPlayers((current) =>
          current.map((player) => ({
            ...player,
            goals: goalsByPlayer.get(player.id) ?? player.goals,
          }))
        );
      }

      setGoalStatsLoading(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the player directory."
      );

      setLoading(false);
      setGoalStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  /* =========================================
     FILTER DATA
  ========================================= */

  const teams = useMemo(() => {
    const teamMap = new Map<number, string>();

    players.forEach((player) => {
      teamMap.set(
        getTeamId(player.team),
        getTeamName(player.team)
      );
    });

    return Array.from(teamMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [players]);

  const positions = useMemo(() => {
    return Array.from(
      new Set(players.map(getPosition))
    ).sort();
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return players
      .filter((player) => {
        const matchesSearch =
          !term ||
          player.full_name.toLowerCase().includes(term) ||
          getTeamName(player.team).toLowerCase().includes(term) ||
          getTeamCode(player.team).toLowerCase().includes(term) ||
          String(player.jersey_number).includes(term);

        const matchesTeam =
          selectedTeam === "all" ||
          String(getTeamId(player.team)) === selectedTeam;

        const matchesPosition =
          selectedPosition === "all" ||
          getPosition(player) === selectedPosition;

        const matchesStatus =
          status === "all" ||
          (status === "active" && player.is_active) ||
          (status === "inactive" && !player.is_active);

        return (
          matchesSearch &&
          matchesTeam &&
          matchesPosition &&
          matchesStatus
        );
      })
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
  }, [
    players,
    search,
    selectedTeam,
    selectedPosition,
    status,
  ]);

  /* =========================================
     GOLDEN BOOT LEADERS
  ========================================= */

  const topScorers = useMemo(() => {
    return players
      .filter(
        (player) =>
          player.goals !== null && player.goals > 0
      )
      .sort(
        (a, b) =>
          (b.goals ?? 0) - (a.goals ?? 0) ||
          a.full_name.localeCompare(b.full_name)
      )
      .slice(0, 5);
  }, [players]);

  const activePlayers = players.filter(
    (player) => player.is_active
  ).length;

  const totalTeams = teams.length;

  const totalRecordedGoals = players.reduce(
    (sum, player) => sum + (player.goals ?? 0),
    0
  );

  const filtersActive =
    search !== "" ||
    selectedTeam !== "all" ||
    selectedPosition !== "all" ||
    status !== "all";

  function clearFilters() {
    setSearch("");
    setSelectedTeam("all");
    setSelectedPosition("all");
    setStatus("all");
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="min-h-screen bg-[#090E13] text-white">

      {/* =====================================
          CINEMATIC HERO
      ===================================== */}

      <section className="relative isolate overflow-hidden border-b border-white/[0.08]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090E13_0%,rgba(9,14,19,.94)_50%,rgba(9,14,19,.45)_100%)]" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#090E13] via-transparent to-[#090E13]/30" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-14 pt-8 md:px-8 lg:pb-20 xl:px-12">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#AFBCC6] transition hover:text-[#F5C66C]"
          >
            <ArrowLeft size={15} />

            Explore Tournaments
          </Link>

          <div className="mt-16 max-w-3xl sm:mt-20">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#F5C66C]">
              Footballcup / Player Database
            </p>

            <div className="mb-6 mt-6 h-[3px] w-14 bg-[#F5C66C]" />

            <h1 className="font-heading text-[clamp(55px,8vw,108px)] font-extrabold leading-[0.92] tracking-[-0.085em]">
              THE
              <br />

              <span className="text-[#F5C66C]">
                SQUAD.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-sm leading-7 text-[#B5C1CB] sm:text-base">
              Every name has a story. Discover registered
              players, explore their teams, follow their
              performances and meet the competition&apos;s
              leading goal scorers.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================
          STATISTICS RIBBON
      ===================================== */}

      <section className="border-b border-white/[0.08] bg-[#151D26]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 md:px-8 xl:px-12">
          {[
            {
              label: "Registered Players",
              value: players.length,
              icon: Users,
            },
            {
              label: "Active Players",
              value: activePlayers,
              icon: Shield,
            },
            {
              label: "Represented Teams",
              value: totalTeams,
              icon: Trophy,
            },
            {
              label: "Player-Linked Goals",
              value: goalStatsLoading
                ? "..."
                : totalRecordedGoals,
              icon: CircleDot,
            },
          ].map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className={`flex items-center gap-4 py-6 ${
                  index > 0
                    ? "sm:border-l sm:border-white/[0.08] sm:pl-6"
                    : ""
                }`}
              >
                <Icon
                  size={21}
                  strokeWidth={1.6}
                  className="shrink-0 text-[#F5C66C]"
                />

                <div>
                  <p className="font-mono text-3xl font-extrabold">
                    {loading ? "—" : item.value}
                  </p>

                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8C9BA8]">
                    {item.label}
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

      <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-8 xl:px-12">

        {/* Error */}

        {error && (
          <div className="mb-8 rounded-lg border border-[#EF6672]/30 bg-[#EF6672]/10 p-5 text-sm text-[#FFC0C5]">
            {error}

            <button
              type="button"
              onClick={() => void loadPlayers()}
              className="ml-4 font-bold underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* =====================================
            GOLDEN BOOT LEADERBOARD
        ===================================== */}

        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
                The Goal Race
              </p>

              <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
                Golden Boot
              </h2>

              <p className="mt-3 text-sm text-[#93A2AF]">
                Leading registered goal scorers across the
                available player profiles.
              </p>
            </div>

            {goalStatsLoading && (
              <span className="text-xs text-[#F5C66C]">
                Updating goal statistics...
              </span>
            )}
          </div>

          {loading ? (
            <div className="h-72 animate-pulse rounded-xl bg-[#17212B]" />
          ) : topScorers.length === 0 ? (
            <div className="rounded-xl border border-[#303C47] bg-[#141D26] px-6 py-12 text-center">
              <Trophy
                size={34}
                className="mx-auto text-[#F5C66C]"
              />

              <p className="mt-4 font-bold">
                No registered scorers yet
              </p>

              <p className="mt-2 text-sm text-[#91A0AD]">
                Players will appear here when goals are
                recorded and linked to their profiles.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">

              {/* Featured leader */}

              {topScorers[0] && (
                <Link
                  href={`/players/${topScorers[0].id}`}
                  className="group relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-[#F5C66C]/40 bg-[linear-gradient(135deg,#3A3022,#171F28_65%)] p-7 transition hover:border-[#F5C66C] sm:p-9"
                >
                  <span className="pointer-events-none absolute -right-3 -top-10 font-mono text-[230px] font-extrabold leading-none text-[#F5C66C]/[0.06]">
                    01
                  </span>

                  <div className="relative flex items-start justify-between">
                    <div className="inline-flex items-center gap-2 rounded-md border border-[#F5C66C]/35 bg-[#F5C66C]/10 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#F5C66C]">
                      <Crown size={14} />

                      Leading Scorer
                    </div>

                    <TeamCrest
                      team={topScorers[0].team}
                      size="large"
                    />
                  </div>

                  <div className="relative mt-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E6C992]">
                      Golden Boot Leader
                    </p>

                    <h3 className="font-heading mt-3 text-3xl font-extrabold tracking-[-0.055em] sm:text-4xl">
                      {topScorers[0].full_name}
                    </h3>

                    <p className="mt-2 text-sm text-[#B5C0CA]">
                      {getTeamName(topScorers[0].team)}
                    </p>

                    <div className="mt-7 flex items-end justify-between">
                      <div>
                        <span className="font-mono text-6xl font-extrabold leading-none text-[#F5C66C]">
                          {topScorers[0].goals}
                        </span>

                        <span className="ml-3 text-xs font-bold uppercase tracking-[0.15em] text-[#C2AD86]">
                          Goals
                        </span>
                      </div>

                      <ArrowUpRight
                        size={23}
                        className="text-[#F5C66C] transition group-hover:-translate-y-1 group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                </Link>
              )}

              {/* Other scorers */}

              <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#141D26]">
                {topScorers.slice(1).map((player, index) => (
                  <Link
                    href={`/players/${player.id}`}
                    key={player.id}
                    className="group flex min-h-[80px] items-center gap-4 border-b border-white/[0.07] px-5 py-4 transition last:border-0 hover:bg-[#F5C66C]/[0.04]"
                  >
                    <span className="w-7 shrink-0 font-mono text-sm font-extrabold text-[#F5C66C]">
                      {String(index + 2).padStart(2, "0")}
                    </span>

                    <TeamCrest team={player.team} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {player.full_name}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-[#8E9DAA]">
                        {getTeamName(player.team)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-2xl font-extrabold text-[#F5C66C]">
                        {player.goals}
                      </p>

                      <p className="text-[10px] text-[#8E9DAA]">
                        Goals
                      </p>
                    </div>

                    <ArrowUpRight
                      size={15}
                      className="text-[#8493A0] transition group-hover:text-[#F5C66C]"
                    />
                  </Link>
                ))}

                {topScorers.length === 1 && (
                  <div className="flex h-full min-h-[180px] items-center justify-center px-6 text-center text-sm text-[#8E9DAA]">
                    More scorers will appear as the
                    tournament progresses.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* =====================================
            PLAYER DIRECTORY
        ===================================== */}

        <section className="mt-20" id="directory">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
                Meet The Competition
              </p>

              <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-0.055em] sm:text-4xl">
                Player Directory
              </h2>

              <p className="mt-3 text-sm text-[#93A2AF]">
                Search and explore every registered player.
              </p>
            </div>

            <p className="font-mono text-xs text-[#A7B4BF]">
              {filteredPlayers.length} / {players.length} PLAYERS
            </p>
          </div>

          {/* Search and filters */}

          <div className="mb-7 rounded-xl border border-[#303C47] bg-[#141D26] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F5C66C]">
              <Filter size={14} />

              Refine Directory
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
              {/* Search */}

              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8494A1]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search player, team or jersey..."
                  className="h-11 w-full rounded-lg border border-[#35424D] bg-[#0D141B] pl-10 pr-4 text-xs text-white outline-none transition placeholder:text-[#788895] focus:border-[#F5C66C]/60"
                />
              </div>

              {/* Team */}

              <select
                value={selectedTeam}
                onChange={(event) =>
                  setSelectedTeam(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-[#35424D] bg-[#0D141B] px-3 text-xs text-white outline-none focus:border-[#F5C66C]/60"
              >
                <option value="all">All Teams</option>

                {teams.map(([id, name]) => (
                  <option key={id} value={String(id)}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Position */}

              <select
                value={selectedPosition}
                onChange={(event) =>
                  setSelectedPosition(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-[#35424D] bg-[#0D141B] px-3 text-xs text-white outline-none focus:border-[#F5C66C]/60"
              >
                <option value="all">All Positions</option>

                {positions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>

              {/* Status */}

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FilterStatus)
                }
                className="h-11 w-full rounded-lg border border-[#35424D] bg-[#0D141B] px-3 text-xs text-white outline-none focus:border-[#F5C66C]/60"
              >
                <option value="all">All Players</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#F5C66C] hover:text-[#FFDA91]"
              >
                <X size={13} />

                Clear All Filters
              </button>
            )}
          </div>

          {/* Loading */}

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[245px] animate-pulse rounded-xl bg-[#17212B]"
                />
              ))}
            </div>
          ) : filteredPlayers.length === 0 ? (
            /* Empty */

            <div className="rounded-xl border border-[#303C47] bg-[#141D26] px-6 py-16 text-center">
              <Users
                size={37}
                className="mx-auto text-[#F5C66C]"
              />

              <h3 className="font-heading mt-5 text-2xl font-bold">
                No Players Found
              </h3>

              <p className="mt-3 text-sm text-[#93A2AF]">
                {players.length === 0
                  ? "No players have been registered yet."
                  : "Try changing your search or filter selection."}
              </p>

              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold text-[#11161C]"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            /* Player grid */

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPlayers.map((player) => (
                <PlayerTile
                  key={player.id}
                  player={player}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* =====================================
          FOOTER CTA
      ===================================== */}

      <section className="relative isolate mt-8 overflow-hidden border-t border-white/[0.08]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1800&q=80')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#090E13] via-[#090E13]/90 to-[#090E13]/50" />

        <div className="relative mx-auto flex max-w-[1440px] flex-col justify-between gap-7 px-5 py-14 md:flex-row md:items-center md:px-8 xl:px-12">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              More Than Individual Glory
            </p>

            <h2 className="font-heading mt-3 text-3xl font-bold tracking-[-0.055em]">
              Discover the tournaments.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-[#A6B3BE]">
              Explore the events, fixtures and teams behind
              the players.
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex shrink-0 items-center gap-3 self-start rounded-lg bg-[#F5C66C] px-6 py-3.5 text-xs font-extrabold uppercase text-[#11161C] transition hover:bg-[#FFDA91]"
          >
            Explore Tournaments

            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
