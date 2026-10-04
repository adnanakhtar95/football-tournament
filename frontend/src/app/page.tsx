import Link from "next/link";

import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Clock3,
  MapPin,
  Radio,
  Shield,
  Trophy,
  Users,
} from "lucide-react";

import { getEvents, getStandings } from "@/lib/api";
import HomeRealtime from "@/components/HomeRealtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -----------------------------------------
   Helpers
----------------------------------------- */

function formatDate(value: string) {
  if (!value) return "Date to be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date to be announced";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusStyle(status: string) {
  switch (status) {
    case "live":
      return "border-red-400/25 bg-red-400/10 text-red-300";

    case "active":
      return "border-[#F5C66C]/30 bg-[#F5C66C]/10 text-[#F5C66C]";

    case "finished":
    case "completed":
      return "border-[#45515D] bg-[#26313B] text-[#C1CAD3]";

    default:
      return "border-[#F5C66C]/20 bg-[#F5C66C]/[0.06] text-[#E3BE78]";
  }
}

/* -----------------------------------------
   Shared section heading
----------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="h-px w-5 bg-[#F5C66C]" />

          <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#F5C66C]">
            {eyebrow}
          </p>
        </div>

        <h2 className="font-heading text-[28px] font-bold tracking-[-0.05em] text-white sm:text-[34px]">
          {title}
        </h2>

        {description && (
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#8E9BA8]">
            {description}
          </p>
        )}
      </div>

      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex items-center gap-2 text-[12px] font-bold text-[#F5C66C] transition hover:text-[#FFDA91]"
        >
          {linkLabel}

          <ArrowUpRight
            size={15}
            className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
}

/* -----------------------------------------
   Homepage
----------------------------------------- */

export default async function Home() {
  const events = await getEvents();

  // Preserve existing tournament prioritization.
  const event =
    events.find((item) => item.status === "active") ??
    events.find((item) => item.status === "completed") ??
    events[0];

  /* ---------------------------------------
     Empty state
  --------------------------------------- */

  if (!event) {
    return (
      <main className="min-h-screen bg-[#0B0F14] text-white">
        {/* Preserve global realtime connection. */}
        <div className="mx-auto max-w-[1440px] px-5 pt-5 md:px-8 xl:px-12">
          <HomeRealtime />
        </div>

        <section className="relative flex min-h-[75vh] items-center justify-center overflow-hidden px-6">
          <div className="pointer-events-none absolute h-[450px] w-[450px] rounded-full bg-[#F5C66C]/[0.035] blur-[100px]" />

          <div className="relative max-w-2xl text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[22px] border border-[#F5C66C]/25 bg-[#F5C66C]/10 text-[#F5C66C]">
              <Trophy size={36} strokeWidth={1.4} />
            </div>

            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-[#F5C66C]">
              Welcome to Football Cup
            </p>

            <h1 className="font-heading text-4xl font-bold tracking-[-0.06em] sm:text-6xl">
              Football lives here.
            </h1>

            <p className="mx-auto mt-6 max-w-lg text-sm leading-8 text-[#95A2AE]">
              Your destination for tournament coverage, live
              football scores, standings and match updates.
              Tournaments will appear here once published.
            </p>

            <Link
              href="/events"
              className="mt-9 inline-flex items-center gap-3 rounded-lg bg-[#F5C66C] px-6 py-3.5 text-[13px] font-extrabold text-[#11161C] transition hover:bg-[#FFDA91]"
            >
              Explore Tournaments
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  /* ---------------------------------------
     Existing data processing
  --------------------------------------- */

  const standings = await getStandings(event.id);

  const matches = event.rounds.flatMap(
    (round) => round.matches
  );

  const liveMatches = matches.filter(
    (match) => match.status === "live"
  );

  const upcomingMatches = matches
    .filter((match) => match.status === "scheduled")
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime()
    );

  const finishedMatches = matches
    .filter((match) => match.status === "finished")
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() -
        new Date(a.scheduled_at).getTime()
    );

  const highlightedMatches = [
    ...liveMatches,
    ...upcomingMatches,
    ...finishedMatches,
  ].slice(0, 4);

  const otherEvents = events.filter(
    (item) => item.id !== event.id
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#0B0F14] text-[#F4F6F8]">

      {/* =====================================
          GLOBAL REALTIME
          Existing component remains mounted.
      ===================================== */}

      <div className="mx-auto max-w-[1440px] px-5 pt-4 md:px-8 xl:px-12">
        <HomeRealtime />
      </div>

      {/* =====================================
          HERO
      ===================================== */}

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Background details */}

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_30%,rgba(245,198,108,0.065),transparent_48%)]" />

        <div className="pointer-events-none absolute right-[-140px] top-[-100px] h-[520px] w-[520px] rounded-full border border-white/[0.035]" />

        <div className="pointer-events-none absolute right-[-50px] top-[-10px] h-[350px] w-[350px] rounded-full border border-white/[0.035]" />

        <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:py-24 xl:px-12">

          {/* Hero copy */}

          <div>
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#F5C66C]/20 bg-[#F5C66C]/[0.055] px-4 py-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F5C66C]/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F5C66C]" />
              </span>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#F5C66C]">
                The Home of Tournament Football
              </span>
            </div>

            <h1 className="font-heading max-w-[760px] text-[clamp(48px,5.7vw,86px)] font-bold leading-[1.04] tracking-[-0.075em] text-white">
              THE GAME.
              <br />

              THE GLORY.
              <br />

              <span className="text-[#F5C66C]">
                THE MOMENT.
              </span>
            </h1>

            <p className="mt-8 max-w-[500px] text-[14px] leading-[1.95] text-[#9AA6B2] sm:text-[15px]">
              Every fixture tells a story. Follow your favourite
              tournaments, experience real-time match coverage
              and stay connected to every defining moment.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/live"
                className="group inline-flex items-center gap-3 rounded-lg bg-[#F5C66C] px-6 py-3.5 text-[12px] font-extrabold uppercase tracking-[0.045em] text-[#11161C] transition hover:bg-[#FFDA91]"
              >
                <Radio size={17} />
                Watch Live Scores

                <ArrowUpRight
                  size={16}
                  className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>

              <Link
                href="/events"
                className="inline-flex items-center gap-3 rounded-lg border border-[#394550] bg-[#1B232C] px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.045em] text-white transition hover:border-[#F5C66C]/50"
              >
                Explore Tournaments
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-3 border-t border-white/[0.07] pt-6">
              <CircleDot size={15} className="text-[#F5C66C]" />

              <span className="text-[11px] font-medium text-[#7F8D9A]">
                Real-time scores. Tournament coverage. No registration required.
              </span>
            </div>
          </div>

          {/* Featured tournament */}

          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-[26px] border border-[#F5C66C]/[0.07]" />

            <div className="relative overflow-hidden rounded-[20px] border border-[#3B444C] bg-[#171E26] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">

              <div className="relative flex min-h-[150px] flex-col justify-between overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,#303037,#202A34_65%,#171E26)] p-7">
                <div className="pointer-events-none absolute -right-5 -top-12 text-[#F5C66C]/[0.06]">
                  <Trophy size={220} strokeWidth={0.8} />
                </div>

                <div className="relative flex items-center justify-between gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#BBC5CE]">
                    Featured Competition
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${statusStyle(event.status)}`}
                  >
                    {event.status}
                  </span>
                </div>

                <div className="relative mt-9 flex items-end justify-between">
                  <Trophy size={35} strokeWidth={1.4} className="text-[#F5C66C]" />

                  <span className="font-mono text-[11px] tracking-widest text-[#A7B0B9]">
                    FC / {String(event.id).padStart(3, "0")}
                  </span>
                </div>
              </div>

              <div className="p-7">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5C66C]">
                  Official Tournament
                </p>

                <h2 className="font-heading text-[28px] font-bold leading-tight tracking-[-0.055em] text-white sm:text-[34px]">
                  {event.name}
                </h2>

                <p className="mt-4 line-clamp-3 min-h-[48px] text-[13px] leading-6 text-[#92A0AC]">
                  {event.description ||
                    "Follow the fixtures, live results and tournament standings."}
                </p>

                <div className="mt-7 grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07] py-5">
                  <div>
                    <p className="font-mono text-[28px] font-bold text-white">
                      {event.teams.length}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[#81909E]">
                      Teams
                    </p>
                  </div>

                  <div className="pl-5">
                    <p className="font-mono text-[28px] font-bold text-white">
                      {matches.length}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[#81909E]">
                      Matches
                    </p>
                  </div>

                  <div className="pl-5">
                    <p className="font-mono text-[28px] font-bold text-[#F5C66C]">
                      {liveMatches.length}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[#81909E]">
                      Live Now
                    </p>
                  </div>
                </div>

                <Link
                  href={`/events/${event.id}`}
                  className="group mt-6 flex items-center justify-between rounded-lg bg-[#F5C66C] px-5 py-3.5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[#11161C] transition hover:bg-[#FFDA91]"
                >
                  View Tournament

                  <ArrowUpRight
                    size={18}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          MAIN CONTENT
      ===================================== */}

      <div className="mx-auto max-w-[1440px] space-y-20 px-5 py-14 md:px-8 lg:py-20 xl:px-12">

        {/* QUICK STATS */}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          {[
            {
              label: "Tournaments",
              value: events.length,
              icon: Trophy,
              detail: "Competitions",
            },
            {
              label: "Registered Teams",
              value: event.teams.length,
              icon: Shield,
              detail: "Participants",
            },
            {
              label: "Total Fixtures",
              value: matches.length,
              icon: CalendarDays,
              detail: "Scheduled & played",
            },
            {
              label: "Live Matches",
              value: liveMatches.length,
              icon: Radio,
              detail: "In progress",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="group rounded-xl border border-[#2B3641] bg-[#151C24] p-5 transition hover:border-[#F5C66C]/30 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#95A2AE]">
                    {stat.label}
                  </p>

                  <Icon
                    size={19}
                    strokeWidth={1.5}
                    className="shrink-0 text-[#F5C66C]"
                  />
                </div>

                <p className="mt-6 font-mono text-[34px] font-bold leading-none tracking-[-0.07em] text-white sm:text-[42px]">
                  {stat.value}
                </p>

                <p className="mt-3 text-[11px] text-[#71808F]">
                  {stat.detail}
                </p>
              </div>
            );
          })}
        </section>

        {/* MATCH CENTRE */}

        <section>
          <SectionHeading
            eyebrow="The Match Centre"
            title="Match Highlights"
            description="The action that matters. Live games, upcoming encounters and the latest results."
            href="/matches"
            linkLabel="All Matches"
          />

          {highlightedMatches.length === 0 ? (
            <div className="rounded-xl border border-[#2B3641] bg-[#151C24] px-6 py-14 text-center text-sm text-[#8E9BA8]">
              No fixtures have been scheduled yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {highlightedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="group overflow-hidden rounded-xl border border-[#2B3641] bg-[#151C24] transition hover:-translate-y-0.5 hover:border-[#F5C66C]/40 hover:bg-[#19212A]"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
                    <span className="flex min-w-0 items-center gap-2 text-[11px] text-[#8795A3]">
                      <MapPin size={13} className="shrink-0" />
                      <span className="truncate">
                        {match.venue || "Venue TBA"}
                      </span>
                    </span>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${statusStyle(match.status)}`}
                    >
                      {match.status === "live"
                        ? "● Live"
                        : match.status === "finished"
                          ? "Full Time"
                          : "Upcoming"}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-8 text-center sm:px-7">
                    {/* Home team */}

                    <div className="min-w-0">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[#F5C66C]/20 bg-[#F5C66C]/[0.065] font-heading text-sm font-bold text-[#F5C66C]">
                        {match.home_team.code}
                      </div>

                      <p className="break-words text-[12px] font-bold text-white sm:text-[14px]">
                        {match.home_team.name}
                      </p>

                      <p className="mt-1 text-[10px] uppercase tracking-wider text-[#697887]">
                        Home
                      </p>
                    </div>

                    {/* Score */}

                    <div className="min-w-[90px]">
                      <div className="font-mono whitespace-nowrap text-[30px] font-bold tracking-[-0.075em] text-white sm:text-[39px]">
                        {match.home_score}

                        <span className="mx-2 font-normal text-[#566574]">
                          :
                        </span>

                        {match.away_score}
                      </div>

                      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F5C66C]">
                        {match.status === "scheduled"
                          ? "VS"
                          : match.status === "live"
                            ? "LIVE"
                            : "FT"}
                      </p>
                    </div>

                    {/* Away team */}

                    <div className="min-w-0">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[#4E6073] bg-[#273443] font-heading text-sm font-bold text-[#CED8E2]">
                        {match.away_team.code}
                      </div>

                      <p className="break-words text-[12px] font-bold text-white sm:text-[14px]">
                        {match.away_team.name}
                      </p>

                      <p className="mt-1 text-[10px] uppercase tracking-wider text-[#697887]">
                        Away
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 sm:px-6">
                    <span className="flex items-center gap-2 text-[11px] text-[#81909E]">
                      <Clock3 size={13} />
                      {formatDate(match.scheduled_at)}
                    </span>

                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#F5C66C]">
                      Match Details
                      <ChevronRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* UPCOMING FIXTURES */}

        <section>
          <SectionHeading
            eyebrow="On the Calendar"
            title="Upcoming Fixtures"
            description="Keep track of the next encounters in the competition."
            href="/matches"
            linkLabel="Full Schedule"
          />

          {upcomingMatches.length === 0 ? (
            <div className="rounded-xl border border-[#2B3641] bg-[#151C24] px-6 py-9 text-[13px] text-[#8E9BA8]">
              No upcoming matches are currently scheduled.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#2B3641] bg-[#151C24]">
              {upcomingMatches.slice(0, 5).map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="group flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-5 transition last:border-0 hover:bg-white/[0.025] sm:px-7"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#F5C66C]/20 bg-[#F5C66C]/[0.06] text-[#F5C66C]">
                      <CalendarDays size={17} />
                    </div>

                    <div>
                      <p className="text-[13px] font-bold text-white sm:text-sm">
                        {match.home_team.name}

                        <span className="mx-2 font-medium text-[#6F7D8A]">
                          vs
                        </span>

                        {match.away_team.name}
                      </p>

                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#81909E]">
                        <MapPin size={11} />
                        {match.venue || "Venue TBA"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-[12px] font-semibold text-[#CED5DC]">
                        {formatDate(match.scheduled_at)}
                      </p>

                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#F5C66C]">
                        View Fixture
                      </p>
                    </div>

                    <ChevronRight
                      size={17}
                      className="hidden text-[#F5C66C] transition-transform group-hover:translate-x-1 sm:block"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* REGISTERED TEAMS */}

        <section>
          <SectionHeading
            eyebrow="The Competitors"
            title="Registered Teams"
            description={`The clubs competing in ${event.name}.`}
          />

          {event.teams.length === 0 ? (
            <div className="rounded-xl border border-[#2B3641] bg-[#151C24] p-8 text-sm text-[#8E9BA8]">
              No teams have registered for this tournament yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {event.teams.map((team) => (
                <div
                  key={team.id}
                  className="group flex items-center gap-4 rounded-xl border border-[#2B3641] bg-[#151C24] p-5 transition hover:border-[#F5C66C]/30"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#F5C66C]/20 bg-[#F5C66C]/[0.07] font-heading text-[13px] font-bold text-[#F5C66C]">
                    {team.code.slice(0, 3)}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-bold text-white">
                      {team.name}
                    </h3>

                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#758392]">
                      {team.code}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* STANDINGS */}

        <section>
          <SectionHeading
            eyebrow="The League Table"
            title="Tournament Standings"
            description={`Current rankings and team performance for ${event.name}.`}
            href={`/events/${event.id}`}
            linkLabel="Tournament Details"
          />

          <div className="overflow-hidden rounded-xl border border-[#2B3641] bg-[#151C24]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-[12px]">
                <thead className="border-b border-[#2B3641] bg-[#1D2630] text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#91A0AE]">
                  <tr>
                    <th className="px-5 py-4">#</th>
                    <th className="px-5 py-4">Club</th>
                    <th className="px-4 py-4 text-center">P</th>
                    <th className="px-4 py-4 text-center">W</th>
                    <th className="px-4 py-4 text-center">D</th>
                    <th className="px-4 py-4 text-center">L</th>
                    <th className="px-4 py-4 text-center">GF</th>
                    <th className="px-4 py-4 text-center">GA</th>
                    <th className="px-4 py-4 text-center">GD</th>
                    <th className="px-5 py-4 text-center">PTS</th>
                  </tr>
                </thead>

                <tbody>
                  {standings.map((standing, index) => (
                    <tr
                      key={standing.team_id}
                      className="border-b border-white/[0.055] transition last:border-0 hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
                            index === 0
                              ? "bg-[#F5C66C] text-[#11161C]"
                              : "bg-[#27313C] text-[#91A0AE]"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[13px] font-bold text-white">
                        {standing.team}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.played}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.won}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.drawn}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.lost}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.goals_for}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.goals_against}
                      </td>

                      <td className="px-4 py-4 text-center text-[#B8C3CC]">
                        {standing.goal_difference}
                      </td>

                      <td className="px-5 py-4 text-center font-mono text-[14px] font-bold text-[#F5C66C]">
                        {standing.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {standings.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-[#8E9BA8]">
                Standings are not available yet.
              </div>
            )}
          </div>

          <p className="mt-3 text-[10px] leading-5 text-[#758392]">
            P: Played · W: Won · D: Drawn · L: Lost ·
            GF: Goals For · GA: Goals Against · GD: Goal Difference
          </p>
        </section>

        {/* OTHER TOURNAMENTS */}

        {otherEvents.length > 0 && (
          <section>
            <SectionHeading
              eyebrow="Discover More"
              title="Other Tournaments"
              description="Explore more competitions across the platform."
              href="/events"
              linkLabel="View All"
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherEvents.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href={`/events/${item.id}`}
                  className="group rounded-xl border border-[#2B3641] bg-[#151C24] p-6 transition hover:-translate-y-0.5 hover:border-[#F5C66C]/35"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#F5C66C]/20 bg-[#F5C66C]/[0.07] text-[#F5C66C]">
                      <Trophy size={23} strokeWidth={1.5} />
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase ${statusStyle(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3 className="font-heading text-xl font-bold tracking-[-0.04em] text-white">
                    {item.name}
                  </h3>

                  <p className="mt-3 line-clamp-2 min-h-12 text-[12px] leading-6 text-[#8E9BA8]">
                    {item.description ||
                      "Explore tournament details and fixtures."}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#71808F]">
                      Competition
                    </span>

                    <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#F5C66C]">
                      Explore
                      <ArrowUpRight
                        size={15}
                        className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* BOTTOM CTA */}

        <section className="relative overflow-hidden rounded-[20px] border border-[#F5C66C]/20 bg-[linear-gradient(115deg,#25272B,#1B232C_60%,#151C24)] px-7 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-20 text-[#F5C66C]/[0.04]">
            <Trophy size={300} strokeWidth={0.8} />
          </div>

          <div className="relative">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#F5C66C]">
              Never Miss a Moment
            </p>

            <h2 className="font-heading mt-4 text-[32px] font-bold tracking-[-0.055em] text-white sm:text-[46px]">
              Every second counts.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-[13px] leading-7 text-[#9AA6B2]">
              Follow every goal, every result and every important
              match event as it happens. Your front-row seat to
              tournament football.
            </p>

            <Link
              href="/live"
              className="mt-8 inline-flex items-center gap-3 rounded-lg bg-[#F5C66C] px-7 py-3.5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[#11161C] transition hover:bg-[#FFDA91]"
            >
              <Radio size={17} />
              Open Live Scoreboard
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>

      {/* =====================================
          FOOTER
      ===================================== */}

      <footer className="border-t border-white/[0.07] bg-[#0E1319]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-5 px-5 py-8 text-center md:flex-row md:px-8 md:text-left xl:px-12">
          <div>
            <p className="font-heading text-[17px] font-bold tracking-[-0.05em] text-white">
              FOOTBALL<span className="text-[#F5C66C]">CUP.</span>
            </p>

            <p className="mt-1 text-[10px] text-[#71808F]">
              Football Tournament Management System
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] font-medium text-[#8795A3]">
            <Link href="/events" className="hover:text-[#F5C66C]">
              Tournaments
            </Link>

            <Link href="/matches" className="hover:text-[#F5C66C]">
              Fixtures
            </Link>

            <Link href="/live" className="hover:text-[#F5C66C]">
              Live Scores
            </Link>

            <Link href="/admin" className="hover:text-[#F5C66C]">
              Admin Portal
            </Link>
          </div>

          <p className="text-[10px] text-[#627180]">
            Real-time Tournament Coverage
          </p>
        </div>
      </footer>
    </main>
  );
}