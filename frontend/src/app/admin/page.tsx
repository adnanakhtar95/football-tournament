
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Flag,
  Globe2,
  Layers3,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

/* =========================================
   TYPES
========================================= */

interface AdminUser {
  authenticated: boolean;
  id?: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
}

/* =========================================
   CONFIGURATION
========================================= */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =========================================
   MANAGEMENT MODULES
========================================= */

const modules = [
  {
    number: "01",
    title: "Tournaments",
    description:
      "Create competitions, configure tournament details and oversee their lifecycle.",
    short: "Competition Management",
    href: "/admin/events",
    icon: Trophy,
    accent: "#D6A65D",
  },
  {
    number: "02",
    title: "Teams",
    description:
      "Maintain club identities, team profiles and participating football teams.",
    short: "Club Registry",
    href: "/admin/teams",
    icon: Shield,
    accent: "#64A8FF",
  },
  {
    number: "03",
    title: "Players",
    description:
      "Register players, manage squad information, jersey numbers and player profiles.",
    short: "Player Management",
    href: "/admin/players",
    icon: UserRound,
    accent: "#D99BFF",
  },
  {
    number: "04",
    title: "Event Teams",
    description:
      "Assign registered teams to tournaments and manage event participation.",
    short: "Tournament Registration",
    href: "/admin/event-teams",
    icon: Users,
    accent: "#A69BFF",
  },
  {
    number: "05",
    title: "Rounds",
    description:
      "Structure tournament stages, define match rounds and organize progression.",
    short: "Competition Structure",
    href: "/admin/rounds",
    icon: Layers3,
    accent: "#67C9DA",
  },
  {
    number: "06",
    title: "Matches",
    description:
      "Schedule fixtures, update match status and control live football actions.",
    short: "Fixture Operations",
    href: "/admin/matches",
    icon: CalendarDays,
    accent: "#F18B91",
  },
];

/* =========================================
   WORKFLOW
========================================= */

const workflow = [
  {
    label: "Create Tournament",
    description: "Configure your competition",
    href: "/admin/events",
    icon: Trophy,
  },
  {
    label: "Register Teams",
    description: "Set up participating clubs",
    href: "/admin/teams",
    icon: Shield,
  },
  {
    label: "Register Players",
    description: "Build team squads",
    href: "/admin/players",
    icon: UserRound,
  },
  {
    label: "Assign Event Teams",
    description: "Connect clubs to events",
    href: "/admin/event-teams",
    icon: Users,
  },
  {
    label: "Configure Rounds",
    description: "Organize competition stages",
    href: "/admin/rounds",
    icon: Layers3,
  },
  {
    label: "Schedule Matches",
    description: "Prepare match fixtures",
    href: "/admin/matches",
    icon: CalendarDays,
  },
];

/* =========================================
   SECTION HEADING
========================================= */

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-[5px] w-[5px] rounded-full bg-[#448AFF]" />

        <span className="text-[10px] font-bold uppercase tracking-[0.23em] text-[#70A9FF]">
          {eyebrow}
        </span>
      </div>

      <h2 className="font-heading text-2xl font-bold tracking-[-0.055em] text-[#F5F8FF] sm:text-[29px]">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-[13px] leading-6 text-[#8294AD]">
          {description}
        </p>
      )}
    </div>
  );
}

/* =========================================
   DASHBOARD PAGE
========================================= */

export default function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [currentDate, setCurrentDate] = useState("");

  /*
    Authentication and redirects are handled by
    frontend/src/app/admin/layout.tsx.

    This request only retrieves the administrator's
    display information for the dashboard.
  */

  useEffect(() => {
    let active = true;

    async function loadAdmin() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/me/`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) return;

        const data: AdminUser = await response.json();

        if (
          active &&
          data.authenticated &&
          data.is_staff
        ) {
          setUser(data);
        }
      } catch (error) {
        console.error(
          "Unable to retrieve admin display information:",
          error
        );
      }
    }

    setCurrentDate(
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date())
    );

    void loadAdmin();

    return () => {
      active = false;
    };
  }, []);

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="min-h-full bg-[#080F1C] font-body text-[#F4F7FC]">

      <div className="mx-auto max-w-[1600px] px-5 pb-12 pt-8 md:px-8 xl:px-10">

        {/* =====================================
            INTRODUCTION
        ===================================== */}

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.23em] text-[#70A9FF]">
              Football Operations / 001
            </p>

            <h1 className="font-heading mt-3 text-3xl font-extrabold tracking-[-0.065em] text-white sm:text-4xl">
              Command Overview
              <span className="text-[#448AFF]">.</span>
            </h1>

            <p className="mt-2 text-[13px] text-[#8499B4]">
              Your tournament operations, all in one place.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#8DA2BD]">
            <Clock3
              size={14}
              className="text-[#70A9FF]"
            />

            {currentDate}
          </div>
        </div>

        {/* =====================================
            OPERATIONS HERO
        ===================================== */}

        <section className="relative isolate mb-7 min-h-[310px] overflow-hidden rounded-2xl border border-[#31517B] bg-[#10223D]">

          {/* Background image */}

          <div
            className="absolute inset-0 bg-cover bg-center opacity-55"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=85')",
            }}
          />

          {/* Overlays */}

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0C1B31_0%,rgba(12,27,49,.97)_38%,rgba(12,27,49,.45)_100%)]" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#0C1B31]/70 to-transparent" />

          {/* Top accent */}

          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#448AFF] via-[#70A9FF]/40 to-transparent" />

          {/* Hero content */}

          <div className="relative flex min-h-[310px] flex-col justify-between p-7 sm:p-9 lg:p-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-md border border-[#609BEE]/35 bg-[#2563EB]/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#94BEFF]">
                <Sparkles size={13} />

                Operations Headquarters
              </span>

              <h2 className="font-heading mt-6 max-w-xl text-[clamp(30px,3.5vw,49px)] font-extrabold leading-[1.06] tracking-[-0.065em] text-white">
                Every great tournament
                <br />

                starts with{" "}

                <span className="text-[#78ADFF]">
                  great control.
                </span>
              </h2>

              <p className="mt-4 max-w-lg text-[13px] leading-6 text-[#AFC3DC]">
                Welcome back
                {user?.username
                  ? `, ${user.username}`
                  : ""}
                . Manage competitions, organize participating
                teams, register players, prepare fixtures and
                oversee match operations from your command centre.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/admin/events"
                className="inline-flex items-center gap-2.5 rounded-lg bg-[#3478F6] px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_8px_25px_rgba(37,99,235,.3)] transition hover:bg-[#5593FF]"
              >
                Manage Tournaments

                <ArrowUpRight size={16} />
              </Link>

              <Link
                href="/admin/matches"
                className="inline-flex items-center gap-2.5 rounded-lg border border-[#6586B2]/40 bg-[#10243F]/80 px-5 py-3 text-[11px] font-bold text-[#D5E5FA] transition hover:border-[#83B4FF]"
              >
                <Play size={14} />

                Match Operations
              </Link>
            </div>
          </div>

          {/* Decorative label */}

          <div className="pointer-events-none absolute bottom-5 right-6 hidden items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8FB2DD]/60 lg:flex">
            <Activity size={14} />

            FOOTBALLCUP / ADMIN
          </div>
        </section>

        {/* =====================================
            QUICK ACCESS
        ===================================== */}

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#849DBB]">
              Quick Access
            </p>

            <span className="font-mono text-[10px] text-[#607997]">
              {String(modules.length).padStart(2, "0")} MODULES
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className="group flex min-h-[112px] flex-col justify-between rounded-xl border border-[#273C57] bg-[#101D30] p-4 transition duration-300 hover:-translate-y-1 hover:border-[#4877B4] hover:bg-[#152740]"
                >
                  <div className="flex items-start justify-between">
                    <Icon
                      size={21}
                      strokeWidth={1.7}
                      style={{
                        color: module.accent,
                      }}
                    />

                    <ArrowUpRight
                      size={14}
                      className="text-[#607D9E] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    />
                  </div>

                  <div>
                    <p className="text-[12px] font-bold text-[#E9F0FA]">
                      {module.title}
                    </p>

                    <p className="mt-1 text-[10px] text-[#7189A7]">
                      {module.short}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* =====================================
            MAIN WORKSPACE GRID
        ===================================== */}

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_330px]">

          {/* ===================================
              LEFT: MANAGEMENT DIRECTORY
          =================================== */}

          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Your Workspace"
                title="Management Directory"
                description="Select an operational area to open its management workspace."
              />

              <span className="rounded-md border border-[#2B4260] bg-[#12233B] px-3 py-1.5 font-mono text-[10px] text-[#88A9D4]">
                01 — {String(modules.length).padStart(2, "0")}
              </span>
            </div>

            {/* Management rows */}

            <div className="overflow-hidden rounded-xl border border-[#293E58] bg-[#101C2E]">
              {modules.map((module) => {
                const Icon = module.icon;

                return (
                  <Link
                    key={module.href}
                    href={module.href}
                    className="group flex items-center gap-4 border-b border-[#253750] px-4 py-5 transition last:border-0 hover:bg-[#182B44] sm:gap-5 sm:px-6"
                  >
                    {/* Index */}

                    <span className="hidden w-7 shrink-0 font-mono text-[11px] font-bold text-[#617A9B] sm:block">
                      {module.number}
                    </span>

                    {/* Module icon */}

                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        color: module.accent,
                        borderColor: `${module.accent}35`,
                        backgroundColor: `${module.accent}10`,
                      }}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.7}
                      />
                    </div>

                    {/* Text */}

                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-[15px] font-bold tracking-[-0.025em] text-[#EDF3FC] transition group-hover:text-white">
                        {module.title}
                      </h3>

                      <p className="mt-1.5 text-[11px] leading-5 text-[#8297B2]">
                        {module.description}
                      </p>
                    </div>

                    {/* Desktop action */}

                    <div className="hidden shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6885A9] transition group-hover:text-[#91BCFF] md:flex">
                      Open Module

                      <ArrowUpRight size={15} />
                    </div>

                    {/* Mobile action */}

                    <ChevronRight
                      size={17}
                      className="shrink-0 text-[#6B86A6] transition group-hover:translate-x-1 group-hover:text-[#91BCFF] md:hidden"
                    />
                  </Link>
                );
              })}
            </div>

            {/* =================================
                OPERATION SHORTCUTS
            ================================= */}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/admin/events"
                className="group flex items-center justify-between gap-4 rounded-xl border border-[#2E496A] bg-[#14243B] p-5 transition hover:border-[#4D86D2]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77A9ED]">
                    Competition Setup
                  </p>

                  <p className="mt-2 text-[14px] font-bold">
                    Organize an Event
                  </p>
                </div>

                <ArrowUpRight
                  size={20}
                  className="text-[#77A9ED] transition group-hover:-translate-y-1 group-hover:translate-x-1"
                />
              </Link>

              <Link
                href="/admin/matches"
                className="group flex items-center justify-between gap-4 rounded-xl border border-[#2E496A] bg-[#14243B] p-5 transition hover:border-[#4D86D2]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#77A9ED]">
                    Matchday Control
                  </p>

                  <p className="mt-2 text-[14px] font-bold">
                    Open Match Centre
                  </p>
                </div>

                <ArrowUpRight
                  size={20}
                  className="text-[#77A9ED] transition group-hover:-translate-y-1 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </section>

          {/* ===================================
              RIGHT: OPERATIONS SIDEBAR
          =================================== */}

          <aside className="space-y-5">

            {/* =================================
                SESSION IDENTITY
            ================================= */}

            <div className="overflow-hidden rounded-xl border border-[#2A415F] bg-[#111F33]">
              <div className="border-b border-[#293F5C] px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9AB2D0]">
                    Session Identity
                  </p>

                  <ShieldCheck
                    size={16}
                    className="text-[#79AFFF]"
                  />
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#448AFF]/40 bg-[#2563EB]/20 font-heading text-xl font-extrabold uppercase text-[#8BBAFF]">
                    {user?.username?.charAt(0) || "A"}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {user?.username || "Administrator"}
                    </p>

                    <p className="mt-1 text-[11px] text-[#8299B7]">
                      {user?.is_superuser
                        ? "Super Administrator"
                        : "Administrator"}
                    </p>
                  </div>
                </div>

                <div className="my-5 h-px bg-[#2A3E59]" />

                <div className="space-y-3 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8095B0]">
                      Account ID
                    </span>

                    <span className="font-mono font-bold text-[#D5E4F9]">
                      {user?.id != null
                        ? `#${user.id}`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-[#8095B0]">
                      Staff Access
                    </span>

                    <span className="font-bold text-[#8EB9FF]">
                      Authorized
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-[#8095B0]">
                      Permission Level
                    </span>

                    <span className="font-bold text-[#D5E4F9]">
                      {user?.is_superuser
                        ? "Superuser"
                        : "Staff"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================
                TOURNAMENT WORKFLOW
            ================================= */}

            <div className="rounded-xl border border-[#2A415F] bg-[#111F33] p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9AB2D0]">
                  Tournament Workflow
                </p>

                <Flag
                  size={16}
                  className="text-[#D6A65D]"
                />
              </div>

              <p className="mt-3 text-[11px] leading-5 text-[#849BB8]">
                Follow this operational sequence when setting
                up a new competition.
              </p>

              <div className="mt-6">
                {workflow.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <Link
                      key={step.href}
                      href={step.href}
                      className="group relative flex items-start gap-3"
                    >
                      {/* Timeline marker */}

                      <div className="relative flex shrink-0 flex-col items-center">
                        <div className="z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-[#385579] bg-[#172B47] text-[#8EB9FF] transition group-hover:border-[#448AFF] group-hover:bg-[#2563EB] group-hover:text-white">
                          <Icon size={14} />
                        </div>

                        {index < workflow.length - 1 && (
                          <div className="h-9 w-px bg-[#304967]" />
                        )}
                      </div>

                      {/* Step information */}

                      <div className="flex min-h-[68px] flex-1 items-center justify-between gap-2 pb-4">
                        <div>
                          <p className="text-[11px] font-semibold text-[#B3C4DB] transition group-hover:text-white">
                            {step.label}
                          </p>

                          <p className="mt-1 text-[10px] text-[#68819F]">
                            {step.description}
                          </p>
                        </div>

                        <ArrowUpRight
                          size={13}
                          className="shrink-0 text-[#6B89AC] transition group-hover:text-[#8EB9FF]"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* =================================
                PUBLIC PORTAL
            ================================= */}

            <div className="relative isolate overflow-hidden rounded-xl border border-[#3B5270] bg-[#16283D] p-5">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#3478F6]/10 blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <Globe2
                    size={15}
                    className="text-[#82B4FF]"
                  />

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9DBAE0]">
                    Public Experience
                  </p>
                </div>

                <h3 className="font-heading mt-4 text-xl font-bold tracking-[-0.045em]">
                  See the other side.
                </h3>

                <p className="mt-2 text-[11px] leading-5 text-[#8FA7C5]">
                  Preview how tournament information
                  appears to public visitors.
                </p>

                <Link
                  href="/"
                  className="mt-5 inline-flex items-center gap-2 text-[11px] font-extrabold text-[#91BEFF] transition hover:text-white"
                >
                  Visit Public Portal

                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
