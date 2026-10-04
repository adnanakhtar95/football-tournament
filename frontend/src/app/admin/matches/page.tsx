
"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  Edit3,
  Flag,
  LoaderCircle,
  MapPin,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";

/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =========================================================
   TYPES
========================================================= */

interface TournamentEvent {
  id: number;
  name: string;
  status: "draft" | "active" | "completed";
}

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface TournamentRound {
  id: number;
  event: number;
  name: string;
  order_number: number;
}

interface EventTeam {
  id: number;
  event_id: number;
  team_id: number;
  team: Team;
}

interface Match {
  id: number;
  round: number;
  home_team: number;
  away_team: number;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  home_score?: number;
  away_score?: number;
}

interface MatchForm {
  homeTeamId: string;
  awayTeamId: string;
  matchDate: string;
  matchTime: string;
  venue: string;
}

type MatchFilter = "all" | Match["status"];

const EMPTY_FORM: MatchForm = {
  homeTeamId: "",
  awayTeamId: "",
  matchDate: "",
  matchTime: "18:00",
  venue: "",
};

const inputClass =
  "block h-12 w-full min-w-0 rounded-xl border border-[#294666] bg-[#09182B] px-4 text-[13px] text-white outline-none transition placeholder:text-[#617E9F] focus:border-[#348CFF] focus:ring-2 focus:ring-[#348CFF]/15 disabled:cursor-not-allowed disabled:opacity-40";

const labelClass =
  "mb-2.5 block text-[10px] font-black uppercase tracking-[0.15em] text-[#9BB7D7]";

/* =========================================================
   API UTILITIES
========================================================= */

function getCookie(name: string): string | null {
  for (const cookie of document.cookie.split(";")) {
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
      "CSRF cookie missing. Refresh the page and try again."
    );
  }

  return token;
}

function getApiError(
  data: unknown,
  fallback: string
): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const errors = data as Record<string, unknown>;

  if (typeof errors.detail === "string") {
    return errors.detail;
  }

  return (
    Object.entries(errors)
      .map(([field, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value);

        return `${field}: ${message}`;
      })
      .join(" | ") || fallback
  );
}

async function fetchAllPages<T>(
  initialUrl: string,
  signal?: AbortSignal
): Promise<T[]> {
  const items: T[] = [];
  const visited = new Set<string>();

  let nextUrl: string | null = initialUrl;

  while (nextUrl !== null) {
    const currentUrl: string = nextUrl;

    if (visited.has(currentUrl)) {
      throw new Error(
        "Invalid API pagination: repeated URL."
      );
    }

    visited.add(currentUrl);

    const response = await fetch(currentUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        getApiError(
          data,
          `Unable to load records (HTTP ${response.status}).`
        )
      );
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      items.push(...data);
      nextUrl = null;
    } else {
      items.push(...(data.results ?? []));

      nextUrl = data.next
        ? new URL(data.next, currentUrl).toString()
        : null;
    }
  }

  return items;
}

/* =========================================================
   DATE HELPERS

   Separate local date and time inputs prevent the native
   datetime-local field from breaking the scheduling layout.
========================================================= */

function pad(number: number): string {
  return String(number).padStart(2, "0");
}

function toLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function toLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function fromApiDate(value: string): {
  date: string;
  time: string;
} {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return {
      date: "",
      time: "18:00",
    };
  }

  return {
    date: toLocalDate(parsed),
    time: toLocalTime(parsed),
  };
}

function buildScheduledDate(
  dateValue: string,
  timeValue: string
): Date | null {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    dateValue
  );

  const timeParts = /^(\d{2}):(\d{2})$/.exec(
    timeValue
  );

  if (!dateParts || !timeParts) {
    return null;
  }

  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  const day = Number(dateParts[3]);
  const hour = Number(timeParts[1]);
  const minute = Number(timeParts[2]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const parsed = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  // Reject impossible dates and DST-adjusted nonexistent times.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
}

function shiftLocalDate(
  dateValue: string,
  days: number
): string {
  const base = dateValue
    ? buildScheduledDate(dateValue, "12:00")
    : null;

  const date = base ?? new Date();

  date.setDate(date.getDate() + days);

  return toLocalDate(date);
}

function formatMatchDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date TBC";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMatchTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time TBC";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* =========================================================
   TEAM CREST
========================================================= */

function resolveLogo(
  logo: string | null | undefined
): string | null {
  if (!logo?.trim()) return null;

  const value = logo.trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const origin = API_BASE_URL.replace(
    /\/api\/?$/,
    ""
  );

  if (value.startsWith("//")) {
    return `${window.location.protocol}${value}`;
  }

  return `${origin}/${value.replace(/^\/+/, "")}`;
}

function TeamCrest({
  team,
  size = 45,
}: {
  team?: Team;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const logo = resolveLogo(team?.logo);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#365474] bg-[#102A47] p-1"
      style={{
        width: size,
        height: size,
      }}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={team?.name ?? "Team"}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Shield
          size={size * 0.45}
          className="text-[#86B6EF]"
        />
      )}
    </div>
  );
}

/* =========================================================
   MATCH STATUS
========================================================= */

function MatchStatus({
  status,
}: {
  status: Match["status"];
}) {
  const styles = {
    scheduled:
      "border-[#315B88] bg-[#133355] text-[#91C5FF]",
    live:
      "border-[#A8485C] bg-[#4C1D30] text-[#FF93A8]",
    finished:
      "border-[#75603B] bg-[#352C20] text-[#E9C58B]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {status === "live" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF758E]" />
      )}

      {status === "scheduled"
        ? "Upcoming"
        : status === "live"
          ? "Live Now"
          : "Full Time"}
    </span>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function AdminMatchesPage() {
  const [events, setEvents] = useState<
    TournamentEvent[]
  >([]);

  const [rounds, setRounds] = useState<
    TournamentRound[]
  >([]);

  const [eventTeams, setEventTeams] = useState<
    EventTeam[]
  >([]);

  const [matches, setMatches] = useState<Match[]>(
    []
  );

  const [selectedEventId, setSelectedEventId] =
    useState("");

  const [selectedRoundId, setSelectedRoundId] =
    useState("");

  const [form, setForm] = useState<MatchForm>({
    ...EMPTY_FORM,
  });

  const [editingId, setEditingId] = useState<
    number | null
  >(null);

  const [loading, setLoading] = useState(true);

  const [loadingEventData, setLoadingEventData] =
    useState(false);

  const [loadingMatches, setLoadingMatches] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<
    number | null
  >(null);

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [filter, setFilter] =
    useState<MatchFilter>("all");

  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);

  const busy = saving || deletingId !== null;

  /* ======================================================
     LOAD MATCHES
  ====================================================== */

  const loadMatches = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoadingMatches(true);

        const data = await fetchAllPages<Match>(
          `${API_BASE_URL}/admin/matches/`,
          signal
        );

        if (!signal?.aborted) {
          setMatches(data);
        }
      } catch (err) {
        if (!signal?.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load matches."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingMatches(false);
        }
      }
    },
    []
  );

  /* ======================================================
     LOAD EVENTS
  ====================================================== */

  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError("");

        const data =
          await fetchAllPages<TournamentEvent>(
            `${API_BASE_URL}/admin/events/`,
            signal
          );

        if (signal?.aborted) return;

        setEvents(data);

        setSelectedEventId((current) => {
          if (
            current &&
            data.some(
              (event) =>
                String(event.id) === current
            )
          ) {
            return current;
          }

          return data.length
            ? String(data[0].id)
            : "";
        });
      } catch (err) {
        if (!signal?.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tournaments."
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

  /* ======================================================
     LOAD ROUNDS + REGISTERED TEAMS
  ====================================================== */

  const loadEventData = useCallback(
    async (
      eventId: string,
      signal?: AbortSignal
    ) => {
      if (!eventId) {
        setRounds([]);
        setEventTeams([]);
        setSelectedRoundId("");
        return;
      }

      try {
        setLoadingEventData(true);
        setError("");

        const [roundData, registrationData] =
          await Promise.all([
            fetchAllPages<TournamentRound>(
              `${API_BASE_URL}/admin/rounds/?event=${encodeURIComponent(
                eventId
              )}`,
              signal
            ),

            fetchAllPages<EventTeam>(
              `${API_BASE_URL}/admin/event-teams/?event_id=${encodeURIComponent(
                eventId
              )}`,
              signal
            ),
          ]);

        if (signal?.aborted) return;

        const filteredRounds = roundData
          .filter(
            (round) =>
              round.event === Number(eventId)
          )
          .sort(
            (a, b) =>
              a.order_number - b.order_number ||
              a.id - b.id
          );

        setRounds(filteredRounds);

        setEventTeams(
          registrationData.filter(
            (registration) =>
              registration.event_id ===
              Number(eventId)
          )
        );

        setSelectedRoundId((current) => {
          if (
            current &&
            filteredRounds.some(
              (round) =>
                String(round.id) === current
            )
          ) {
            return current;
          }

          return filteredRounds.length
            ? String(filteredRounds[0].id)
            : "";
        });
      } catch (err) {
        if (!signal?.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tournament information."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingEventData(false);
        }
      }
    },
    []
  );

  /* ======================================================
     INITIAL LOAD
  ====================================================== */

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      loadEvents(controller.signal),
      loadMatches(controller.signal),
    ]);

    return () => controller.abort();
  }, [loadEvents, loadMatches]);

  useEffect(() => {
    const controller = new AbortController();

    setRounds([]);
    setEventTeams([]);
    setSelectedRoundId("");
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setEditorOpen(false);

    if (selectedEventId) {
      void loadEventData(
        selectedEventId,
        controller.signal
      );
    }

    return () => controller.abort();
  }, [selectedEventId, loadEventData]);

  /* ======================================================
     DERIVED DATA
  ====================================================== */

  const sortedRounds = useMemo(
    () =>
      [...rounds].sort(
        (a, b) =>
          a.order_number - b.order_number ||
          a.id - b.id
      ),
    [rounds]
  );

  const selectedEvent = events.find(
    (event) =>
      event.id === Number(selectedEventId)
  );

  const selectedRound = sortedRounds.find(
    (round) =>
      round.id === Number(selectedRoundId)
  );

  const selectedRoundIndex =
    sortedRounds.findIndex(
      (round) =>
        round.id === Number(selectedRoundId)
    );

  const roundMatches = useMemo(() => {
    if (!selectedRoundId) return [];

    return matches
      .filter(
        (match) =>
          match.round === Number(selectedRoundId)
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime()
      );
  }, [matches, selectedRoundId]);

  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();

    eventTeams.forEach((registration) => {
      map.set(
        registration.team_id,
        registration.team
      );
    });

    return map;
  }, [eventTeams]);

  const usedTeamIds = useMemo(() => {
    const used = new Set<number>();

    roundMatches.forEach((match) => {
      if (match.id === editingId) return;

      used.add(match.home_team);
      used.add(match.away_team);
    });

    return used;
  }, [roundMatches, editingId]);

  const scheduledCount = roundMatches.filter(
    (match) => match.status === "scheduled"
  ).length;

  const liveCount = roundMatches.filter(
    (match) => match.status === "live"
  ).length;

  const finishedCount = roundMatches.filter(
    (match) => match.status === "finished"
  ).length;

  const availableTeams = eventTeams.filter(
    (registration) =>
      !usedTeamIds.has(registration.team_id)
  ).length;

  const displayedMatches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return roundMatches.filter((match) => {
      if (
        filter !== "all" &&
        match.status !== filter
      ) {
        return false;
      }

      if (!query) return true;

      const home = teamMap.get(match.home_team);
      const away = teamMap.get(match.away_team);

      return [
        home?.name,
        home?.code,
        away?.name,
        away?.code,
        match.venue,
        String(match.id),
      ].some((value) =>
        (value ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [roundMatches, filter, search, teamMap]);

  const previewHome = teamMap.get(
    Number(form.homeTeamId)
  );

  const previewAway = teamMap.get(
    Number(form.awayTeamId)
  );

  const previewDate = buildScheduledDate(
    form.matchDate,
    form.matchTime
  );

  /* ======================================================
     FORM HELPERS
  ====================================================== */

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function openCreateEditor() {
    resetForm();
    setError("");
    setMessage("");
    setEditorOpen(true);

    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function beginEditing(match: Match) {
    if (match.status !== "scheduled") {
      setError(
        "Only scheduled matches can be edited."
      );
      return;
    }

    const localDate = fromApiDate(
      match.scheduled_at
    );

    setEditingId(match.id);

    setForm({
      homeTeamId: String(match.home_team),
      awayTeamId: String(match.away_team),
      matchDate: localDate.date,
      matchTime: localDate.time,
      venue: match.venue ?? "",
    });

    setError("");
    setMessage("");
    setEditorOpen(true);

    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function cancelEditing() {
    resetForm();
    setEditorOpen(false);
  }

  function moveRound(direction: -1 | 1) {
    const nextRound =
      sortedRounds[
        selectedRoundIndex + direction
      ];

    if (!nextRound) return;

    setSelectedRoundId(String(nextRound.id));
    resetForm();
    setEditorOpen(false);
    setError("");
    setMessage("");
  }

  function setQuickDate(
    offset: number
  ) {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    setForm((current) => ({
      ...current,
      matchDate: toLocalDate(date),
    }));
  }

  /* ======================================================
     SAVE MATCH
  ====================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    const {
      homeTeamId,
      awayTeamId,
      matchDate,
      matchTime,
      venue,
    } = form;

    setError("");
    setMessage("");

    if (!selectedEventId || !selectedRoundId) {
      setError(
        "Select a tournament and round first."
      );
      return;
    }

    if (!homeTeamId || !awayTeamId) {
      setError("Please select both teams.");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError(
        "A team cannot play against itself."
      );
      return;
    }

    const registeredIds = new Set(
      eventTeams.map(
        (registration) => registration.team_id
      )
    );

    if (
      !registeredIds.has(Number(homeTeamId)) ||
      !registeredIds.has(Number(awayTeamId))
    ) {
      setError(
        "Both teams must be registered in this tournament."
      );
      return;
    }

    if (
      usedTeamIds.has(Number(homeTeamId)) ||
      usedTeamIds.has(Number(awayTeamId))
    ) {
      setError(
        "One of the selected teams already has a fixture in this round."
      );
      return;
    }

    if (!matchDate || !matchTime) {
      setError(
        "Please choose both the match date and kickoff time."
      );
      return;
    }

    const scheduledDate = buildScheduledDate(
      matchDate,
      matchTime
    );

    if (!scheduledDate) {
      setError(
        "The selected date or kickoff time is invalid."
      );
      return;
    }

    const isEditing = editingId !== null;

    setSaving(true);

    try {
      const csrfToken = await getCsrfToken();

      const url = isEditing
        ? `${API_BASE_URL}/admin/matches/${editingId}/`
        : `${API_BASE_URL}/admin/matches/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          round: Number(selectedRoundId),
          home_team: Number(homeTeamId),
          away_team: Number(awayTeamId),
          scheduled_at:
            scheduledDate.toISOString(),
          venue: venue.trim(),
        }),
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            isEditing
              ? "Unable to update match."
              : "Unable to schedule match."
          )
        );
      }

      resetForm();
      setEditorOpen(false);

      await loadMatches();

      setMessage(
        isEditing
          ? "Fixture updated successfully."
          : "New fixture scheduled successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the fixture."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ======================================================
     DELETE MATCH
  ====================================================== */

  async function handleDeleteMatch(
    match: Match
  ) {
    if (match.status !== "scheduled") {
      setError(
        "Only scheduled matches can be deleted."
      );
      return;
    }

    if (busy) return;

    const confirmed = window.confirm(
      `Delete fixture #${match.id}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(match.id);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/matches/${match.id}/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRFToken": csrfToken,
          },
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          getApiError(
            data,
            "Unable to delete match."
          )
        );
      }

      if (editingId === match.id) {
        resetForm();
        setEditorOpen(false);
      }

      await loadMatches();

      setMessage(
        "Fixture deleted successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete match."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <main className="min-h-full min-w-0 bg-[#050D19] font-body text-white">
      <div className="mx-auto max-w-[1700px] px-4 pb-16 pt-7 sm:px-6 xl:px-9">

        {/* BREADCRUMB */}

        <nav className="mb-7 flex flex-wrap items-center gap-2 text-[11px]">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[#7898BD] transition hover:text-white"
          >
            <ArrowLeft size={13} />
            Command Centre
          </Link>

          <ArrowRight
            size={12}
            className="text-[#496787]"
          />

          <span className="font-bold text-[#86BBFF]">
            Match Operations
          </span>
        </nav>

        {/* CINEMATIC HERO */}

        <header className="relative isolate mb-6 overflow-hidden rounded-xl border border-[#294D75] bg-[#091A30]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=85')",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#071426_0%,rgba(7,20,38,.95)_42%,rgba(7,20,38,.4)_100%)]" />

          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#268AFF] via-[#8A5BFF] to-transparent" />

          <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-9 sm:px-9 sm:py-11">
            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#7BB9FF]">
                <Sparkles size={13} />
                Football Operations / Fixtures
              </p>

              <h1 className="font-heading text-[clamp(39px,5.6vw,72px)] font-black uppercase italic leading-[.96] tracking-[-0.075em]">
                MATCH
                <br />
                <span className="text-[#438FFF]">
                  CONTROL.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-[12px] leading-6 text-[#A7C0DC]">
                Build the matchday programme,
                assign fixtures and manage kickoff
                schedules from one operations centre.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateEditor}
              disabled={
                !selectedRoundId ||
                loadingEventData ||
                loadingMatches ||
                busy
              }
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[linear-gradient(110deg,#087AFF,#754EFF)] px-5 text-[11px] font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_35px_rgba(24,101,235,.25)] transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CirclePlus size={17} />
              Create Fixture
            </button>
          </div>
        </header>

        {/* NOTIFICATIONS */}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#A34961]/60 bg-[#431F30]/70 px-5 py-4 text-[#FFB4C4]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <p className="text-[12px] leading-5">
                {error}
              </p>
            </div>

            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#397BBF]/60 bg-[#153B61]/70 px-5 py-4 text-[#B7DBFF]"
          >
            <div className="flex items-start gap-3">
              <Check
                size={17}
                className="mt-0.5 shrink-0"
              />

              <p className="text-[12px] leading-5">
                {message}
              </p>
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* TOURNAMENT SELECTOR */}

        <section className="mb-5 overflow-hidden rounded-xl border border-[#254261] bg-[#0B1B2E]">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:p-6">
            <div className="min-w-0">
              <label
                htmlFor="event-select"
                className={labelClass}
              >
                01 / Select Tournament
              </label>

              <div className="relative">
                <Trophy
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#78AFFF]"
                />

                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(event) => {
                    setSelectedEventId(
                      event.target.value
                    );
                    setError("");
                    setMessage("");
                  }}
                  disabled={loading || busy}
                  className={`${inputClass} appearance-none pl-11 pr-10`}
                >
                  <option value="">
                    Select tournament
                  </option>

                  {events.map((event) => (
                    <option
                      key={event.id}
                      value={event.id}
                    >
                      {event.name} ({event.status})
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7899BD]"
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className={labelClass.replace(
                  "mb-2.5 ",
                  ""
                )}>
                  02 / Matchday Selection
                </span>

                <Link
                  href="/admin/rounds"
                  className="text-[10px] font-bold text-[#78B3FF] hover:text-white"
                >
                  Manage Rounds
                </Link>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveRound(-1)}
                  disabled={
                    selectedRoundIndex <= 0 ||
                    loadingEventData ||
                    busy
                  }
                  aria-label="Previous round"
                  className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-[#305274] bg-[#102842] text-[#A7C8EB] hover:bg-[#1C4166] disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="relative min-w-0 flex-1">
                  <select
                    value={selectedRoundId}
                    onChange={(event) => {
                      setSelectedRoundId(
                        event.target.value
                      );
                      resetForm();
                      setEditorOpen(false);
                      setError("");
                      setMessage("");
                    }}
                    disabled={
                      loadingEventData ||
                      !sortedRounds.length ||
                      busy
                    }
                    aria-label="Select round"
                    className={`${inputClass} appearance-none pr-10 text-center font-bold`}
                  >
                    <option value="">
                      {loadingEventData
                        ? "Loading rounds..."
                        : "Select a round"}
                    </option>

                    {sortedRounds.map((round) => (
                      <option
                        key={round.id}
                        value={round.id}
                      >
                        {round.order_number}.{" "}
                        {round.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7899BD]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => moveRound(1)}
                  disabled={
                    selectedRoundIndex < 0 ||
                    selectedRoundIndex >=
                      sortedRounds.length - 1 ||
                    loadingEventData ||
                    busy
                  }
                  aria-label="Next round"
                  className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-[#305274] bg-[#102842] text-[#A7C8EB] hover:bg-[#1C4166] disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#24415E] bg-[#10233A] px-5 py-3 text-[10px] font-semibold text-[#9CB8D7] lg:px-6">
            <span className="flex items-center gap-2">
              <Flag
                size={12}
                className="text-[#77B4FF]"
              />
              {selectedEvent?.name ??
                "No tournament selected"}
            </span>

            <span className="flex items-center gap-2">
              <Users
                size={12}
                className="text-[#77B4FF]"
              />
              {eventTeams.length} Registered Teams
            </span>

            <span className="flex items-center gap-2">
              <CalendarDays
                size={12}
                className="text-[#77B4FF]"
              />
              {sortedRounds.length} Rounds
            </span>
          </div>
        </section>

        {/* SUMMARY STRIP */}

        <section className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              title: "Round Fixtures",
              value: roundMatches.length,
              icon: Trophy,
              color: "#4A9FFF",
            },
            {
              title: "Upcoming",
              value: scheduledCount,
              icon: CalendarDays,
              color: "#8BBDFF",
            },
            {
              title: "Live Matches",
              value: liveCount,
              icon: Radio,
              color: "#FF8198",
            },
            {
              title: "Completed",
              value: finishedCount,
              icon: Flag,
              color: "#E8BE79",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="relative flex min-h-[104px] items-center gap-4 overflow-hidden rounded-xl border border-[#294565] bg-[#0C1C31] p-4 sm:p-5"
              >
                <div
                  className="absolute bottom-0 left-0 top-0 w-[3px]"
                  style={{
                    background: item.color,
                  }}
                />

                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    color: item.color,
                    borderColor: `${item.color}50`,
                    background: `${item.color}12`,
                  }}
                >
                  <Icon size={20} />
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8DA9CA]">
                    {item.title}
                  </p>

                  <p className="font-heading mt-1 text-[28px] font-black leading-none">
                    {loadingMatches ? "—" : item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* SCHEDULING STUDIO */}

        {editorOpen && (
          <section
            ref={editorRef}
            className="mb-8 scroll-mt-24 overflow-hidden rounded-xl border border-[#3169A8] bg-[#0A192D] shadow-[0_20px_60px_rgba(0,0,0,.28)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#284664] bg-[#102742] px-5 py-5 sm:px-7">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.17em] text-[#7BB8FF]">
                  Fixture Scheduling Studio
                </p>

                <h2 className="font-heading text-xl font-black uppercase tracking-[-0.04em]">
                  {editingId !== null
                    ? `Edit Fixture #${editingId}`
                    : "Create Matchday Fixture"}
                </h2>

                <p className="mt-2 text-[11px] text-[#91ADCD]">
                  {selectedEvent?.name ?? "Tournament"}
                  {" / "}
                  {selectedRound?.name ?? "Round"}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                aria-label="Close scheduler"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A5D82] text-[#ACC8E8] hover:bg-[#214263] disabled:opacity-40"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_310px]">
              <form
                onSubmit={handleSubmit}
                className="grid min-w-0 content-start gap-5 p-5 sm:grid-cols-2 sm:p-7"
              >
                {eventTeams.length < 2 && (
                  <div className="rounded-lg border border-[#84673B] bg-[#33281A] px-4 py-3 text-[12px] text-[#E9C58B] sm:col-span-2">
                    At least two teams must be registered
                    in this tournament.{" "}
                    <Link
                      href="/admin/event-teams"
                      className="font-black underline"
                    >
                      Register teams
                    </Link>
                  </div>
                )}

                {/* HOME TEAM */}

                <div className="min-w-0">
                  <label
                    htmlFor="home-team"
                    className={labelClass}
                  >
                    Home Team
                  </label>

                  <div className="relative">
                    <select
                      id="home-team"
                      value={form.homeTeamId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          homeTeamId:
                            event.target.value,
                        }))
                      }
                      disabled={
                        !selectedRoundId ||
                        loadingEventData ||
                        busy
                      }
                      required
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">
                        Select home team
                      </option>

                      {eventTeams.map(
                        (registration) => {
                          const unavailable =
                            usedTeamIds.has(
                              registration.team_id
                            ) ||
                            form.awayTeamId ===
                              String(
                                registration.team_id
                              );

                          return (
                            <option
                              key={registration.id}
                              value={
                                registration.team_id
                              }
                              disabled={unavailable}
                            >
                              {registration.team.name}
                              {" ("}
                              {registration.team.code}
                              {")"}
                              {usedTeamIds.has(
                                registration.team_id
                              )
                                ? " — already assigned"
                                : ""}
                            </option>
                          );
                        }
                      )}
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7699C0]"
                    />
                  </div>
                </div>

                {/* AWAY TEAM */}

                <div className="min-w-0">
                  <label
                    htmlFor="away-team"
                    className={labelClass}
                  >
                    Away Team
                  </label>

                  <div className="relative">
                    <select
                      id="away-team"
                      value={form.awayTeamId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          awayTeamId:
                            event.target.value,
                        }))
                      }
                      disabled={
                        !selectedRoundId ||
                        loadingEventData ||
                        busy
                      }
                      required
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="">
                        Select away team
                      </option>

                      {eventTeams.map(
                        (registration) => {
                          const unavailable =
                            usedTeamIds.has(
                              registration.team_id
                            ) ||
                            form.homeTeamId ===
                              String(
                                registration.team_id
                              );

                          return (
                            <option
                              key={registration.id}
                              value={
                                registration.team_id
                              }
                              disabled={unavailable}
                            >
                              {registration.team.name}
                              {" ("}
                              {registration.team.code}
                              {")"}
                              {usedTeamIds.has(
                                registration.team_id
                              )
                                ? " — already assigned"
                                : ""}
                            </option>
                          );
                        }
                      )}
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7699C0]"
                    />
                  </div>
                </div>

                {/* DATE */}

                <div className="min-w-0">
                  <label
                    htmlFor="match-date"
                    className={labelClass}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays size={13} />
                      Match Date
                    </span>
                  </label>

                  <input
                    id="match-date"
                    type="date"
                    value={form.matchDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        matchDate:
                          event.target.value,
                      }))
                    }
                    disabled={!selectedRoundId || busy}
                    required
                    className={`${inputClass} min-w-0 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80`}
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Today",
                        offset: 0,
                      },
                      {
                        label: "Tomorrow",
                        offset: 1,
                      },
                      {
                        label: "+7 Days",
                        offset: 7,
                      },
                    ].map((shortcut) => (
                      <button
                        key={shortcut.label}
                        type="button"
                        onClick={() =>
                          setQuickDate(
                            shortcut.offset
                          )
                        }
                        disabled={
                          !selectedRoundId || busy
                        }
                        className="rounded-md border border-[#35577A] bg-[#142C48] px-2.5 py-1.5 text-[10px] font-bold text-[#A5C9F1] transition hover:border-[#4898FF] hover:bg-[#214367] disabled:opacity-30"
                      >
                        {shortcut.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TIME */}

                <div className="min-w-0">
                  <label
                    htmlFor="match-time"
                    className={labelClass}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Clock3 size={13} />
                      Kickoff Time
                    </span>
                  </label>

                  <input
                    id="match-time"
                    type="time"
                    value={form.matchTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        matchTime:
                          event.target.value,
                      }))
                    }
                    step={60}
                    disabled={!selectedRoundId || busy}
                    required
                    className={`${inputClass} min-w-0 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80`}
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "12 PM",
                        value: "12:00",
                      },
                      {
                        label: "3 PM",
                        value: "15:00",
                      },
                      {
                        label: "6 PM",
                        value: "18:00",
                      },
                      {
                        label: "8 PM",
                        value: "20:00",
                      },
                    ].map((time) => (
                      <button
                        key={time.value}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            matchTime: time.value,
                          }))
                        }
                        disabled={
                          !selectedRoundId || busy
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition disabled:opacity-30 ${
                          form.matchTime ===
                          time.value
                            ? "border-[#438FFF] bg-[#194A80] text-white"
                            : "border-[#35577A] bg-[#142C48] text-[#A5C9F1] hover:bg-[#214367]"
                        }`}
                      >
                        {time.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* VENUE */}

                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="match-venue"
                    className={labelClass}
                  >
                    Match Venue
                  </label>

                  <div className="relative">
                    <MapPin
                      size={16}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#78AFFF]"
                    />

                    <input
                      id="match-venue"
                      type="text"
                      value={form.venue}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          venue:
                            event.target.value,
                        }))
                      }
                      placeholder="e.g. Jinnah Stadium, Islamabad"
                      disabled={
                        !selectedRoundId || busy
                      }
                      className={`${inputClass} pl-11`}
                    />
                  </div>
                </div>

                {/* ACTIONS */}

                <div className="flex flex-wrap gap-3 border-t border-[#294967] pt-5 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      loadingEventData ||
                      loadingMatches ||
                      !selectedRoundId ||
                      eventTeams.length < 2
                    }
                    className="inline-flex h-12 min-w-[180px] flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(110deg,#087AFF,#754EFF)] px-5 text-[11px] font-black uppercase tracking-[0.07em] text-white transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : editingId !== null ? (
                      <Save size={16} />
                    ) : (
                      <CirclePlus size={16} />
                    )}

                    {saving
                      ? "Saving Fixture..."
                      : editingId !== null
                        ? "Save Match Changes"
                        : "Confirm Fixture"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#375879] px-5 text-[11px] font-bold text-[#A8C4E4] transition hover:bg-[#193653] disabled:opacity-40"
                  >
                    <RotateCcw size={14} />
                    Cancel
                  </button>
                </div>
              </form>

              {/* LIVE FIXTURE PREVIEW */}

              <aside className="min-w-0 border-t border-[#294967] bg-[radial-gradient(ellipse_at_50%_35%,#1A3A60,#071425_75%)] p-6 xl:border-l xl:border-t-0">
                <p className="mb-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#85B8F1]">
                  <Activity size={13} />
                  Fixture Preview
                </p>

                <div className="overflow-hidden rounded-xl border border-[#3A648D] bg-[#09192C]">
                  <div className="border-b border-[#315171] bg-[#153658] px-4 py-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#A8CFFF]">
                      {selectedRound?.name ??
                        "Matchday"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-8 text-center">
                    <div className="flex min-w-0 flex-col items-center gap-3">
                      <TeamCrest
                        key={`preview-home-${previewHome?.id}`}
                        team={previewHome}
                        size={52}
                      />

                      <p className="w-full truncate text-[11px] font-black">
                        {previewHome?.code ??
                          "HOME"}
                      </p>
                    </div>

                    <div className="font-heading text-xl font-black italic text-[#5B9FFF]">
                      VS
                    </div>

                    <div className="flex min-w-0 flex-col items-center gap-3">
                      <TeamCrest
                        key={`preview-away-${previewAway?.id}`}
                        team={previewAway}
                        size={52}
                      />

                      <p className="w-full truncate text-[11px] font-black">
                        {previewAway?.code ??
                          "AWAY"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#294A6B] bg-[#10243B] px-4 py-4 text-center">
                    <p className="text-[12px] font-black text-white">
                      {previewDate
                        ? previewDate.toLocaleDateString(
                            undefined,
                            {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "Select a match date"}
                    </p>

                    <p className="mt-1 font-mono text-[16px] font-black text-[#83BAFF]">
                      {previewDate
                        ? previewDate.toLocaleTimeString(
                            undefined,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "--:--"}
                    </p>

                    <p className="mt-3 truncate text-[10px] text-[#8CAACB]">
                      {form.venue.trim() ||
                        "Venue to be confirmed"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-center text-[10px] leading-5 text-[#7898BA]">
                  Dates and times are displayed in
                  your browser&apos;s local timezone.
                  The API receives an ISO timestamp.
                </p>
              </aside>
            </div>
          </section>
        )}

        {/* FIXTURE DIRECTORY */}

        <section className="overflow-hidden rounded-xl border border-[#25415F] bg-[#081625]">
          <div className="border-b border-[#274360] bg-[#0D1F34] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#78B4FF]">
                  <SlidersHorizontal size={13} />
                  Fixture Programme
                </p>

                <h2 className="font-heading text-[24px] font-black uppercase tracking-[-0.05em] sm:text-[29px]">
                  {selectedRound?.name ??
                    "Matchday Fixtures"}
                  <span className="ml-2 text-[#438FFF]">
                    / {roundMatches.length}
                  </span>
                </h2>

                <p className="mt-2 text-[11px] text-[#89A6C6]">
                  Review kickoff schedules and
                  open individual match controls.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void loadMatches()
                  }
                  disabled={loadingMatches}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#355879] bg-[#15304D] px-4 text-[11px] font-bold text-[#A9CCF5] hover:border-[#4A96F0] disabled:opacity-40"
                >
                  <RefreshCw
                    size={14}
                    className={
                      loadingMatches
                        ? "animate-spin"
                        : ""
                    }
                  />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={openCreateEditor}
                  disabled={
                    !selectedRoundId ||
                    loadingEventData ||
                    loadingMatches ||
                    busy
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#267FFF] px-4 text-[11px] font-black text-white hover:bg-[#4894FF] disabled:opacity-40"
                >
                  <CirclePlus size={14} />
                  Add Match
                </button>
              </div>
            </div>

            {/* FILTERS */}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-full flex-wrap gap-1.5">
                {[
                  {
                    key: "all",
                    label: "All Fixtures",
                    count: roundMatches.length,
                  },
                  {
                    key: "scheduled",
                    label: "Upcoming",
                    count: scheduledCount,
                  },
                  {
                    key: "live",
                    label: "Live",
                    count: liveCount,
                  },
                  {
                    key: "finished",
                    label: "Finished",
                    count: finishedCount,
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setFilter(
                        item.key as MatchFilter
                      )
                    }
                    className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${
                      filter === item.key
                        ? "border-[#3C8EFF] bg-[#194A80] text-white"
                        : "border-[#2B4A6B] bg-[#10263F] text-[#93B0D0] hover:border-[#4777A9]"
                    }`}
                  >
                    {item.label}
                    <span className="ml-2 opacity-65">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:max-w-[280px]">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7F9FC3]"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search teams or venue..."
                  aria-label="Search fixtures"
                  className="h-10 w-full rounded-lg border border-[#2E4D6E] bg-[#09182B] pl-10 pr-3 text-[11px] text-white outline-none placeholder:text-[#6380A0] focus:border-[#438FFF]"
                />
              </div>
            </div>
          </div>

          {/* LOADING */}

          {loadingMatches ||
          loading ||
          loadingEventData ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center">
              <LoaderCircle
                size={34}
                className="animate-spin text-[#438FFF]"
              />

              <p className="mt-4 text-[12px] text-[#91B1D6]">
                Loading match operations...
              </p>
            </div>
          ) : !selectedRoundId ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
              <CalendarDays
                size={35}
                className="text-[#6EA9EB]"
              />

              <h3 className="font-heading mt-5 text-lg font-black uppercase">
                Select a Matchday
              </h3>

              <p className="mt-2 max-w-sm text-[12px] leading-6 text-[#86A4C5]">
                Choose a tournament and round to
                view or schedule its fixtures.
              </p>
            </div>
          ) : displayedMatches.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
              <Trophy
                size={36}
                className="text-[#6EA9EB]"
              />

              <h3 className="font-heading mt-5 text-lg font-black uppercase">
                {roundMatches.length === 0
                  ? "Matchday Awaits"
                  : "No Matching Fixtures"}
              </h3>

              <p className="mt-2 max-w-sm text-[12px] leading-6 text-[#86A4C5]">
                {roundMatches.length === 0
                  ? "No fixtures have been scheduled for this round yet."
                  : "Try another status filter or search term."}
              </p>

              {roundMatches.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateEditor}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#267FFF] px-5 py-3 text-[11px] font-black text-white hover:bg-[#4894FF]"
                >
                  <CirclePlus size={15} />
                  Schedule First Fixture
                </button>
              )}

              {roundMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                  className="mt-5 text-[11px] font-bold text-[#87BEFF] hover:text-white"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#1F3854]">
              {displayedMatches.map((match) => {
                const homeTeam = teamMap.get(
                  match.home_team
                );

                const awayTeam = teamMap.get(
                  match.away_team
                );

                return (
                  <article
                    key={match.id}
                    className="group min-w-0 px-4 py-5 transition hover:bg-[#10243B] sm:px-6"
                  >
                    {/* TOP ROW */}

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <MatchStatus
                          status={match.status}
                        />

                        <span className="font-mono text-[10px] font-bold text-[#718EAF]">
                          FIXTURE #
                          {String(match.id).padStart(
                            3,
                            "0"
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-semibold text-[#91B0D2]">
                        <CalendarDays
                          size={12}
                          className="text-[#76B4FF]"
                        />

                        {formatMatchDate(
                          match.scheduled_at
                        )}
                      </div>
                    </div>

                    {/* MATCH CONTENT */}

                    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_210px] xl:items-center">
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_115px_minmax(0,1fr)] sm:gap-5">
                        {/* HOME */}

                        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                          <TeamCrest
                            key={`home-${homeTeam?.id}-${homeTeam?.logo}`}
                            team={homeTeam}
                            size={42}
                          />

                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black text-white sm:text-[15px]">
                              {homeTeam?.name ??
                                `Team #${match.home_team}`}
                            </p>

                            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#7393B7]">
                              Home
                            </p>
                          </div>
                        </div>

                        {/* SCORE */}

                        <div className="text-center">
                          <p
                            className={`font-heading text-[21px] font-black tracking-[-0.06em] sm:text-[31px] ${
                              match.status === "live"
                                ? "text-[#FF92A5]"
                                : "text-white"
                            }`}
                          >
                            {match.status ===
                            "scheduled"
                              ? "VS"
                              : `${
                                  match.home_score ?? 0
                                } : ${
                                  match.away_score ?? 0
                                }`}
                          </p>

                          <p className="mt-1 font-mono text-[9px] font-bold text-[#80B7F7]">
                            {match.status ===
                            "scheduled"
                              ? formatMatchTime(
                                  match.scheduled_at
                                )
                              : match.status ===
                                  "live"
                                ? "IN PLAY"
                                : "FT"}
                          </p>
                        </div>

                        {/* AWAY */}

                        <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right sm:gap-4">
                          <TeamCrest
                            key={`away-${awayTeam?.id}-${awayTeam?.logo}`}
                            team={awayTeam}
                            size={42}
                          />

                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black text-white sm:text-[15px]">
                              {awayTeam?.name ??
                                `Team #${match.away_team}`}
                            </p>

                            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#7393B7]">
                              Away
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* MATCH ACTIONS */}

                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 xl:grid-cols-[1fr_auto_auto]">
                        <Link
                          href={`/admin/matches/${match.id}`}
                          className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#236FE0] px-3 text-[10px] font-black text-white transition hover:bg-[#438FFF]"
                        >
                          <Activity size={13} />
                          Manage
                        </Link>

                        {match.status ===
                        "scheduled" ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                beginEditing(match)
                              }
                              disabled={busy}
                              title="Edit fixture"
                              aria-label={`Edit fixture ${match.id}`}
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#355B85] bg-[#173451] text-[#A9D0FF] hover:bg-[#245078] disabled:opacity-40"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteMatch(
                                  match
                                )
                              }
                              disabled={busy}
                              title="Delete fixture"
                              aria-label={`Delete fixture ${match.id}`}
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#754052] bg-[#391F2C] text-[#F19AAC] hover:bg-[#592A3C] disabled:opacity-40"
                            >
                              {deletingId ===
                              match.id ? (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="col-span-2 flex items-center justify-center text-[10px] text-[#6F8BAA]">
                            Controls only
                          </span>
                        )}
                      </div>
                    </div>

                    {/* FOOTER */}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-[#203A58] pt-3 text-[10px] text-[#86A4C6]">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <MapPin
                          size={12}
                          className="shrink-0 text-[#72ADFA]"
                        />

                        <span className="truncate">
                          {match.venue ||
                            "Venue not specified"}
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-2">
                        <Clock3
                          size={12}
                          className="text-[#72ADFA]"
                        />
                        Kickoff{" "}
                        {formatMatchTime(
                          match.scheduled_at
                        )}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* DIRECTORY FOOTER */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#294360] bg-[#0C1D31] px-5 py-4 text-[10px] text-[#85A3C4] sm:px-6">
            <span>
              Displaying {displayedMatches.length} of{" "}
              {roundMatches.length} fixtures
            </span>

            <span>
              {availableTeams} unassigned team
              {availableTeams === 1 ? "" : "s"} in
              this round
            </span>
          </div>
        </section>

        {/* PAGE FOOTER */}

        <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-[#203A57] pt-6">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7796BA]">
            FOOTBALLCUP / MATCH OPERATIONS
          </span>

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[11px] font-bold text-[#8CBFFF] hover:text-white"
          >
            Back to Command Centre
            <ArrowRight size={13} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
