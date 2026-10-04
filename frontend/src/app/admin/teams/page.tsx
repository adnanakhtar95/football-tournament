
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CirclePlus,
  ImageIcon,
  LayoutGrid,
  LoaderCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import Link from "next/link";

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

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

interface TeamForm {
  name: string;
  code: string;
  logo: string;
}

type MessageType = "success" | "error";

const EMPTY_FORM: TeamForm = {
  name: "",
  code: "",
  logo: "",
};

const inputClass =
  "w-full rounded-lg border border-[#2B405C] bg-[#0B1729] px-4 py-3.5 text-[13px] text-white outline-none transition placeholder:text-[#526A88] focus:border-[#448AFF] focus:ring-2 focus:ring-[#448AFF]/10";

const labelClass =
  "mb-2.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#93A9C6]";

/* =========================================
   API HELPERS
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
      "CSRF cookie missing. Please refresh and try again."
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

/* =========================================
   LOGO RESOLVER
========================================= */

function resolveLogo(
  logo: string | null | undefined
): string | null {
  if (!logo?.trim()) return null;

  const value = logo.trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("//")) {
    return `http:${value}`;
  }

  const backendOrigin = API_BASE_URL.replace(
    /\/api\/?$/,
    ""
  );

  return `${backendOrigin}/${value.replace(/^\/+/, "")}`;
}

/* =========================================
   TEAM CREST
========================================= */

function TeamCrest({
  name,
  code,
  logo,
  size = "normal",
}: {
  name: string;
  code: string;
  logo: string | null;
  size?: "normal" | "large";
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = resolveLogo(logo);

  const dimensions =
    size === "large"
      ? "h-24 w-24 sm:h-28 sm:w-28"
      : "h-[76px] w-[76px]";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#385579] bg-[radial-gradient(circle_at_30%_20%,#25466D_0%,#102039_70%)] p-3 shadow-[0_12px_35px_rgba(0,0,0,.25)] ${dimensions}`}
    >
      {imageUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={imageUrl}
          src={imageUrl}
          alt={`${name} crest`}
          className="h-full w-full object-contain drop-shadow-lg"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={`font-heading font-black tracking-[-0.08em] text-[#82B6FF] ${
            size === "large"
              ? "text-3xl"
              : "text-2xl"
          }`}
        >
          {code.trim().slice(0, 3) || "FC"}
        </span>
      )}
    </div>
  );
}

/* =========================================
   TEAM CARD
========================================= */

function TeamCard({
  team,
  index,
  editing,
  busy,
  deleting,
  onEdit,
  onDelete,
}: {
  team: Team;
  index: number;
  editing: boolean;
  busy: boolean;
  deleting: boolean;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
}) {
  return (
    <article
      className={`group relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border bg-[#101D30] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,.25)] ${
        editing
          ? "border-[#448AFF] ring-1 ring-[#448AFF]/30"
          : "border-[#2A405D] hover:border-[#4774AB]"
      }`}
    >
      {/* Decorative card top */}

      <div className="relative h-[105px] shrink-0 overflow-hidden border-b border-[#2A405D] bg-[radial-gradient(ellipse_at_75%_20%,#24446A_0%,#14263F_45%,#0D192A_100%)]">
        <div className="pointer-events-none absolute -right-8 -top-14 h-44 w-44 rounded-full border border-white/[0.055]" />

        <div className="pointer-events-none absolute -right-2 -top-9 h-32 w-32 rounded-full border border-white/[0.055]" />

        <div className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-20 bg-[#448AFF]" />

        <div className="absolute left-5 top-5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#70A9FF]" />

          <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#9CB9DC]">
            Registered Club
          </span>
        </div>

        <span className="absolute right-5 top-5 font-mono text-[10px] text-[#7993B3]">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="absolute -bottom-9 left-5 z-10">
          <TeamCrest
            key={`${team.id}-${team.logo}`}
            name={team.name}
            code={team.code}
            logo={team.logo}
          />
        </div>
      </div>

      {/* Main content */}

      <div className="flex flex-1 flex-col px-5 pb-5 pt-12">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex max-w-full items-center rounded-md border border-[#38629A] bg-[#1B3657] px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.15em] text-[#9CC5FF]">
            {team.code}
          </span>

          <span className="font-mono text-[10px] text-[#627D9F]">
            ID #{team.id}
          </span>
        </div>

        <h3
          title={team.name}
          className="font-heading min-h-[48px] overflow-hidden text-[19px] font-extrabold leading-6 tracking-[-0.045em] text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
        >
          {team.name}
        </h3>

        <div className="mt-3 flex items-center gap-2">
          {team.logo ? (
            <>
              <ShieldCheck
                size={13}
                className="text-[#81B6FF]"
              />

              <span className="text-[11px] text-[#819AB9]">
                Custom crest configured
              </span>
            </>
          ) : (
            <>
              <ImageIcon
                size={13}
                className="text-[#819AB9]"
              />

              <span className="text-[11px] text-[#819AB9]">
                Initials-based crest
              </span>
            </>
          )}
        </div>

        {/* Fixed bottom actions */}

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 border-t border-[#293D56] pt-5">
          <button
            type="button"
            onClick={() => onEdit(team)}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#3C6392] bg-[#1A3556] text-[11px] font-bold text-[#A6CAFF] transition hover:border-[#609BEE] hover:bg-[#24466D] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil size={13} />

            {editing ? "Editing Club" : "Edit Club"}
          </button>

          <button
            type="button"
            aria-label={`Delete ${team.name}`}
            title={`Delete ${team.name}`}
            onClick={() => onDelete(team)}
            disabled={busy}
            className="flex h-10 w-11 items-center justify-center rounded-lg border border-[#63404F] bg-[#3A202D]/40 text-[#E59DA5] transition hover:border-[#D86B80] hover:bg-[#5A2739] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/* =========================================
   MAIN PAGE
========================================= */

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);

  const [form, setForm] = useState<TeamForm>({
    ...EMPTY_FORM,
  });

  const [editingId, setEditingId] = useState<
    number | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<
    number | null
  >(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<MessageType>("success");

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  /* =========================================
     LOAD TEAMS
  ========================================= */

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);

      const allTeams: Team[] = [];

      let nextUrl: string | null =
        `${API_BASE_URL}/admin/teams/`;

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
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load teams (HTTP ${response.status}).`
          );
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          allTeams.push(...data);
          nextUrl = null;
        } else {
          allTeams.push(...(data.results ?? []));

          nextUrl = data.next
            ? new URL(
                data.next,
                currentUrl
              ).toString()
            : null;
        }
      }

      setTeams(allTeams);
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  /* =========================================
     NOTIFICATIONS
  ========================================= */

  function showMessage(
    text: string,
    type: MessageType = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  /* =========================================
     FORM HELPERS
  ========================================= */

  function resetForm() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
    });
  }

  function openCreateForm() {
    resetForm();
    setMessage("");
    setFormOpen(true);

    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function beginEditing(team: Team) {
    setEditingId(team.id);

    setForm({
      name: team.name,
      code: team.code,
      logo: team.logo ?? "",
    });

    setMessage("");
    setFormOpen(true);

    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function cancelEditing() {
    resetForm();
    setFormOpen(false);
  }

  /* =========================================
     CREATE / UPDATE
  ========================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();

    const code = form.code
      .trim()
      .toUpperCase();

    const logo = form.logo.trim();

    if (!name || !code) {
      showMessage(
        "Team name and short code are required.",
        "error"
      );

      return;
    }

    const isEditing = editingId !== null;

    setSaving(true);
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const url = isEditing
        ? `${API_BASE_URL}/admin/teams/${editingId}/`
        : `${API_BASE_URL}/admin/teams/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          name,
          code,
          logo: logo || null,
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
              ? "Unable to update team."
              : "Unable to create team."
          )
        );
      }

      resetForm();
      setFormOpen(false);

      await loadTeams();

      showMessage(
        isEditing
          ? "Club information updated successfully."
          : "New club registered successfully."
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to save team.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================
     DELETE
  ========================================= */

  async function deleteTeam(team: Team) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${team.name}"?\n\nThis may affect tournament registrations and associated matches. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(team.id);
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/teams/${team.id}/`,
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
            "Unable to delete team."
          )
        );
      }

      if (editingId === team.id) {
        resetForm();
        setFormOpen(false);
      }

      await loadTeams();

      showMessage(
        `"${team.name}" has been deleted successfully.`
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete team.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* =========================================
     DERIVED DATA
  ========================================= */

  const teamsWithLogos = useMemo(
    () =>
      teams.filter((team) =>
        Boolean(team.logo?.trim())
      ).length,
    [teams]
  );

  const filteredTeams = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return [...teams]
      .filter((team) => {
        if (!query) return true;

        return (
          team.name.toLowerCase().includes(query) ||
          team.code.toLowerCase().includes(query) ||
          String(team.id).includes(query)
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [teams, search]);

  const logoCoverage =
    teams.length > 0
      ? Math.round(
          (teamsWithLogos / teams.length) * 100
        )
      : 0;

  const busy = saving || deletingId !== null;

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
            Club Registry
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
                Competition Administration / 002
              </p>
            </div>

            <h1 className="font-heading text-[clamp(30px,4vw,46px)] font-extrabold leading-tight tracking-[-0.065em] text-white">
              Club Registry
              <span className="text-[#448AFF]">.</span>
            </h1>

            <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#8399B5]">
              Build your competition roster. Register clubs,
              manage identities and keep every team organized
              in one workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#3478F6] px-5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_8px_25px_rgba(37,99,235,.22)] transition hover:bg-[#5593FF]"
          >
            <CirclePlus size={17} />

            Register New Club
          </button>
        </header>

        {/* =====================================
            FEATURED REGISTRY BANNER
        ===================================== */}

        <section className="relative isolate mb-6 min-h-[175px] overflow-hidden rounded-xl border border-[#31517B] bg-[#10223D]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=85')",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0D1B30_0%,rgba(13,27,48,.95)_40%,rgba(13,27,48,.4)_100%)]" />

          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#448AFF] via-[#448AFF]/30 to-transparent" />

          <div className="relative flex min-h-[175px] flex-col justify-center px-6 py-7 sm:px-8">
            <div className="mb-3 flex items-center gap-2 text-[#89B9FF]">
              <Shield size={14} />

              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
                The Club Collection
              </span>
            </div>

            <h2 className="font-heading text-2xl font-extrabold tracking-[-0.05em] text-white sm:text-3xl">
              Every club has an identity.
            </h2>

            <p className="mt-2 max-w-md text-[12px] leading-6 text-[#A7BDD7]">
              From the first registration to the final
              whistle, manage the teams that define your
              tournament.
            </p>
          </div>

          <Shield
            size={140}
            strokeWidth={0.5}
            className="pointer-events-none absolute -bottom-10 right-12 hidden rotate-[-15deg] text-[#7AABED]/10 lg:block"
          />
        </section>

        {/* =====================================
            REGISTRY STATISTICS
        ===================================== */}

        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Registered Clubs",
              value: teams.length,
              icon: Shield,
              suffix: "TOTAL",
            },
            {
              label: "Custom Crests",
              value: teamsWithLogos,
              icon: ImageIcon,
              suffix: "UPLOADED",
            },
            {
              label: "Crest Coverage",
              value: `${logoCoverage}%`,
              icon: ShieldCheck,
              suffix: "IDENTITY",
            },
            {
              label: "Registry Results",
              value: filteredTeams.length,
              icon: Users,
              suffix: "VISIBLE",
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
            NOTIFICATIONS
        ===================================== */}

        {message && (
          <div
            role="alert"
            className={`mb-7 flex items-start justify-between gap-4 rounded-lg border px-5 py-4 ${
              messageType === "error"
                ? "border-[#B45368]/40 bg-[#4B2331]/40 text-[#FFAFBE]"
                : "border-[#448AFF]/35 bg-[#183452] text-[#B1D2FF]"
            }`}
          >
            <div className="flex items-start gap-3">
              {messageType === "error" ? (
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <Check
                  size={17}
                  className="mt-0.5 shrink-0"
                />
              )}

              <p className="text-[12px] leading-6">
                {message}
              </p>
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setMessage("")}
              className="shrink-0 opacity-70 transition hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* =====================================
            CREATE / EDIT WORKSPACE
        ===================================== */}

        {formOpen && (
          <section
            ref={formRef}
            className="mb-9 scroll-mt-24 overflow-hidden rounded-xl border border-[#3A6090] bg-[#101E32] shadow-[0_15px_50px_rgba(0,0,0,.2)]"
          >
            {/* Editor header */}

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2B4462] bg-[#142841] px-6 py-5">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#79AFFF]">
                  {editingId !== null
                    ? "Registry / Edit Identity"
                    : "Registry / New Entry"}
                </p>

                <h2 className="font-heading text-xl font-extrabold tracking-[-0.04em] text-white">
                  {editingId !== null
                    ? "Update Club Identity"
                    : "Register a New Club"}
                </h2>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#385575] text-[#9BB3D0] transition hover:bg-[#233D5B] hover:text-white disabled:opacity-40"
                aria-label="Close editor"
              >
                <X size={17} />
              </button>
            </div>

            {/* Editor body */}

            <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
              <form
                onSubmit={handleSubmit}
                className="grid content-start gap-5 p-6 sm:grid-cols-2 sm:p-7"
              >
                <div className="sm:col-span-2">
                  <p className="text-[11px] leading-5 text-[#879FBD]">
                    Provide the club identity details below.
                    Team name and short code are required.
                  </p>
                </div>

                {/* Name */}

                <div>
                  <label
                    htmlFor="team-name"
                    className={labelClass}
                  >
                    Official Club Name
                  </label>

                  <input
                    id="team-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Islamabad United"
                    className={inputClass}
                  />
                </div>

                {/* Code */}

                <div>
                  <label
                    htmlFor="team-code"
                    className={labelClass}
                  >
                    Club Short Code
                  </label>

                  <input
                    id="team-code"
                    type="text"
                    required
                    maxLength={10}
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. ISL"
                    className={`${inputClass} font-mono font-bold tracking-[0.12em] uppercase`}
                  />
                </div>

                {/* Logo */}

                <div className="sm:col-span-2">
                  <label
                    htmlFor="team-logo"
                    className={labelClass}
                  >
                    Club Crest URL

                    <span className="ml-2 font-normal normal-case tracking-normal text-[#657F9E]">
                      Optional
                    </span>
                  </label>

                  <div className="relative">
                    <ImageIcon
                      size={16}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6582A5]"
                    />

                    <input
                      id="team-logo"
                      type="url"
                      value={form.logo}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          logo: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/club-logo.png"
                      className={`${inputClass} pl-11`}
                    />
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-[#6F89A9]">
                    Leave blank to automatically display
                    the club short code as its crest.
                  </p>
                </div>

                {/* Actions */}

                <div className="flex flex-wrap gap-3 border-t border-[#293E58] pt-5 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3478F6] px-5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#5593FF] disabled:cursor-not-allowed disabled:opacity-50"
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
                      ? "Saving Club..."
                      : editingId !== null
                        ? "Save Club Changes"
                        : "Register Club"}
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

              {/* Live identity preview */}

              <aside className="flex flex-col items-center justify-center border-t border-[#2B4462] bg-[radial-gradient(circle_at_50%_30%,#1C395C_0%,#0C1829_75%)] px-6 py-9 text-center lg:border-l lg:border-t-0">
                <p className="mb-7 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#84A6D1]">
                  Identity Preview
                </p>

                <TeamCrest
                  key={form.logo}
                  name={form.name || "New Club"}
                  code={form.code || "FC"}
                  logo={form.logo || null}
                  size="large"
                />

                <h3 className="font-heading mt-6 max-w-full break-words text-xl font-extrabold tracking-[-0.05em] text-white">
                  {form.name.trim() || "Club Name"}
                </h3>

                <span className="mt-3 rounded-md border border-[#3D6596] bg-[#1B3657] px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.16em] text-[#9CC5FF]">
                  {form.code.trim() || "CODE"}
                </span>

                <p className="mt-5 text-[10px] text-[#6F8BAB]">
                  Live registry preview
                </p>
              </aside>
            </div>
          </section>
        )}

        {/* =====================================
            CLUB DIRECTORY
        ===================================== */}

        <section>
          <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#70A9FF]">
                <LayoutGrid size={13} />

                Registry Directory
              </p>

              <h2 className="font-heading text-[26px] font-extrabold tracking-[-0.055em] text-white">
                Registered Clubs
                <span className="ml-2 text-[#448AFF]">
                  / {teams.length}
                </span>
              </h2>

              <p className="mt-2 text-[12px] text-[#8198B5]">
                Manage your participating football
                clubs and their identities.
              </p>
            </div>

            <div className="flex w-full flex-wrap gap-2 lg:w-auto">
              {/* Search */}

              <div className="relative min-w-[200px] flex-1 lg:w-[260px] lg:flex-none">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E8BAD]"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search clubs..."
                  aria-label="Search clubs"
                  className="h-11 w-full rounded-lg border border-[#2B405C] bg-[#101D30] pl-10 pr-4 text-[12px] text-white outline-none transition placeholder:text-[#617B9C] focus:border-[#448AFF]"
                />
              </div>

              {/* Refresh */}

              <button
                type="button"
                onClick={() => void loadTeams()}
                disabled={loading}
                aria-label="Refresh teams"
                title="Refresh teams"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2B405C] bg-[#101D30] text-[#9BB7D9] transition hover:border-[#448AFF] hover:text-white disabled:opacity-40"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading ? "animate-spin" : ""
                  }
                />
              </button>
            </div>
          </div>

          {/* Directory status */}

          <div className="mb-4 flex items-center justify-between border-b border-[#273B54] pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#728BA9]">
              Showing {filteredTeams.length} of{" "}
              {teams.length} clubs
            </p>

            <p className="hidden items-center gap-2 text-[10px] text-[#728BA9] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#448AFF]" />

              Alphabetical Registry
            </p>
          </div>

          {/* =================================
              LOADING
          ================================= */}

          {loading ? (
            <div className="flex min-h-[270px] flex-col items-center justify-center rounded-xl border border-[#293E58] bg-[#101D30] text-center">
              <LoaderCircle
                size={31}
                className="animate-spin text-[#70A9FF]"
              />

              <p className="mt-5 text-[12px] font-semibold text-[#9AB2D0]">
                Loading club registry...
              </p>
            </div>
          ) : teams.length === 0 ? (

            /* =================================
                EMPTY REGISTRY
            ================================= */

            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-[#365272] bg-[#101D30] px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#355577] bg-[#192F4B]">
                <Shield
                  size={29}
                  className="text-[#80B3F8]"
                />
              </div>

              <h3 className="font-heading mt-5 text-xl font-extrabold text-white">
                The registry is empty.
              </h3>

              <p className="mt-2 max-w-sm text-[12px] leading-6 text-[#849BB8]">
                Every great tournament starts with
                its clubs. Register your first team
                to begin building the competition.
              </p>

              <button
                type="button"
                onClick={openCreateForm}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#3478F6] px-5 py-3 text-[11px] font-extrabold text-white transition hover:bg-[#5593FF]"
              >
                <CirclePlus size={16} />

                Register First Club
              </button>
            </div>
          ) : filteredTeams.length === 0 ? (

            /* =================================
                NO SEARCH RESULTS
            ================================= */

            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-[#293E58] bg-[#101D30] px-6 text-center">
              <Search
                size={29}
                className="text-[#7597BF]"
              />

              <h3 className="mt-5 font-heading text-lg font-bold">
                No matching clubs.
              </h3>

              <p className="mt-2 text-[12px] text-[#8198B5]">
                Try searching by team name, short code
                or registry ID.
              </p>

              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-5 text-[12px] font-bold text-[#8DBBFF] hover:text-white"
              >
                Clear Search
              </button>
            </div>
          ) : (

            /* =================================
                FIXED CLUB CARD GRID
            ================================= */

            <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredTeams.map((team, index) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  index={index}
                  editing={editingId === team.id}
                  busy={busy}
                  deleting={deletingId === team.id}
                  onEdit={beginEditing}
                  onDelete={(selected) =>
                    void deleteTeam(selected)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* =====================================
            FOOTER
        ===================================== */}

        <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-[#273B54] pt-6 text-[10px] text-[#6882A1] sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Shield
              size={13}
              className="text-[#70A9FF]"
            />

            <span className="font-bold uppercase tracking-[0.12em]">
              FOOTBALLCUP / CLUB REGISTRY
            </span>
          </div>

          <Link
            href="/admin/event-teams"
            className="inline-flex items-center gap-2 font-bold text-[#8DBBFF] transition hover:text-white"
          >
            Continue to Event Registration

            <ArrowRight size={13} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
