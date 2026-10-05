
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
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Clock3,
  Flag,
  GitBranch,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

/* =========================================
   CONFIGURATION
========================================= */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =========================================
   TYPES
========================================= */

interface TournamentEvent {
  id: number;
  name: string;
  status: "draft" | "active" | "completed";
}

interface TournamentRound {
  id: number;
  event: number;
  name: string;
  order_number: number;
   round_type: "group" | "knockout";
}

/* =========================================
   STYLES
========================================= */

const inputClass =
  "w-full rounded-lg border border-[#304A6B] bg-[#0A1729] px-4 py-3.5 text-[13px] text-white outline-none transition placeholder:text-[#58718F] focus:border-[#448AFF] focus:ring-2 focus:ring-[#448AFF]/10 disabled:cursor-not-allowed disabled:opacity-40";

const labelClass =
  "mb-2.5 block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#9AB0CD]";

/* =========================================
   HELPERS
========================================= */

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
      "CSRF cookie missing. Please refresh the page."
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

  let nextUrl: string | null = initialUrl;

  const visited = new Set<string>();

  while (nextUrl !== null) {
    const currentUrl: string = nextUrl;

    if (visited.has(currentUrl)) {
      throw new Error(
        "Invalid pagination: repeated API URL."
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
      throw new Error(
        `Unable to load records (HTTP ${response.status}).`
      );
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      items.push(...data);
      nextUrl = null;
    } else {
      items.push(...(data.results ?? []));

      nextUrl = data.next
        ? new URL(
            data.next,
            currentUrl
          ).toString()
        : null;
    }
  }

  return items;
}

function getStatusStyle(
  status: TournamentEvent["status"]
) {
  switch (status) {
    case "active":
      return "border-[#448AFF]/40 bg-[#2563EB]/15 text-[#91BFFF]";

    case "completed":
      return "border-[#D6A65D]/40 bg-[#D6A65D]/10 text-[#E7C48D]";

    default:
      return "border-[#546A86] bg-[#263A53] text-[#9CB0CA]";
  }
}

/* =========================================
   MAIN PAGE
========================================= */

export default function AdminRoundsPage() {
  const [events, setEvents] = useState<
    TournamentEvent[]
  >([]);

  const [rounds, setRounds] = useState<
    TournamentRound[]
  >([]);

  const [selectedEventId, setSelectedEventId] =
    useState("");

  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] =
    useState("");

  const [roundType, setRoundType] =
    useState<"group" | "knockout">("group");
  const [editingId, setEditingId] = useState<
    number | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [loadingRounds, setLoadingRounds] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<
    number | null
  >(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editorOpen, setEditorOpen] =
    useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  /* =========================================
     LOAD TOURNAMENTS
  ========================================= */

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

          return data.length > 0
            ? String(data[0].id)
            : "";
        });
      } catch (err) {
        if (signal?.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournaments."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  /* =========================================
     LOAD ROUNDS
  ========================================= */

  const loadRounds = useCallback(
    async (
      eventId: string,
      signal?: AbortSignal
    ) => {
      if (!eventId) {
        setRounds([]);
        return;
      }

      try {
        setLoadingRounds(true);
        setError("");

        const data =
          await fetchAllPages<TournamentRound>(
            `${API_BASE_URL}/admin/rounds/?event=${encodeURIComponent(
              eventId
            )}`,
            signal
          );

        if (signal?.aborted) return;

        setRounds(
          data
            .filter(
              (round) =>
                round.event === Number(eventId)
            )
            .sort(
              (a, b) =>
                a.order_number -
                  b.order_number ||
                a.id - b.id
            )
        );
      } catch (err) {
        if (signal?.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournament rounds."
        );
      } finally {
        if (!signal?.aborted) {
          setLoadingRounds(false);
        }
      }
    },
    []
  );

  /* =========================================
     INITIAL DATA
  ========================================= */

  useEffect(() => {
    const controller = new AbortController();

    void loadEvents(controller.signal);

    return () => controller.abort();
  }, [loadEvents]);

  /* =========================================
     TOURNAMENT CHANGE
  ========================================= */

  useEffect(() => {
    const controller = new AbortController();

    setRounds([]);

    setEditingId(null);
    setName("");
    setOrderNumber("");
    setRoundType("group");
    setEditorOpen(false);

    if (selectedEventId) {
      void loadRounds(
        selectedEventId,
        controller.signal
      );
    }

    return () => controller.abort();
  }, [selectedEventId, loadRounds]);

  /* =========================================
     DERIVED DATA
  ========================================= */

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

  const nextOrderNumber =
    sortedRounds.length > 0
      ? Math.max(
          ...sortedRounds.map(
            (round) => round.order_number
          )
        ) + 1
      : 1;

  const firstRound = sortedRounds[0];

  const lastRound =
    sortedRounds[sortedRounds.length - 1];

  const busy =
    saving || deletingId !== null;

  /* =========================================
     EDITOR HELPERS
  ========================================= */

  function resetForm() {
    setEditingId(null);
    setName("");
    setOrderNumber("");
    setRoundType("group");
  }

  function scrollToEditor() {
    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function openCreateEditor() {
    resetForm();

    setOrderNumber(
      String(nextOrderNumber)
    );

    setError("");
    setMessage("");
    setEditorOpen(true);

    scrollToEditor();
  }

  function beginEditing(
    round: TournamentRound
  ) {
    setEditingId(round.id);
    setName(round.name);

    setOrderNumber(
      String(round.order_number)
    );


     setRoundType(round.round_type);

    setError("");
    setMessage("");
    setEditorOpen(true);

    scrollToEditor();
  }

  function cancelEditing() {
    resetForm();
    setEditorOpen(false);
  }

  /* =========================================
     CREATE / UPDATE
  ========================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    const parsedOrder = Number(orderNumber);

    if (!selectedEventId) {
      setError("Please select a tournament.");
      return;
    }

    if (!name.trim()) {
      setError("Round name is required.");
      return;
    }

    if (
      !orderNumber.trim() ||
      !Number.isInteger(parsedOrder) ||
      parsedOrder < 1
    ) {
      setError(
        "Order number must be a positive whole number."
      );

      return;
    }

    const duplicateOrder = rounds.find(
      (round) =>
        round.order_number === parsedOrder &&
        round.id !== editingId
    );

    if (duplicateOrder) {
      setError(
        `Order ${parsedOrder} is already used by "${duplicateOrder.name}" in this tournament.`
      );

      return;
    }

    const isEditing = editingId !== null;
    const eventId = selectedEventId;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const url = isEditing
        ? `${API_BASE_URL}/admin/rounds/${editingId}/`
        : `${API_BASE_URL}/admin/rounds/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          event: Number(eventId),
          name: name.trim(),
          order_number: parsedOrder,
           round_type: roundType,
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
              ? "Unable to update round."
              : "Unable to create round."
          )
        );
      }

      resetForm();
      setEditorOpen(false);

      await loadRounds(eventId);

      setMessage(
        isEditing
          ? "Competition stage updated successfully."
          : "New competition stage created successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save round."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================
     DELETE ROUND
  ========================================= */

  async function handleDeleteRound(
    round: TournamentRound
  ) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${round.name}" (Round ${round.order_number})?\n\nMatches belonging to this round may also be deleted or affected. This action cannot be undone.`
    );

    if (!confirmed) return;

    const eventId = selectedEventId;

    setDeletingId(round.id);
    setError("");
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/rounds/${round.id}/`,
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
            "Unable to delete round."
          )
        );
      }

      if (editingId === round.id) {
        resetForm();
        setEditorOpen(false);
      }

      await loadRounds(eventId);

      setMessage(
        `"${round.name}" has been removed successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete round."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="min-h-full bg-[#080F1C] font-body text-[#F4F7FC]">
      <div className="mx-auto max-w-[1600px] px-5 pb-14 pt-8 md:px-8 xl:px-10">

        {/* =====================================
            BREADCRUMB
        ===================================== */}

        <nav className="mb-7 flex items-center gap-2 text-[11px]">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[#7D96B6] transition hover:text-white"
          >
            <ArrowLeft size={13} />

            Command Centre
          </Link>

          <ChevronRight
            size={13}
            className="text-[#4D6686]"
          />

          <span className="font-semibold text-[#9FC5FF]">
            Stage Architect
          </span>
        </nav>

        {/* =====================================
            PAGE HEADING
        ===================================== */}

        <header className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#448AFF]" />

              <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#70A9FF]">
                Competition Administration / 005
              </p>
            </div>

            <h1 className="font-heading text-[clamp(30px,4vw,46px)] font-extrabold leading-tight tracking-[-0.065em] text-white">
              Stage Architect
              <span className="text-[#448AFF]">.</span>
            </h1>

            <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#8399B5]">
              Design the structure of your tournament.
              Create rounds, define their sequence and
              build a clear path through the competition.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateEditor}
            disabled={
              !selectedEventId ||
              loading ||
              loadingRounds ||
              busy
            }
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#3478F6] px-5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_8px_25px_rgba(37,99,235,.22)] transition hover:bg-[#5593FF] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CirclePlus size={17} />

            Create New Stage
          </button>
        </header>

        {/* =====================================
            HERO / TOURNAMENT SELECTOR
        ===================================== */}

        <section className="relative isolate mb-6 overflow-hidden rounded-xl border border-[#31517B] bg-[#10223D]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1500&q=85')",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0C1B30_0%,rgba(12,27,48,.95)_50%,rgba(12,27,48,.6)_100%)]" />

          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#448AFF] via-[#70A9FF]/30 to-transparent" />

          <div className="relative grid gap-7 px-6 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-10 lg:py-10">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#5B8FD1]/40 bg-[#2563EB]/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#A3C8FF]">
                <GitBranch size={13} />

                Tournament Structure
              </div>

              <h2 className="font-heading max-w-xl text-[clamp(27px,3vw,41px)] font-extrabold leading-[1.1] tracking-[-0.06em] text-white">
                Build the road
                <br />

                to the{" "}

                <span className="text-[#83B5FF]">
                  final whistle.
                </span>
              </h2>

              <p className="mt-4 max-w-lg text-[12px] leading-6 text-[#A6BDD8]">
                Every tournament needs a progression.
                Select your competition to manage its
                individual stages and round ordering.
              </p>

              {selectedEvent && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${getStatusStyle(
                      selectedEvent.status
                    )}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />

                    {selectedEvent.status}
                  </span>

                  <span className="font-mono text-[10px] text-[#87A5C8]">
                    EVENT #{selectedEvent.id}
                  </span>
                </div>
              )}
            </div>

            {/* Selector panel */}

            <div className="rounded-xl border border-[#46658A]/50 bg-[#0A1729]/85 p-5 shadow-[0_12px_40px_rgba(0,0,0,.15)] backdrop-blur-md">
              <label
                htmlFor="event-select"
                className={labelClass}
              >
                Active Workspace
              </label>

              <div className="relative">
                <Trophy
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#84B6FF]"
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
                  disabled={
                    loading ||
                    saving ||
                    deletingId !== null
                  }
                  className={`${inputClass} appearance-none pl-11 pr-10 font-semibold`}
                >
                  <option value="">
                    Select a tournament
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
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#84A0C1]"
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#29405D] pt-4">
                <span className="text-[10px] text-[#829BB9]">
                  Available tournaments
                </span>

                <span className="font-mono text-[12px] font-bold text-[#B9D5FA]">
                  {loading ? "—" : events.length}
                </span>
              </div>

              {loading && (
                <p className="mt-3 flex items-center gap-2 text-[10px] text-[#8CA9CC]">
                  <LoaderCircle
                    size={12}
                    className="animate-spin"
                  />

                  Loading tournaments...
                </p>
              )}

              {!loading && events.length === 0 && (
                <Link
                  href="/admin/events"
                  className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#91BEFF] hover:text-white"
                >
                  Create a Tournament

                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* =====================================
            FEEDBACK
        ===================================== */}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-[#B45368]/40 bg-[#4B2331]/40 px-5 py-4 text-[#FFAFBE]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <p className="text-[12px] leading-6">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-[#448AFF]/35 bg-[#183452] px-5 py-4 text-[#B1D2FF]"
          >
            <div className="flex items-start gap-3">
              <Check
                size={17}
                className="mt-0.5 shrink-0"
              />

              <p className="text-[12px] leading-6">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* =====================================
            COMPETITION SUMMARY
        ===================================== */}

        <section className="mb-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Total Stages",
              value: loadingRounds
                ? "—"
                : sortedRounds.length,
              icon: Layers3,
              suffix: "DEFINED",
            },
            {
              label: "Next Stage Order",
              value: loadingRounds
                ? "—"
                : nextOrderNumber,
              icon: ArrowRight,
              suffix: "SEQUENCE",
            },
            {
              label: "Opening Order",
              value: firstRound
                ? String(firstRound.order_number).padStart(
                    2,
                    "0"
                  )
                : "—",
              icon: Flag,
              suffix: "START",
            },
            {
              label: "Final Order",
              value: lastRound
                ? String(lastRound.order_number).padStart(
                    2,
                    "0"
                  )
                : "—",
              icon: Trophy,
              suffix: "LAST",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-xl border border-[#293E58] bg-[#101D30] px-5 py-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8199B8]">
                    {stat.label}
                  </p>

                  <Icon
                    size={17}
                    className="shrink-0 text-[#6DA5F5]"
                  />
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-heading text-[32px] font-extrabold leading-none tracking-[-0.06em] text-white">
                    {stat.value}
                  </span>

                  <span className="font-mono text-[9px] tracking-wider text-[#6582A6]">
                    {stat.suffix}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* =====================================
            EDITOR
        ===================================== */}

        {editorOpen && (
          <section
            ref={editorRef}
            className="mb-9 scroll-mt-24 overflow-hidden rounded-xl border border-[#3A6090] bg-[#101E32] shadow-[0_15px_50px_rgba(0,0,0,.2)]"
          >
            {/* Editor header */}

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2B4462] bg-[#142841] px-6 py-5">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#79AFFF]">
                  {editingId !== null
                    ? "Stage Architect / Edit"
                    : "Stage Architect / New Entry"}
                </p>

                <h2 className="font-heading text-xl font-extrabold tracking-[-0.04em] text-white">
                  {editingId !== null
                    ? "Update Competition Stage"
                    : "Create Competition Stage"}
                </h2>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                aria-label="Close editor"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#385575] text-[#9BB3D0] transition hover:bg-[#233D5B] hover:text-white disabled:opacity-40"
              >
                <X size={17} />
              </button>
            </div>

            {/* Editor content */}

            <div className="grid lg:grid-cols-[minmax(0,1fr)_250px]">
              <form
                onSubmit={handleSubmit}
                className="grid content-start gap-5 p-6 sm:grid-cols-[minmax(0,1fr)_150px] sm:p-7"
              >
                <div className="sm:col-span-2">
                  <p className="text-[11px] leading-5 text-[#879FBD]">
                    Configure a stage for{" "}

                    <span className="font-bold text-[#C4D9F5]">
                      {selectedEvent?.name ||
                        "the selected tournament"}
                    </span>
                    . Each stage must have a unique
                    positive order number.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="round-name"
                    className={labelClass}
                  >
                    Stage Name
                  </label>

                  <input
                    id="round-name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="e.g. Group Stage - Round 1"
                    disabled={
                      !selectedEventId || saving
                    }
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="round-order"
                    className={labelClass}
                  >
                    Sequence
                  </label>

                  <input
                    id="round-order"
                    type="number"
                    min="1"
                    step="1"
                    value={orderNumber}
                    onChange={(event) =>
                      setOrderNumber(
                        event.target.value
                      )
                    }
                    placeholder="01"
                    disabled={
                      !selectedEventId || saving
                    }
                    className={`${inputClass} font-mono font-bold`}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
  <label
    htmlFor="round-type"
    className={labelClass}
  >
    Stage Type
  </label>

  <div className="relative">
    <select
      id="round-type"
      value={roundType}
      onChange={(event) =>
        setRoundType(
          event.target.value as
            | "group"
            | "knockout"
        )
      }
      disabled={
        !selectedEventId || saving
      }
      className={`${inputClass} appearance-none pr-10`}
    >
      <option value="group">
        Group / League
      </option>

      <option value="knockout">
        Knockout
      </option>
    </select>
<p className="mt-2 text-xs text-white">
  DEBUG roundType: {roundType}
</p>
    <ChevronDown
      size={15}
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#84A0C1]"
    />
  </div>

  <p className="mt-2 text-[10px] leading-5 text-[#718CAC]">
    {roundType === "knockout"
      ? "A winner is required. Drawn matches can proceed to extra time and penalties."
      : "Standard group or league stage. Matches may finish as a draw."}
  </p>
</div>

                <div className="flex flex-wrap gap-3 border-t border-[#293E58] pt-5 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={
                      !selectedEventId ||
                      loadingRounds ||
                      busy
                    }
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3478F6] px-5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#5593FF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : editingId !== null ? (
                      <Save size={16} />
                    ) : (
                      <Plus size={16} />
                    )}

                    {saving
                      ? "Saving Stage..."
                      : editingId !== null
                        ? "Save Stage Changes"
                        : "Create Stage"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#35516F] px-5 text-[11px] font-bold text-[#A0B7D2] transition hover:bg-[#1A304B] hover:text-white disabled:opacity-40"
                  >
                    <RotateCcw size={14} />

                    Cancel
                  </button>
                </div>
              </form>

              {/* Live stage preview */}

              <aside className="flex flex-col items-center justify-center border-t border-[#2B4462] bg-[radial-gradient(circle_at_50%_30%,#1C395C_0%,#0C1829_75%)] px-6 py-9 text-center lg:border-l lg:border-t-0">
                <p className="mb-7 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#84A6D1]">
                  Stage Preview
                </p>

                <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-[#4D77A8] bg-[#1A3556] shadow-[0_12px_35px_rgba(0,0,0,.25)]">
                  <span className="font-heading text-5xl font-extrabold tracking-[-0.08em] text-[#9BC6FF]">
                    {orderNumber
                      ? String(
                          Number(orderNumber) || 0
                        ).padStart(2, "0")
                      : "01"}
                  </span>

                  <div className="absolute -bottom-2 rounded-md border border-[#4776AD] bg-[#15365C] px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#A6CBFF]">
                    Sequence
                  </div>
                </div>

                <h3 className="font-heading mt-7 max-w-full break-words text-lg font-extrabold tracking-[-0.04em] text-white">
                  {name.trim() || "Stage Name"}
                </h3>

                <p className="mt-2 text-[10px] text-[#7592B4]">
                  Competition progression
                </p>
              </aside>
            </div>
          </section>
        )}

        {/* =====================================
            STAGE TIMELINE
        ===================================== */}

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#448AFF]" />

                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#70A9FF]">
                  Competition Blueprint
                </span>
              </div>

              <h2 className="font-heading text-[26px] font-extrabold tracking-[-0.055em] text-white">
                The Stage Timeline
                <span className="ml-2 text-[#448AFF]">
                  / {sortedRounds.length}
                </span>
              </h2>

              <p className="mt-2 text-[12px] text-[#8198B5]">
                {selectedEvent
                  ? selectedEvent.name
                  : "Select a tournament to view its stages."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedEventId) {
                  void loadRounds(selectedEventId);
                }
              }}
              disabled={
                !selectedEventId ||
                loadingRounds ||
                busy
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#2E4867] bg-[#101D30] px-4 text-[11px] font-bold text-[#A5BDD9] transition hover:border-[#448AFF] hover:text-white disabled:opacity-40"
            >
              <RefreshCw
                size={14}
                className={
                  loadingRounds
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh Stages
            </button>
          </div>

          {/* Timeline content */}

          <div className="overflow-hidden rounded-xl border border-[#293E58] bg-[#0E1A2C]">

            {/* Timeline header */}

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#293E58] bg-[#12223A] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2">
                <GitBranch
                  size={15}
                  className="text-[#85B8FF]"
                />

                <span className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#A3BCDA]">
                  Competition Sequence
                </span>
              </div>

              <span className="font-mono text-[10px] text-[#718CAC]">
                {String(
                  sortedRounds.length
                ).padStart(2, "0")}{" "}
                STAGES
              </span>
            </div>

            {/* Loading */}

            {loadingRounds ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center">
                <LoaderCircle
                  size={30}
                  className="animate-spin text-[#70A9FF]"
                />

                <p className="mt-5 text-[12px] text-[#93A9C6]">
                  Loading competition structure...
                </p>
              </div>
            ) : !selectedEventId ? (

              /* No tournament */

              <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <Trophy
                  size={32}
                  className="text-[#769CCB]"
                />

                <h3 className="font-heading mt-5 text-lg font-bold">
                  Select a tournament
                </h3>

                <p className="mt-2 max-w-sm text-[12px] leading-6 text-[#839AB8]">
                  Choose a competition from the selector
                  above to view and manage its stages.
                </p>
              </div>
            ) : sortedRounds.length === 0 ? (

              /* Empty stages */

              <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#365779] bg-[#19324F]">
                  <Layers3
                    size={28}
                    className="text-[#89B9FF]"
                  />
                </div>

                <h3 className="font-heading mt-5 text-xl font-extrabold tracking-[-0.04em]">
                  Your blueprint starts here.
                </h3>

                <p className="mt-3 max-w-sm text-[12px] leading-6 text-[#849BB8]">
                  No stages have been created for this
                  competition. Define the opening round
                  to begin its progression.
                </p>

                <button
                  type="button"
                  onClick={openCreateEditor}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#3478F6] px-5 py-3 text-[11px] font-bold text-white transition hover:bg-[#5593FF]"
                >
                  <CirclePlus size={15} />

                  Create First Stage
                </button>
              </div>
            ) : (

              /* =================================
                  CONNECTED STAGE TIMELINE
              ================================= */

              <div className="px-4 py-7 sm:px-7 sm:py-9">
                {sortedRounds.map(
                  (round, index) => {
                    const isFirst = index === 0;

                    const isLast =
                      index ===
                      sortedRounds.length - 1;

                    const isEditing =
                      editingId === round.id;

                    return (
                      <article
                        key={round.id}
                        className="relative flex gap-4 sm:gap-6"
                      >
                        {/* Progression rail */}

                        <div className="relative flex w-[54px] shrink-0 flex-col items-center sm:w-[76px]">
                          <div
                            className={`relative z-10 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl border font-heading text-xl font-extrabold tracking-[-0.06em] shadow-[0_8px_20px_rgba(0,0,0,.18)] sm:h-[64px] sm:w-[64px] sm:text-2xl ${
                              isEditing
                                ? "border-[#78ADFF] bg-[#2563EB] text-white"
                                : isLast
                                  ? "border-[#D6A65D]/60 bg-[#4B3A24] text-[#F0CD92]"
                                  : "border-[#466B9B] bg-[#193451] text-[#A0C9FF]"
                            }`}
                          >
                            {String(
                              round.order_number
                            ).padStart(2, "0")}
                          </div>

                          {!isLast && (
                            <div className="my-2 min-h-[45px] w-px flex-1 bg-gradient-to-b from-[#4B78AD] to-[#29415E]" />
                          )}
                        </div>

                        {/* Stage panel */}

                        <div
                          className={`mb-5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border transition-all sm:mb-6 sm:flex-row sm:items-center ${
                            isEditing
                              ? "border-[#448AFF] bg-[#1A3150]"
                              : "border-[#2C4360] bg-[#14243A] hover:border-[#466C9B] hover:bg-[#182B44]"
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-4 px-5 py-5 sm:items-center sm:px-6">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#80A6D6]">
                                  {isFirst
                                    ? "Opening Stage"
                                    : isLast
                                      ? "Last Defined Stage"
                                      : `Stage ${String(
                                          index + 1
                                        ).padStart(2, "0")}`}
                                </span>

                                {isEditing && (
                                  <span className="rounded bg-[#2563EB] px-2 py-0.5 text-[9px] font-bold text-white">
                                    EDITING
                                  </span>
                                )}
                                <span
                                  className={`rounded border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${round.round_type === "knockout"
                                      ? "border-[#D6A65D]/50 bg-[#D6A65D]/10 text-[#F0CD92]"
                                      : "border-[#448AFF]/40 bg-[#2563EB]/10 text-[#91BFFF]"
                                    }`}
                                >
                                  {round.round_type === "knockout"
                                    ? "Knockout"
                                    : "Group / League"}
                                </span>
                              </div>

                              <h3 className="font-heading break-words text-[17px] font-extrabold tracking-[-0.035em] text-white sm:text-[19px]">
                                {round.name}
                              </h3>

                              <p className="mt-2 font-mono text-[10px] text-[#7793B5]">
                                ORDER{" "}
                                {String(
                                  round.order_number
                                ).padStart(2, "0")}{" "}
                                / RECORD #{round.id}
                              </p>
                            </div>

                            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#385473] bg-[#1B3351] text-[#80B3F6] lg:flex">
                              {isLast ? (
                                <Flag size={18} />
                              ) : (
                                <ArrowRight size={18} />
                              )}
                            </div>
                          </div>

                          {/* Fixed actions */}

                          <div className="flex shrink-0 items-center gap-2 border-t border-[#2D4563] px-5 py-4 sm:border-l sm:border-t-0 sm:px-4">
                            <button
                              type="button"
                              onClick={() =>
                                beginEditing(round)
                              }
                              disabled={busy}
                              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[#416A9A] bg-[#1B385A] px-4 text-[11px] font-bold text-[#A9CEFF] transition hover:bg-[#28507C] disabled:opacity-40 sm:flex-none"
                            >
                              <Pencil size={13} />

                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteRound(
                                  round
                                )
                              }
                              disabled={busy}
                              aria-label={`Delete ${round.name}`}
                              title={`Delete ${round.name}`}
                              className="flex h-9 w-10 items-center justify-center rounded-lg border border-[#674253] bg-[#432533]/50 text-[#E9A3AF] transition hover:border-[#C96C81] hover:bg-[#5A2B3D] disabled:opacity-40"
                            >
                              {deletingId ===
                              round.id ? (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}

                {/* Timeline end marker */}

                <div className="ml-[11px] flex items-center gap-4 pt-1 sm:ml-[21px]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D6A65D]/50 bg-[#D6A65D]/10">
                    <Flag
                      size={14}
                      className="text-[#E7C48D]"
                    />
                  </div>

                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#B69A72]">
                    End of Defined Sequence
                  </span>
                </div>

                {/* Add next stage */}

                <button
                  type="button"
                  onClick={openCreateEditor}
                  disabled={busy}
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#41658D] bg-[#142A45]/40 px-5 py-4 text-[11px] font-bold text-[#91BBEF] transition hover:border-[#70A9FF] hover:bg-[#1A3556] hover:text-white disabled:opacity-40"
                >
                  <Plus size={16} />

                  Add Another Stage

                  <ArrowUpRight size={13} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* =====================================
            FOOTER
        ===================================== */}

        <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-[#273B54] pt-6 text-[10px] text-[#6882A1] sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <GitBranch
              size={13}
              className="text-[#70A9FF]"
            />

            <span className="font-bold uppercase tracking-[0.12em]">
              FOOTBALLCUP / STAGE ARCHITECT
            </span>
          </div>

          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-2 font-bold text-[#8DBBFF] transition hover:text-white"
          >
            Continue to Match Scheduling

            <ArrowRight size={13} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
