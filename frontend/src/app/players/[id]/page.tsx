
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Hash,
  RefreshCw,
  Shield,
  Target,
  Trophy,
  UserRound,
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
  team: Team;
  full_name: string;
  jersey_number: number;
  position: string;
  position_display: string;
  is_active: boolean;
}

interface PlayerStatistics {
  total_goals: number;
  matches_scored_in: number;
  recorded_matches: number;
  tournaments_scored_in: number;
}

interface TournamentStatistics {
  event_id: number;
  event_name: string;
  goals: number;
}

interface GoalHistory {
  id: number;
  match_id: number;
  event_id: number;
  event_name: string;
  home_team: Team;
  away_team: Team;
  home_score: number;
  away_score: number;
  match_status: string;
  scheduled_at: string;
  minute: number;
  note: string;
}

interface PlayerProfile {
  player: Player;
  statistics: PlayerStatistics;
  tournaments: TournamentStatistics[];
  goal_history: GoalHistory[];
}

/* =========================================
   HELPERS
========================================= */

function formatDate(value: string): string {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
    return new URL(logo, new URL(API_BASE_URL).origin).toString();
  } catch {
    return logo;
  }
}

function TeamCrest({
  team,
  large = false,
}: {
  team: Team;
  large?: boolean;
}) {
  const logo = resolveLogo(team.logo);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#F5C66C]/30 bg-[#222C36] font-heading font-extrabold text-[#F5C66C] ${
        large
          ? "h-16 w-16 rounded-2xl text-xl"
          : "h-11 w-11 rounded-xl text-sm"
      }`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={team.name}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        team.code?.slice(0, 3).toUpperCase() || "FC"
      )}
    </div>
  );
}

/* =========================================
   PLAYER PROFILE PAGE
========================================= */

export default function PublicPlayerProfilePage() {
  const params = useParams<{ id: string }>();

  const playerId = params.id;

  const [profile, setProfile] =
    useState<PlayerProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* =========================================
     LOAD PLAYER PROFILE
  ========================================= */

  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (!playerId) {
        setError("Invalid player ID.");
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetch(
          `${API_BASE_URL}/players/${encodeURIComponent(
            playerId
          )}/profile/`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(
              `Player #${playerId} was not found in the backend.`
            );
          }

          throw new Error(
            `Unable to load player profile (HTTP ${response.status}).`
          );
        }

        const data: PlayerProfile = await response.json();

        if (!data.player || !data.statistics) {
          throw new Error("Invalid player profile response.");
        }

        setProfile(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading the player."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [playerId]
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  /* =========================================
     LOADING STATE
  ========================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090E13] px-5 py-12 text-white">
        <div className="mx-auto max-w-[1280px] animate-pulse">
          <div className="h-4 w-32 rounded bg-white/10" />

          <div className="mt-10 h-[350px] rounded-2xl bg-[#17212B]" />

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 rounded-lg bg-[#17212B]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* =========================================
     ERROR / MISSING PLAYER
  ========================================= */

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090E13] px-5 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-[#34414C] bg-[#141D26] p-8 text-center">
          <UserRound
            size={40}
            className="mx-auto text-[#F5C66C]"
          />

          <h1 className="font-heading mt-6 text-3xl font-bold">
            Player Unavailable
          </h1>

          <p className="mt-4 text-sm leading-7 text-[#A9B6C1]">
            {error || "The requested player profile is unavailable."}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void loadProfile()}
              className="rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold text-[#11161C]"
            >
              Try Again
            </button>

            <Link
              href="/events"
              className="rounded-lg border border-white/20 px-5 py-3 text-xs font-bold"
            >
              Browse Tournaments
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const {
    player,
    statistics,
    tournaments,
    goal_history: goalHistory,
  } = profile;

  const stats = [
    {
      label: "Total Goals",
      value: statistics.total_goals,
      icon: CircleDot,
    },
    {
      label: "Matches Scored In",
      value: statistics.matches_scored_in,
      icon: Target,
    },
    {
      label: "Recorded Matches",
      value: statistics.recorded_matches,
      icon: Activity,
    },
    {
      label: "Tournaments Scored In",
      value: statistics.tournaments_scored_in,
      icon: Trophy,
    },
  ];

  return (
    <main className="min-h-screen bg-[#090E13] text-white">
      {/* =====================================
          PLAYER HERO
      ===================================== */}

      <section className="relative isolate overflow-hidden border-b border-white/[0.08]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1800&q=85')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#090E13] via-[#090E13]/90 to-[#090E13]/50" />

        <div className="relative mx-auto max-w-[1280px] px-5 pb-14 pt-8 md:px-8 lg:pb-20">
          {/* Navigation */}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#AAB8C4] transition hover:text-[#F5C66C]"
            >
              <ArrowLeft size={15} />
              Explore Tournaments
            </Link>

            <button
              type="button"
              onClick={() => void loadProfile(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/25 px-4 py-2.5 text-xs font-bold text-white transition hover:border-[#F5C66C]/50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />

              {refreshing ? "Refreshing..." : "Refresh Statistics"}
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-[#EF6672]/30 bg-[#EF6672]/10 p-4 text-sm text-[#FFC0C5]">
              {error}
            </div>
          )}

          {/* Player identity */}

          <div className="relative mt-14 grid items-center gap-10 lg:grid-cols-[1fr_260px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-[#F5C66C]/35 bg-[#F5C66C]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F5C66C]">
                  Official Player Profile
                </span>

                <span className="rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#B8C4CD]">
                  {player.position_display || player.position}
                </span>

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A5B3BE]">
                  {player.is_active ? "● Active Player" : "○ Inactive Player"}
                </span>
              </div>

              <div className="mb-5 mt-8 h-[3px] w-14 bg-[#F5C66C]" />

              <h1 className="font-heading max-w-3xl break-words text-[clamp(42px,6vw,80px)] font-extrabold leading-[0.98] tracking-[-0.075em]">
                {player.full_name}
              </h1>

              <div className="mt-8 flex items-center gap-4">
                <TeamCrest team={player.team} large />

                <div>
                  <p className="text-sm font-bold text-white">
                    {player.team.name}
                  </p>

                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[#A5B3BE]">
                    {player.team.code} / Registered Player
                  </p>
                </div>
              </div>
            </div>

            {/* Editorial jersey display */}

            <div className="relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#F5C66C]/25 bg-[linear-gradient(145deg,#34302B,#151D26_75%)]">
              <div className="absolute inset-4 rounded-xl border border-[#F5C66C]/10" />

              <Hash
                size={25}
                className="relative text-[#F5C66C]"
              />

              <span className="relative mt-3 text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#D7BA86]">
                Jersey Number
              </span>

              <span className="relative font-mono text-[110px] font-extrabold leading-none tracking-[-0.1em] text-[#F5C66C]">
                {player.jersey_number}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          STATISTICS RIBBON
      ===================================== */}

      <section className="border-b border-white/[0.08] bg-[#151D26]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 px-5 sm:grid-cols-4 md:px-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`flex items-center gap-4 py-6 ${
                  index > 0
                    ? "sm:border-l sm:border-white/[0.08] sm:pl-5"
                    : ""
                }`}
              >
                <Icon
                  size={21}
                  strokeWidth={1.6}
                  className="shrink-0 text-[#F5C66C]"
                />

                <div>
                  <p className="font-mono text-3xl font-extrabold text-white">
                    {stat.value}
                  </p>

                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#91A0AD]">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
        <p className="mb-12 text-xs leading-6 text-[#8797A4]">
          Recorded matches count matches with at least one
          player-linked event, not official lineup appearances.
        </p>

        {/* =====================================
            TOURNAMENT PERFORMANCE
        ===================================== */}

        <section>
          <div className="mb-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              Competition Breakdown
            </p>

            <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-0.055em]">
              Tournament Performance
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#141D26]">
            {tournaments.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy
                  size={35}
                  className="mx-auto text-[#F5C66C]"
                />

                <p className="mt-5 font-bold">
                  No tournament goals yet
                </p>

                <p className="mt-2 text-sm text-[#91A0AD]">
                  Registered goals will appear here once recorded.
                </p>
              </div>
            ) : (
              tournaments.map((tournament, index) => (
                <Link
                  key={tournament.event_id}
                  href={`/events/${tournament.event_id}`}
                  className="group flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-5 transition last:border-0 hover:bg-[#F5C66C]/[0.04] sm:px-7"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="font-mono text-xs text-[#7E8D9A]">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <Trophy
                      size={20}
                      className="shrink-0 text-[#F5C66C]"
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {tournament.event_name}
                      </p>

                      <p className="mt-1 text-[11px] text-[#8C9BA8]">
                        View Tournament
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-5">
                    <div className="text-right">
                      <p className="font-mono text-2xl font-extrabold text-[#F5C66C]">
                        {tournament.goals}
                      </p>

                      <p className="text-[10px] text-[#91A0AD]">
                        {tournament.goals === 1 ? "Goal" : "Goals"}
                      </p>
                    </div>

                    <ArrowUpRight
                      size={16}
                      className="text-[#F5C66C] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* =====================================
            GOAL HISTORY
        ===================================== */}

        <section className="mt-16 pb-12">
          <div className="mb-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C66C]">
              Match Contributions
            </p>

            <h2 className="font-heading mt-2 text-3xl font-bold tracking-[-0.055em]">
              Goal History
            </h2>

            <p className="mt-3 text-sm text-[#91A0AD]">
              A complete record of the player&apos;s registered goals.
            </p>
          </div>

          {goalHistory.length === 0 ? (
            <div className="rounded-xl border border-[#303C47] bg-[#141D26] p-12 text-center">
              <CircleDot
                size={35}
                className="mx-auto text-[#F5C66C]"
              />

              <h3 className="mt-5 font-bold">
                No registered goals recorded
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#91A0AD]">
                This player&apos;s goal history will appear after
                a goal is recorded through Match Control.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#141D26]">
              {goalHistory.map((goal) => (
                <Link
                  key={goal.id}
                  href={`/matches/${goal.match_id}`}
                  className="group block border-b border-white/[0.08] p-5 transition last:border-0 hover:bg-[#F5C66C]/[0.035] sm:p-7"
                >
                  {/* Event and date */}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F5C66C]">
                        {goal.event_name}
                      </p>

                      <p className="mt-2 inline-flex items-center gap-2 text-[11px] text-[#8C9BA8]">
                        <CalendarDays size={12} />
                        {formatDate(goal.scheduled_at)}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-md border border-[#F5C66C]/30 bg-[#F5C66C]/10 px-3 py-2 font-mono text-xs font-bold text-[#F5C66C]">
                      <CircleDot size={13} />

                      {goal.minute}&apos; GOAL
                    </span>
                  </div>

                  {/* Match scoreboard */}

                  <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-y border-white/[0.07] py-5 sm:gap-6">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold sm:text-base">
                        {goal.home_team.name}
                      </p>

                      <p className="mt-1 text-[10px] uppercase tracking-wider text-[#8493A0]">
                        Home
                      </p>
                    </div>

                    <div className="whitespace-nowrap font-mono text-2xl font-extrabold tracking-[-0.06em] text-white sm:text-4xl">
                      {goal.home_score}

                      <span className="mx-2 text-[#73808D]">
                        :
                      </span>

                      {goal.away_score}
                    </div>

                    <div className="min-w-0 text-right">
                      <p className="break-words text-xs font-bold sm:text-base">
                        {goal.away_team.name}
                      </p>

                      <p className="mt-1 text-[10px] uppercase tracking-wider text-[#8493A0]">
                        Away
                      </p>
                    </div>
                  </div>

                  {/* Note and link */}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#A3B1BC]">
                      {goal.note || `Match #${goal.match_id}`}
                    </p>

                    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#F5C66C]">
                      View Match

                      <ArrowRight
                        size={14}
                        className="transition group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
