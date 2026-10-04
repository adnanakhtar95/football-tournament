
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";

/* =====================================================
   CONFIGURATION
===================================================== */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =====================================================
   TYPES
===================================================== */

interface TournamentEvent {
  id: number;
  name: string;
  status: string;
}

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface EventTeam {
  id: number;
  event_id?: number;
  team_id: number;
  team: Team;
}

interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
}

/* =====================================================
   API HELPERS
===================================================== */

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

async function getCsrfToken(): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/auth/csrf/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Unable to initialize CSRF protection."
    );
  }

  const token = getCookie("csrftoken");

  if (!token) {
    throw new Error(
      "CSRF token not found. Please refresh the page."
    );
  }

  return token;
}

async function readResponse(
  response: Response
): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Invalid JSON returned by API (HTTP ${response.status}).`
    );
  }
}

function getApiError(
  data: unknown,
  fallback: string
): string {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return fallback;
  }

  const record = data as Record<string, unknown>;

  if (typeof record.detail === "string") {
    return record.detail;
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  const messages = Object.entries(record).map(
    ([field, value]) => {
      const message = Array.isArray(value)
        ? value.join(", ")
        : String(value);

      return `${field}: ${message}`;
    }
  );

  return messages.join(" | ") || fallback;
}

async function fetchAllPages<T>(
  initialUrl: string,
  signal?: AbortSignal
): Promise<T[]> {
  const allItems: T[] = [];

  const visited = new Set<string>();

  let nextUrl: string | null = initialUrl;

  while (nextUrl !== null) {
    const currentUrl: string = nextUrl;

    if (visited.has(currentUrl)) {
      throw new Error(
        "Repeated pagination URL received from API."
      );
    }

    visited.add(currentUrl);

    const response = await fetch(currentUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal,
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        getApiError(
          data,
          `Unable to load records (HTTP ${response.status}).`
        )
      );
    }

    if (Array.isArray(data)) {
      allItems.push(...(data as T[]));

      nextUrl = null;
    } else {
      const page = data as PaginatedResponse<T>;

      allItems.push(...(page.results ?? []));

      nextUrl = page.next
        ? new URL(page.next, currentUrl).toString()
        : null;
    }
  }

  return allItems;
}

/* =====================================================
   IMAGE HELPERS
===================================================== */

function resolveLogo(
  logo: string | null | undefined
): string | null {
  if (!logo || !logo.trim()) {
    return null;
  }

  const value = logo.trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const origin = API_BASE_URL.replace(
    /\/api\/?$/,
    ""
  );

  if (value.startsWith("//")) {
    return `${new URL(API_BASE_URL).protocol}${value}`;
  }

  return `${origin}/${value.replace(/^\/+/, "")}`;
}

/* =====================================================
   TEAM CREST COMPONENT
===================================================== */

function TeamCrest({
  team,
  large = false,
}: {
  team: Team;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  const logo = resolveLogo(team.logo);

  const initials = team.code
    ? team.code.slice(0, 3).toUpperCase()
    : team.name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`
        relative flex shrink-0 items-center justify-center
        overflow-hidden border border-[#466B96]
        bg-[radial-gradient(circle_at_30%_15%,#28517F,#0A192C_80%)]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]
        ${
          large
            ? "h-[86px] w-[86px] rounded-2xl p-3"
            : "h-12 w-12 rounded-xl p-2"
        }
      `}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`${team.name} logo`}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`
            font-black tracking-tight text-[#C1DDFF]
            ${large ? "text-2xl" : "text-sm"}
          `}
        >
          {initials || <Shield size={24} />}
        </span>
      )}
    </div>
  );
}

/* =====================================================
   MAIN PAGE
===================================================== */

export default function AdminEventTeamsPage() {
  /* -------------------------------
     STATES
  -------------------------------- */

  const [events, setEvents] = useState<
    TournamentEvent[]
  >([]);

  const [teams, setTeams] = useState<Team[]>([]);

  const [registrations, setRegistrations] =
    useState<EventTeam[]>([]);

  const [selectedEventId, setSelectedEventId] =
    useState("");

  const [selectedTeamId, setSelectedTeamId] =
    useState("");

  const [loading, setLoading] = useState(true);

  const [
    loadingRegistrations,
    setLoadingRegistrations,
  ] = useState(false);

  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState<
    number | null
  >(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [availableSearch, setAvailableSearch] =
    useState("");

  const [registeredSearch, setRegisteredSearch] =
    useState("");

  const [showEnrollment, setShowEnrollment] =
    useState(true);

  /* =====================================================
     LOAD TOURNAMENTS AND GLOBAL TEAMS
  ===================================================== */

  const loadInitialData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError("");

        const [eventData, teamData] =
          await Promise.all([
            fetchAllPages<TournamentEvent>(
              `${API_BASE_URL}/admin/events/`,
              signal
            ),

            fetchAllPages<Team>(
              `${API_BASE_URL}/admin/teams/`,
              signal
            ),
          ]);

        if (signal?.aborted) {
          return;
        }

        setEvents(eventData);
        setTeams(teamData);

        setSelectedEventId((current) => {
          if (
            current &&
            eventData.some(
              (event) =>
                String(event.id) === current
            )
          ) {
            return current;
          }

          return eventData.length > 0
            ? String(eventData[0].id)
            : "";
        });
      } catch (err) {
        if (!signal?.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tournament data."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  /* =====================================================
     LOAD REGISTERED TEAMS
  ===================================================== */

  const loadRegistrations = useCallback(
    async (
      eventId: string,
      signal?: AbortSignal
    ) => {
      if (!eventId) {
        setRegistrations([]);
        return;
      }

      try {
        setLoadingRegistrations(true);

        const data = await fetchAllPages<EventTeam>(
          `${API_BASE_URL}/admin/event-teams/?event_id=${encodeURIComponent(eventId)}`,
          signal
        );

        if (signal?.aborted) {
          return;
        }

        // Additional client-side protection in case
        // the backend returns unfiltered records.

        const filtered = data.filter(
          (item) =>
            item.event_id === undefined ||
            Number(item.event_id) ===
              Number(eventId)
        );

        setRegistrations(filtered);
      } catch (err) {
        if (!signal?.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load registered clubs."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingRegistrations(false);
        }
      }
    },
    []
  );

  /* =====================================================
     EFFECTS
  ===================================================== */

  useEffect(() => {
    const controller = new AbortController();

    void loadInitialData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadInitialData]);

  useEffect(() => {
    const controller = new AbortController();

    setRegistrations([]);
    setSelectedTeamId("");
    setAvailableSearch("");
    setRegisteredSearch("");
    setError("");
    setSuccess("");

    if (selectedEventId) {
      void loadRegistrations(
        selectedEventId,
        controller.signal
      );
    }

    return () => {
      controller.abort();
    };
  }, [selectedEventId, loadRegistrations]);

  /* =====================================================
     COMPUTED DATA
  ===================================================== */

  const selectedEvent = useMemo(() => {
    return events.find(
      (event) =>
        String(event.id) === selectedEventId
    );
  }, [events, selectedEventId]);

  const registeredTeamIds = useMemo(() => {
    return new Set(
      registrations.map(
        (registration) => registration.team_id
      )
    );
  }, [registrations]);

  const availableTeams = useMemo(() => {
    return teams.filter(
      (team) => !registeredTeamIds.has(team.id)
    );
  }, [teams, registeredTeamIds]);

  const filteredAvailableTeams = useMemo(() => {
    const query = availableSearch
      .trim()
      .toLowerCase();

    return availableTeams
      .filter((team) => {
        const searchable =
          `${team.name} ${team.code}`.toLowerCase();

        return searchable.includes(query);
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [availableTeams, availableSearch]);

  const filteredRegisteredTeams = useMemo(() => {
    const query = registeredSearch
      .trim()
      .toLowerCase();

    return registrations
      .filter((registration) => {
        const searchable =
          `${registration.team.name} ${registration.team.code}`.toLowerCase();

        return searchable.includes(query);
      })
      .sort((a, b) =>
        a.team.name.localeCompare(b.team.name)
      );
  }, [registrations, registeredSearch]);

  const selectedTeam = useMemo(() => {
    return availableTeams.find(
      (team) =>
        String(team.id) === selectedTeamId
    );
  }, [availableTeams, selectedTeamId]);

  const busy =
    saving ||
    removingId !== null ||
    loadingRegistrations;

  /* =====================================================
     REGISTER TEAM
  ===================================================== */

  async function handleAddTeam() {
    if (busy) {
      return;
    }

    if (!selectedEventId) {
      setError("Please select a tournament.");
      return;
    }

    if (!selectedTeamId) {
      setError("Please select a club.");
      return;
    }

    const eventId = selectedEventId;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/event-teams/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify({
            event_id: Number(eventId),
            team_id: Number(selectedTeamId),
          }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            "Unable to register the selected club."
          )
        );
      }

      setSelectedTeamId("");

      setSuccess(
        "Club successfully registered in the tournament."
      );

      await loadRegistrations(eventId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to register the club."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     REMOVE TEAM
  ===================================================== */

  async function handleRemoveTeam(
    registration: EventTeam
  ) {
    if (busy) {
      return;
    }

    const confirmed = window.confirm(
      `Remove "${registration.team.name}" from this tournament?\n\nThe club will remain in the global Teams registry.`
    );

    if (!confirmed) {
      return;
    }

    const eventId = selectedEventId;

    setRemovingId(registration.id);
    setError("");
    setSuccess("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/event-teams/${registration.id}/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRFToken": csrfToken,
          },
        }
      );

      if (!response.ok) {
        const data = await readResponse(response);

        throw new Error(
          getApiError(
            data,
            "Unable to remove this club."
          )
        );
      }

      setSuccess(
        `${registration.team.name} was removed from the tournament.`
      );

      await loadRegistrations(eventId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove the club."
      );
    } finally {
      setRemovingId(null);
    }
  }

  /* =====================================================
     TOURNAMENT STATUS STYLE
  ===================================================== */

  function getStatusStyle(status: string) {
    switch (status.toLowerCase()) {
      case "active":
        return "border-[#377DD0] bg-[#153D70] text-[#A1CEFF]";

      case "completed":
        return "border-[#9B7848] bg-[#49351F] text-[#F0CB8F]";

      default:
        return "border-[#61738C] bg-[#27374B] text-[#B6C9E0]";
    }
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main className="min-h-full min-w-0 bg-[#070F1D] pb-16 text-[#F5F8FF]">
      <div className="mx-auto max-w-[1650px] px-4 pt-7 sm:px-6 xl:px-9">

        {/* ==========================================
            BREADCRUMB
        ========================================== */}

        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[11px] font-bold text-[#91B6E5] transition hover:text-white"
          >
            <ArrowLeft size={14} />

            Command Centre

            <span className="text-[#506987]">
              /
            </span>

            <span className="text-white">
              Club Enrollment
            </span>
          </Link>

          <Link
            href="/admin/teams"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#355475] bg-[#10243C] px-4 text-[10px] font-black uppercase tracking-wider text-[#B7D5F7] transition hover:border-[#559AF5]"
          >
            <Shield size={14} />
            Global Club Registry
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* ==========================================
            PAGE HEADER
        ========================================== */}

        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#65A7FF]">
              <Sparkles size={13} />

              Tournament Operations / Club Registration
            </p>

            <h1 className="text-[clamp(32px,5vw,59px)] font-black uppercase italic leading-none tracking-[-0.065em]">
              THE CLUB{" "}
              <span className="text-[#4D97FF]">
                ROSTER.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-[12px] leading-6 text-[#94B0D0]">
              Build the competition lineup, enroll
              participating clubs, and manage
              tournament registrations from one
              command centre.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowEnrollment(true);

              document
                .getElementById("enrollment-desk")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#287EF1] px-5 text-[11px] font-black uppercase tracking-wider transition hover:bg-[#4898FF]"
          >
            <Plus size={16} />
            Enroll a Club
          </button>
        </header>

        {/* ==========================================
            FEEDBACK MESSAGES
        ========================================== */}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[#8D465D] bg-[#3A1C2B] p-4 text-[12px] text-[#FFBBC8]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={16}
                className="shrink-0"
              />

              <span>{error}</span>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[#3A77B8] bg-[#142E4E] p-4 text-[12px] text-[#B5D7FF]"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={16}
                className="shrink-0"
              />

              <span>{success}</span>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ==========================================
            COMPETITION HERO
        ========================================== */}

        <section className="relative isolate mb-5 overflow-hidden rounded-xl border border-[#2C4B70] bg-[#0B1C31]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1700&q=85')",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#08182B_4%,rgba(8,24,43,.94)_48%,rgba(8,24,43,.50))]" />

          <div className="absolute left-0 top-0 h-full w-[3px] bg-[#3E91FF]" />

          <div className="relative grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(250px,390px)] lg:items-end">
            <div className="min-w-0">
              <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#9DCBFF]">
                <Trophy size={14} />
                Competition Selector
              </p>

              <h2 className="break-words text-[clamp(24px,3vw,40px)] font-black uppercase leading-tight tracking-[-0.045em]">
                {selectedEvent
                  ? selectedEvent.name
                  : "SELECT A TOURNAMENT"}
              </h2>

              <p className="mt-3 max-w-lg text-[11px] leading-6 text-[#A5BFDD]">
                Every competition has its own
                independent club roster. Select a
                tournament to manage participating
                teams.
              </p>

              {selectedEvent && (
                <span
                  className={`
                    mt-5 inline-flex items-center gap-2
                    rounded-md border px-3 py-1.5
                    text-[10px] font-black uppercase
                    tracking-wider
                    ${getStatusStyle(selectedEvent.status)}
                  `}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />

                  {selectedEvent.status} Competition
                </span>
              )}
            </div>

            {/* SELECTOR */}

            <div className="min-w-0 rounded-lg border border-[#44678E] bg-[#09192D]/90 p-4 backdrop-blur-md">
              <label
                htmlFor="competition-select"
                className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#9DBDE1]"
              >
                Currently Managing
              </label>

              <div className="relative">
                <select
                  id="competition-select"
                  value={selectedEventId}
                  disabled={loading || busy}
                  onChange={(event) => {
                    setSelectedEventId(
                      event.target.value
                    );

                    setError("");
                    setSuccess("");
                  }}
                  className="h-12 w-full appearance-none rounded-md border border-[#476A91] bg-[#142C48] px-3 pr-10 text-[12px] font-bold text-white outline-none focus:border-[#59A4FF] disabled:opacity-50"
                >
                  <option value="">
                    {loading
                      ? "Loading tournaments..."
                      : "Choose a tournament"}
                  </option>

                  {events.map((event) => (
                    <option
                      key={event.id}
                      value={String(event.id)}
                    >
                      {event.name} ({event.status})
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A3C5EB]"
                />
              </div>

              <p className="mt-3 flex items-center gap-2 text-[10px] text-[#8EADCE]">
                <Activity size={12} />

                {events.length} competition
                {events.length === 1 ? "" : "s"} in
                the system
              </p>
            </div>
          </div>
        </section>

        {/* ==========================================
            STATISTICS
        ========================================== */}

        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">

          {/* REGISTERED */}

          <div className="flex min-h-[105px] items-center gap-3 rounded-lg border border-[#294767] bg-[#0D2036] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4A8CD0] bg-[#1B4068] text-[#92C8FF]">
              <Users size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#8CA9CA]">
                Registered Clubs
              </p>

              <p className="mt-1 text-[27px] font-black leading-none">
                {selectedEventId
                  ? registrations.length
                  : "—"}
              </p>

              <p className="mt-1.5 text-[9px] text-[#6888AA]">
                Tournament lineup
              </p>
            </div>
          </div>

          {/* AVAILABLE */}

          <div className="flex min-h-[105px] items-center gap-3 rounded-lg border border-[#294767] bg-[#0D2036] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#7969BC] bg-[#302952] text-[#C2B1FF]">
              <Plus size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#8CA9CA]">
                Available Clubs
              </p>

              <p className="mt-1 text-[27px] font-black leading-none">
                {selectedEventId
                  ? availableTeams.length
                  : "—"}
              </p>

              <p className="mt-1.5 text-[9px] text-[#6888AA]">
                Ready to enroll
              </p>
            </div>
          </div>

          {/* GLOBAL */}

          <div className="flex min-h-[105px] items-center gap-3 rounded-lg border border-[#294767] bg-[#0D2036] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#93794F] bg-[#42331F] text-[#EAC68B]">
              <Shield size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#8CA9CA]">
                Global Registry
              </p>

              <p className="mt-1 text-[27px] font-black leading-none">
                {teams.length}
              </p>

              <p className="mt-1.5 text-[9px] text-[#6888AA]">
                Total existing clubs
              </p>
            </div>
          </div>

          {/* TOURNAMENT */}

          <div className="flex min-h-[105px] items-center gap-3 rounded-lg border border-[#294767] bg-[#0D2036] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4A8CD0] bg-[#1B4068] text-[#92C8FF]">
              <Trophy size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#8CA9CA]">
                Competition
              </p>

              <p className="mt-1 truncate text-[17px] font-black uppercase leading-none">
                {selectedEvent?.status ?? "None"}
              </p>

              <p className="mt-2 text-[9px] text-[#6888AA]">
                {selectedEvent
                  ? `Tournament #${selectedEvent.id}`
                  : "Select tournament"}
              </p>
            </div>
          </div>
        </section>

        {/* ==========================================
            ENROLLMENT DESK
        ========================================== */}

        <section
          id="enrollment-desk"
          className="mb-8 overflow-hidden rounded-xl border border-[#31537A] bg-[#0B1D32]"
        >
          {/* DESK HEADER */}

          <button
            type="button"
            onClick={() =>
              setShowEnrollment((current) => !current)
            }
            className="flex w-full flex-wrap items-center justify-between gap-3 bg-[linear-gradient(100deg,#14345B,#10243D)] px-5 py-5 text-left sm:px-7"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#4C86C9] bg-[#22538A] text-[#B5D9FF]">
                <Plus size={20} />
              </span>

              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#86BBFA]">
                  Registration Operations
                </span>

                <span className="mt-1 block text-[19px] font-black uppercase tracking-tight">
                  Add Clubs to the Competition
                </span>
              </span>
            </div>

            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[#9FC8F5]">
              {showEnrollment
                ? "Collapse Desk"
                : "Open Desk"}

              <ChevronDown
                size={15}
                className={`transition-transform ${
                  showEnrollment ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {showEnrollment && (
            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,310px)]">

              {/* AVAILABLE CLUB POOL */}

              <div className="min-w-0 border-b border-[#284766] p-5 sm:p-7 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[17px] font-black uppercase">
                      Available Club Pool
                    </h3>

                    <p className="mt-1 text-[10px] text-[#87A8CB]">
                      Select a club to preview its
                      tournament enrollment.
                    </p>
                  </div>

                  <span className="rounded-md border border-[#345A83] bg-[#142F4D] px-3 py-1.5 font-mono text-[10px] font-bold text-[#A6CFFF]">
                    {availableTeams.length} AVAILABLE
                  </span>
                </div>

                {/* SEARCH */}

                <div className="relative mb-4">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7297BF]"
                  />

                  <input
                    type="search"
                    value={availableSearch}
                    onChange={(event) =>
                      setAvailableSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search clubs by name or code..."
                    aria-label="Search available clubs"
                    className="h-11 w-full rounded-lg border border-[#355676] bg-[#08182B] pl-10 pr-4 text-[12px] text-white outline-none placeholder:text-[#6C8BAA] focus:border-[#4C9AFF]"
                  />
                </div>

                {/* AVAILABLE CLUBS */}

                {!selectedEventId ? (
                  <div className="flex min-h-[175px] items-center justify-center rounded-lg border border-dashed border-[#375777] px-5 text-center text-[12px] text-[#8EACCE]">
                    Select a tournament above to view
                    available clubs.
                  </div>
                ) : loadingRegistrations || loading ? (
                  <div className="flex min-h-[175px] items-center justify-center gap-3 text-[11px] text-[#9DBEE1]">
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />

                    Loading club pool...
                  </div>
                ) : filteredAvailableTeams.length === 0 ? (
                  <div className="flex min-h-[175px] flex-col items-center justify-center rounded-lg border border-dashed border-[#375777] px-5 text-center">
                    <ShieldCheck
                      size={27}
                      className="text-[#76A9E7]"
                    />

                    <p className="mt-3 text-[12px] font-bold">
                      No Available Clubs Found
                    </p>

                    <p className="mt-2 text-[10px] text-[#88A5C6]">
                      {availableTeams.length > 0
                        ? "Try a different search."
                        : "All clubs are already registered."}
                    </p>
                  </div>
                ) : (
                  <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                    {filteredAvailableTeams.map(
                      (team) => {
                        const selected =
                          selectedTeamId ===
                          String(team.id);

                        return (
                          <button
                            key={team.id}
                            type="button"
                            disabled={busy}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedTeamId(
                                selected
                                  ? ""
                                  : String(team.id)
                              );
                            }}
                            className={`
                              group flex min-w-0 items-center gap-3
                              rounded-lg border p-3 text-left transition
                              disabled:opacity-50
                              ${
                                selected
                                  ? "border-[#58A5FF] bg-[#1A4573] shadow-[inset_0_0_0_1px_rgba(88,165,255,.25)]"
                                  : "border-[#294969] bg-[#10243B] hover:border-[#5487BC] hover:bg-[#17334F]"
                              }
                            `}
                          >
                            <TeamCrest
                              key={`${team.id}-${team.logo}`}
                              team={team}
                            />

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-black">
                                {team.name}
                              </span>

                              <span className="mt-1 block font-mono text-[10px] font-bold tracking-wider text-[#83B6F2]">
                                {team.code}
                              </span>
                            </span>

                            {selected ? (
                              <CheckCircle2
                                size={17}
                                className="shrink-0 text-[#9CCBFF]"
                              />
                            ) : (
                              <Plus
                                size={15}
                                className="shrink-0 text-[#688EBA] group-hover:text-white"
                              />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              {/* ENROLLMENT PREVIEW */}

              <div className="flex min-w-0 flex-col bg-[#0E233C] p-5 sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#80B9FC]">
                  Enrollment Preview
                </p>

                <div className="mt-5 flex min-h-[190px] flex-col items-center justify-center rounded-lg border border-[#365879] bg-[radial-gradient(circle_at_50%_0%,#234A76,#0A1A2E_80%)] px-4 py-5 text-center">
                  {selectedTeam ? (
                    <>
                      <TeamCrest
                        key={`preview-${selectedTeam.id}`}
                        team={selectedTeam}
                        large
                      />

                      <h4 className="mt-4 max-w-full break-words text-[18px] font-black uppercase leading-tight">
                        {selectedTeam.name}
                      </h4>

                      <p className="mt-2 font-mono text-[10px] font-bold tracking-[0.18em] text-[#91C5FF]">
                        {selectedTeam.code}
                      </p>
                    </>
                  ) : (
                    <>
                      <Shield
                        size={37}
                        className="text-[#547DA7]"
                      />

                      <p className="mt-4 text-[11px] font-bold text-[#A8C3E1]">
                        No Club Selected
                      </p>

                      <p className="mt-2 text-[10px] text-[#6888AA]">
                        Choose a club from the
                        available pool.
                      </p>
                    </>
                  )}
                </div>

                <p className="mt-4 text-[10px] leading-5 text-[#91ACCC]">
                  The selected club will be registered
                  only in{" "}
                  <span className="font-bold text-white">
                    {selectedEvent?.name ??
                      "the selected tournament"}
                  </span>
                  . Its global club record will remain
                  unchanged.
                </p>

                <button
                  type="button"
                  disabled={
                    !selectedEventId ||
                    !selectedTeamId ||
                    busy
                  }
                  onClick={() =>
                    void handleAddTeam()
                  }
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(105deg,#1979F6,#5B6AF1)] px-4 text-[11px] font-black uppercase tracking-[0.09em] text-white transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={16} />
                  )}

                  {saving
                    ? "Registering Club..."
                    : "Confirm Enrollment"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ==========================================
            REGISTERED CLUB GALLERY
        ========================================== */}

        <section className="min-w-0">

          {/* SECTION HEADER */}

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#6CA9F8]">
                <Users size={13} />
                Official Competition Lineup
              </p>

              <h2 className="text-[clamp(24px,3vw,35px)] font-black uppercase tracking-[-0.05em]">
                REGISTERED{" "}
                <span className="text-[#4A95FF]">
                  CLUBS.
                </span>
              </h2>

              <p className="mt-2 text-[11px] text-[#89A9CB]">
                {selectedEvent?.name ??
                  "Choose a tournament"}
                {" · "}
                {registrations.length} club
                {registrations.length === 1
                  ? ""
                  : "s"}{" "}
                enrolled
              </p>
            </div>

            {/* SEARCH AND REFRESH */}

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-[230px] sm:flex-none">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7FA0C4]"
                />

                <input
                  type="search"
                  value={registeredSearch}
                  onChange={(event) =>
                    setRegisteredSearch(
                      event.target.value
                    )
                  }
                  placeholder="Find registered club..."
                  aria-label="Search registered clubs"
                  className="h-10 w-full rounded-lg border border-[#345576] bg-[#0C2036] pl-9 pr-3 text-[11px] text-white outline-none placeholder:text-[#7190B0] focus:border-[#4D98F1]"
                />
              </div>

              <button
                type="button"
                disabled={
                  !selectedEventId || busy
                }
                onClick={() => {
                  if (selectedEventId) {
                    void loadRegistrations(
                      selectedEventId
                    );
                  }
                }}
                className="flex h-10 items-center gap-2 rounded-lg border border-[#345576] bg-[#112941] px-3 text-[10px] font-black uppercase text-[#B3D0F1] transition hover:border-[#4F95E9] disabled:opacity-40"
              >
                <RefreshCw
                  size={13}
                  className={
                    loadingRegistrations
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>
            </div>
          </div>

          {/* NO TOURNAMENT */}

          {!selectedEventId ? (
            <div className="flex min-h-[290px] flex-col items-center justify-center rounded-xl border border-dashed border-[#355477] bg-[#0C1C30] px-5 text-center">
              <Trophy
                size={38}
                className="text-[#6D9ED6]"
              />

              <h3 className="mt-5 text-lg font-black uppercase">
                Choose a Competition
              </h3>

              <p className="mt-2 text-[11px] text-[#86A4C5]">
                Select a tournament above to reveal
                its official club lineup.
              </p>
            </div>
          ) : loadingRegistrations ? (
            <div className="flex min-h-[290px] flex-col items-center justify-center gap-4 rounded-xl border border-[#2C4A6B] bg-[#0C1C30] text-[#A5C6EB]">
              <LoaderCircle
                size={29}
                className="animate-spin"
              />

              <p className="text-[11px] font-black uppercase tracking-wider">
                Loading Competition Roster
              </p>
            </div>
          ) : filteredRegisteredTeams.length === 0 ? (
            <div className="flex min-h-[290px] flex-col items-center justify-center rounded-xl border border-dashed border-[#355477] bg-[#0C1C30] px-5 text-center">
              <Shield
                size={38}
                className="text-[#6D9ED6]"
              />

              <h3 className="mt-5 text-lg font-black uppercase">
                {registrations.length > 0
                  ? "No Matching Clubs"
                  : "Your Roster Is Empty"}
              </h3>

              <p className="mt-2 text-[11px] text-[#86A4C5]">
                {registrations.length > 0
                  ? "Try another club name or code."
                  : "Select a club from the enrollment desk to begin building the competition."}
              </p>
            </div>
          ) : (

            /* =====================================
               PREMIUM TEAM CARDS
            ===================================== */

            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredRegisteredTeams.map(
                (registration, index) => (
                  <article
                    key={registration.id}
                    className="group relative flex h-full min-h-[300px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#2E4C6B] bg-[#0D2036] transition duration-300 hover:-translate-y-1 hover:border-[#568DCC] hover:shadow-[0_16px_45px_rgba(0,0,0,.25)]"
                  >

                    {/* CARD BANNER */}

                    <div className="relative h-[112px] shrink-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_-35%,#2E6095,#112A46_65%,#0A1B30)]">
                      <div
                        className="absolute inset-0 opacity-[0.11]"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(135deg,transparent 0px,transparent 16px,#9BC8FF 17px,#9BC8FF 18px)",
                        }}
                      />

                      <div className="absolute right-4 top-3 font-mono text-[11px] font-black tracking-[0.15em] text-[#7DA9D8]">
                        #
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="absolute left-4 top-3 inline-flex items-center gap-1.5 rounded-md border border-[#44719C] bg-[#173B61]/90 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#B2D7FF]">
                        <Check size={11} />
                        Enrolled
                      </div>

                      {/* OVERLAPPING CLUB CREST */}

                      <div className="absolute bottom-[-27px] left-5">
                        <TeamCrest
                          key={`${registration.team.id}-${registration.team.logo}`}
                          team={registration.team}
                          large
                        />
                      </div>
                    </div>

                    {/* CARD BODY */}

                    <div className="flex min-w-0 flex-1 flex-col px-5 pb-4 pt-10">
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#75B3FF]">
                        {registration.team.code}
                      </p>

                      <h3 className="mt-2 min-h-[48px] break-words text-[20px] font-black uppercase leading-[1.18] tracking-[-0.035em]">
                        {registration.team.name}
                      </h3>

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#2B4969] pt-4">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-[9px] font-black uppercase tracking-wider text-[#88A8C9]">
                          <ShieldCheck
                            size={13}
                            className="shrink-0 text-[#8DBDF6]"
                          />

                          Official Entrant
                        </span>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleRemoveTeam(
                              registration
                            )
                          }
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#775064] bg-[#361E2D] px-3 text-[10px] font-black text-[#F4A8B9] transition hover:border-[#B6637C] hover:bg-[#52283C] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {removingId ===
                          registration.id ? (
                            <LoaderCircle
                              size={13}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2 size={13} />
                          )}

                          {removingId ===
                          registration.id
                            ? "Removing"
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        {/* ==========================================
            FOOTER
        ========================================== */}

        <footer className="mt-11 flex flex-wrap items-center justify-between gap-3 border-t border-[#274361] pt-6">
          <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#7393B6]">
            FOOTBALLCUP / COMPETITION REGISTRY
          </span>

          <Link
            href="/admin/rounds"
            className="inline-flex items-center gap-2 text-[11px] font-black text-[#9BC7FF] transition hover:text-white"
          >
            Next: Configure Rounds

            <ArrowRight size={14} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
