
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
  Check,
  ChevronDown,
  CirclePlus,
  FilterX,
  Grid2X2,
  ImageOff,
  LayoutList,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";

/* ======================================================
   CONFIGURATION
====================================================== */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* ======================================================
   TYPES
====================================================== */

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

type Position = "GK" | "DF" | "MF" | "FW";

interface Player {
  id: number;
  team: number;
  team_name: string;
  full_name: string;
  jersey_number: number;
  position: Position;
  is_active: boolean;
  created_at: string;
}

interface PlayerForm {
  team: string;
  full_name: string;
  jersey_number: string;
  position: Position;
  is_active: boolean;
}

type MessageType = "success" | "error";

type ViewMode = "grid" | "list";

type StatusFilter = "all" | "active" | "inactive";

type SortMode = "name" | "jersey" | "team" | "newest";

/* ======================================================
   CONSTANTS
====================================================== */

const EMPTY_FORM: PlayerForm = {
  team: "",
  full_name: "",
  jersey_number: "",
  position: "FW",
  is_active: true,
};

const POSITIONS: Record<Position, string> = {
  GK: "Goalkeeper",
  DF: "Defender",
  MF: "Midfielder",
  FW: "Forward",
};

const POSITION_ORDER: Position[] = [
  "GK",
  "DF",
  "MF",
  "FW",
];

const POSITION_THEME: Record<
  Position,
  {
    primary: string;
    secondary: string;
    soft: string;
    label: string;
    border: string;
    button: string;
  }
> = {
  GK: {
    primary: "#27E2B2",
    secondary: "#063F3D",
    soft: "rgba(39,226,178,.13)",
    label: "text-[#49E8C1]",
    border: "border-[#27E2B2]/45",
    button:
      "border-[#27E2B2]/50 bg-[#27E2B2]/10 text-[#49E8C1]",
  },

  DF: {
    primary: "#35A3FF",
    secondary: "#092D66",
    soft: "rgba(53,163,255,.14)",
    label: "text-[#65BBFF]",
    border: "border-[#35A3FF]/45",
    button:
      "border-[#35A3FF]/50 bg-[#35A3FF]/10 text-[#65BBFF]",
  },

  MF: {
    primary: "#EBC16D",
    secondary: "#62401B",
    soft: "rgba(235,193,109,.14)",
    label: "text-[#F5D58D]",
    border: "border-[#EBC16D]/45",
    button:
      "border-[#EBC16D]/50 bg-[#EBC16D]/10 text-[#F5D58D]",
  },

  FW: {
    primary: "#B66AFF",
    secondary: "#421778",
    soft: "rgba(182,106,255,.14)",
    label: "text-[#CE9CFF]",
    border: "border-[#B66AFF]/45",
    button:
      "border-[#B66AFF]/50 bg-[#B66AFF]/10 text-[#CE9CFF]",
  },
};

const inputClass =
  "w-full min-w-0 rounded-xl border border-[#28415F] bg-[#09182C] px-4 py-3.5 text-[13px] text-white outline-none transition placeholder:text-[#5E7797] focus:border-[#398EFF] focus:ring-2 focus:ring-[#398EFF]/15 disabled:cursor-not-allowed disabled:opacity-40";

const labelClass =
  "mb-2.5 block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#9AB3D0]";

/* ======================================================
   API HELPERS
====================================================== */

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
  initialUrl: string
): Promise<T[]> {
  const items: T[] = [];

  let nextUrl: string | null = initialUrl;

  const visited = new Set<string>();

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
    });

    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        getApiError(
          data,
          `Unable to load data (HTTP ${response.status}).`
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

/* ======================================================
   TEAM LOGO
====================================================== */

function resolveLogo(
  logo: string | null | undefined
): string | null {
  if (!logo?.trim()) return null;

  const value = logo.trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const backendOrigin = API_BASE_URL.replace(
    /\/api\/?$/,
    ""
  );

  if (value.startsWith("//")) {
    return `http:${value}`;
  }

  return `${backendOrigin}/${value.replace(/^\/+/, "")}`;
}

function ClubCrest({
  team,
  size = 34,
}: {
  team?: Team;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const logo = resolveLogo(team?.logo);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[#102842] p-1 shadow-lg"
      style={{
        width: size,
        height: size,
      }}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={team?.name || "Club crest"}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Shield
          size={size * 0.48}
          className="text-[#A9C8F3]"
        />
      )}
    </div>
  );
}

/* ======================================================
   FOOTBALLER SILHOUETTE

   The current Player model has no portrait field.
   This decorative artwork avoids using fake photos.
====================================================== */

function FootballerArtwork({
  accent,
  number,
}: {
  accent: string;
  number: string | number;
}) {
  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden">
      {/* Stadium light */}

      <div
        className="absolute left-1/2 top-[12%] h-[65%] w-[80%] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: `${accent}35`,
        }}
      />

      {/* Decorative rays */}

      <div
        className="absolute -right-12 top-0 h-full w-20 rotate-[26deg] opacity-20"
        style={{
          background: accent,
        }}
      />

      <div
        className="absolute -left-12 top-10 h-full w-12 rotate-[-26deg] opacity-10"
        style={{
          background: accent,
        }}
      />

      {/* Person silhouette */}

      <svg
        viewBox="0 0 240 240"
        className="absolute bottom-[-8%] left-1/2 h-[98%] w-[110%] -translate-x-1/2 drop-shadow-[0_0_24px_rgba(0,0,0,.55)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`kit-${accent.replace("#", "")}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={accent}
              stopOpacity="0.95"
            />

            <stop
              offset="55%"
              stopColor="#10243C"
            />

            <stop
              offset="100%"
              stopColor="#030A15"
            />
          </linearGradient>
        </defs>

        {/* Neck */}

        <path
          d="M105 103 L105 124 L135 124 L135 103 Z"
          fill="#263D55"
        />

        {/* Head */}

        <ellipse
          cx="120"
          cy="76"
          rx="30"
          ry="37"
          fill="#1A3049"
          stroke={accent}
          strokeOpacity=".3"
          strokeWidth="1.4"
        />

        {/* Hair */}

        <path
          d="M91 70 C88 37 108 28 127 34 C148 36 154 54 149 69 C138 56 126 59 115 55 C107 63 100 63 91 70Z"
          fill="#06101F"
        />

        {/* Torso / shirt */}

        <path
          d="M105 117 L79 127 C54 137 37 153 27 184 L10 240 H230 L213 184 C203 153 186 137 161 127 L135 117 L120 135 Z"
          fill={`url(#kit-${accent.replace("#", "")})`}
          stroke={accent}
          strokeOpacity=".6"
          strokeWidth="1.5"
        />

        {/* Shirt design */}

        <path
          d="M106 118 L120 137 L134 118"
          fill="none"
          stroke="#EAF4FF"
          strokeOpacity=".55"
          strokeWidth="2"
        />

        <path
          d="M79 129 L101 240 M161 129 L139 240"
          fill="none"
          stroke={accent}
          strokeOpacity=".45"
          strokeWidth="4"
        />

        <path
          d="M57 154 L81 166 M183 154 L159 166"
          fill="none"
          stroke="#EAF4FF"
          strokeOpacity=".2"
          strokeWidth="3"
        />

        {/* Jersey number */}

        <text
          x="120"
          y="207"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="42"
          fontWeight="900"
          fill="#FFFFFF"
          fillOpacity=".8"
        >
          {String(number).slice(0, 2)}
        </text>
      </svg>

      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[#050D1B] to-transparent" />
    </div>
  );
}

/* ======================================================
   FIFA-INSPIRED PLAYER CARD
====================================================== */

function PlayerCard({
  player,
  team,
  busy,
  deleting,
  onEdit,
  onToggle,
  onDelete,
}: {
  player: Player;
  team?: Team;
  busy: boolean;
  deleting: boolean;
  onEdit: (player: Player) => void;
  onToggle: (player: Player) => void;
  onDelete: (player: Player) => void;
}) {
  const theme = POSITION_THEME[player.position];

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#223B58] bg-[#0B192B] transition-all duration-300 hover:-translate-y-1 hover:border-[#4A76A8] hover:shadow-[0_18px_50px_rgba(0,0,0,.35)]">
      {/* Collectible card */}

      <div className="relative px-3 pt-3">
        <div
          className="relative isolate h-[260px] overflow-hidden border p-[2px] sm:h-[275px]"
          style={{
            clipPath:
              "polygon(13% 0, 87% 0, 100% 9%, 100% 89%, 86% 100%, 14% 100%, 0 89%, 0 9%)",
            borderColor: `${theme.primary}70`,
            background: `linear-gradient(140deg, ${theme.primary}, #09182A 32%, ${theme.primary}90 72%, #06101F)`,
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              clipPath:
                "polygon(13% 0, 87% 0, 100% 9%, 100% 89%, 86% 100%, 14% 100%, 0 89%, 0 9%)",
              background: `radial-gradient(ellipse at 55% 42%, ${theme.secondary}, #071222 78%)`,
            }}
          >
            {/* Inner frame */}

            <div
              className="pointer-events-none absolute inset-[7px] z-20 border opacity-40"
              style={{
                borderColor: theme.primary,
                clipPath:
                  "polygon(13% 0, 87% 0, 100% 9%, 100% 89%, 86% 100%, 14% 100%, 0 89%, 0 9%)",
              }}
            />

            {/* Position and number */}

            <div className="absolute left-5 top-7 z-30">
              <p
                className="font-heading text-[39px] font-black leading-none tracking-[-0.09em]"
                style={{
                  color: theme.primary,
                }}
              >
                {String(player.jersey_number).padStart(
                  2,
                  "0"
                )}
              </p>

              <p className="mt-1 text-[13px] font-black tracking-[0.14em] text-white">
                {player.position}
              </p>

              <div
                className="mt-2 h-[2px] w-7"
                style={{
                  background: theme.primary,
                }}
              />
            </div>

            {/* Club identity */}

            <div className="absolute right-5 top-8 z-30">
              <ClubCrest
                key={`${team?.id}-${team?.logo}`}
                team={team}
                size={39}
              />
            </div>

            {/* Artwork */}

            <div className="absolute inset-x-3 bottom-[42px] top-[35px] z-10">
              <FootballerArtwork
                accent={theme.primary}
                number={player.jersey_number}
              />
            </div>

            {/* Card name */}

            <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#030915] via-[#030915]/95 to-transparent px-3 pb-7 pt-12 text-center">
              <h3
                title={player.full_name}
                className="font-heading truncate text-[17px] font-black uppercase tracking-[-0.045em] text-white"
              >
                {player.full_name}
              </h3>

              <p
                className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.16em]"
                style={{
                  color: theme.primary,
                }}
              >
                {POSITIONS[player.position]}
              </p>
            </div>

            {/* Bottom gem */}

            <div
              className="absolute bottom-2 left-1/2 z-40 h-[5px] w-[5px] -translate-x-1/2 rotate-45"
              style={{
                background: theme.primary,
              }}
            />
          </div>
        </div>
      </div>

      {/* Real player information */}

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <ClubCrest
            key={`info-${team?.id}-${team?.logo}`}
            team={team}
            size={27}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-[#CFDDF0]">
              {player.team_name}
            </p>

            <p className="font-mono text-[9px] text-[#6C87A8]">
              PLAYER ID #{player.id}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
              player.is_active
                ? "border-[#3A79BD] bg-[#16365A] text-[#8DC0FF]"
                : "border-[#604455] bg-[#372331] text-[#DB98AA]"
            }`}
          >
            {player.is_active
              ? "Active"
              : "Inactive"}
          </span>
        </div>

        {/* Fixed action position */}

        <div className="mt-auto grid grid-cols-[1fr_1fr_35px] gap-1.5 border-t border-[#243A55] pt-4">
          <button
            type="button"
            onClick={() => onEdit(player)}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#315D91] bg-[#153052] text-[10px] font-bold text-[#A5CEFF] transition hover:bg-[#234977] disabled:opacity-40"
          >
            <Pencil size={12} />
            Edit
          </button>

          <button
            type="button"
            onClick={() => onToggle(player)}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#344D69] bg-[#14263D] px-1 text-[10px] font-bold text-[#A8BBD3] transition hover:bg-[#203C5B] disabled:opacity-40"
          >
            {player.is_active
              ? "Deactivate"
              : "Activate"}
          </button>

          <button
            type="button"
            aria-label={`Delete ${player.full_name}`}
            title={`Delete ${player.full_name}`}
            onClick={() => onDelete(player)}
            disabled={busy}
            className="flex h-9 items-center justify-center rounded-lg border border-[#663849] bg-[#381F2D] text-[#F093A6] transition hover:bg-[#572738] disabled:opacity-40"
          >
            {deleting ? (
              <LoaderCircle
                size={13}
                className="animate-spin"
              />
            ) : (
              <Trash2 size={13} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ======================================================
   MAIN PAGE
====================================================== */

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>(
    []
  );

  const [teams, setTeams] = useState<Team[]>([]);

  const [form, setForm] = useState<PlayerForm>({
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

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [positionFilter, setPositionFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [sortMode, setSortMode] =
    useState<SortMode>("name");

  const [viewMode, setViewMode] =
    useState<ViewMode>("grid");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<MessageType>("success");

  const editorRef = useRef<HTMLDivElement>(null);

  const busy = saving || deletingId !== null;

  /* ====================================================
     NOTIFICATIONS
  ==================================================== */

  function showMessage(
    text: string,
    type: MessageType = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  /* ====================================================
     LOAD DATA
  ==================================================== */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [loadedPlayers, loadedTeams] =
        await Promise.all([
          fetchAllPages<Player>(
            `${API_BASE_URL}/admin/players/`
          ),

          fetchAllPages<Team>(
            `${API_BASE_URL}/admin/teams/`
          ),
        ]);

      setPlayers(loadedPlayers);
      setTeams(loadedTeams);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ====================================================
     DERIVED DATA
  ==================================================== */

  const teamMap = useMemo(() => {
    return new Map(
      teams.map((team) => [team.id, team])
    );
  }, [teams]);

  const activeCount = useMemo(
    () =>
      players.filter(
        (player) => player.is_active
      ).length,
    [players]
  );

  const positionCounts = useMemo(() => {
    return {
      GK: players.filter(
        (player) => player.position === "GK"
      ).length,

      DF: players.filter(
        (player) => player.position === "DF"
      ).length,

      MF: players.filter(
        (player) => player.position === "MF"
      ).length,

      FW: players.filter(
        (player) => player.position === "FW"
      ).length,
    };
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter((player) => {
        const matchesSearch =
          !query ||
          player.full_name
            .toLowerCase()
            .includes(query) ||
          player.team_name
            .toLowerCase()
            .includes(query) ||
          String(player.jersey_number).includes(
            query
          ) ||
          String(player.id).includes(query);

        const matchesTeam =
          !teamFilter ||
          String(player.team) === teamFilter;

        const matchesPosition =
          !positionFilter ||
          player.position === positionFilter;

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            player.is_active) ||
          (statusFilter === "inactive" &&
            !player.is_active);

        return (
          matchesSearch &&
          matchesTeam &&
          matchesPosition &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        switch (sortMode) {
          case "jersey":
            return (
              a.jersey_number - b.jersey_number ||
              a.full_name.localeCompare(
                b.full_name
              )
            );

          case "team":
            return (
              a.team_name.localeCompare(
                b.team_name
              ) ||
              a.full_name.localeCompare(
                b.full_name
              )
            );

          case "newest":
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );

          default:
            return a.full_name.localeCompare(
              b.full_name
            );
        }
      });
  }, [
    players,
    search,
    teamFilter,
    positionFilter,
    statusFilter,
    sortMode,
  ]);

  const selectedFormTeam = teams.find(
    (team) => String(team.id) === form.team
  );

  const filtersActive =
    Boolean(search) ||
    Boolean(teamFilter) ||
    Boolean(positionFilter) ||
    statusFilter !== "all";

  /* ====================================================
     EDITOR HELPERS
  ==================================================== */

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
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
    setMessage("");
    setEditorOpen(true);
    scrollToEditor();
  }

  function beginEditing(player: Player) {
    setEditingId(player.id);

    setForm({
      team: String(player.team),
      full_name: player.full_name,
      jersey_number: String(
        player.jersey_number
      ),
      position: player.position,
      is_active: player.is_active,
    });

    setMessage("");
    setEditorOpen(true);
    scrollToEditor();
  }

  function cancelEditing() {
    resetForm();
    setEditorOpen(false);
  }

  function clearFilters() {
    setSearch("");
    setTeamFilter("");
    setPositionFilter("");
    setStatusFilter("all");
  }

  /* ====================================================
     CREATE / UPDATE
  ==================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    const fullName = form.full_name.trim();
    const teamId = Number(form.team);
    const jerseyNumber = Number(
      form.jersey_number
    );

    if (!fullName || !form.team) {
      showMessage(
        "Player name and team are required.",
        "error"
      );
      return;
    }

    if (
      !Number.isInteger(teamId) ||
      teamId <= 0 ||
      !teams.some((team) => team.id === teamId)
    ) {
      showMessage(
        "Please select a valid team.",
        "error"
      );
      return;
    }

    if (
      !form.jersey_number.trim() ||
      !Number.isInteger(jerseyNumber) ||
      jerseyNumber < 1 ||
      jerseyNumber > 99
    ) {
      showMessage(
        "Jersey number must be between 1 and 99.",
        "error"
      );
      return;
    }

    const duplicate = players.some(
      (player) =>
        player.team === teamId &&
        player.jersey_number === jerseyNumber &&
        player.id !== editingId
    );

    if (duplicate) {
      showMessage(
        "This jersey number is already assigned to another player in the selected team.",
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
        ? `${API_BASE_URL}/admin/players/${editingId}/`
        : `${API_BASE_URL}/admin/players/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          team: teamId,
          full_name: fullName,
          jersey_number: jerseyNumber,
          position: form.position,
          is_active: form.is_active,
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
              ? "Unable to update player."
              : "Unable to register player."
          )
        );
      }

      resetForm();
      setEditorOpen(false);

      await loadData();

      showMessage(
        isEditing
          ? "Player updated successfully."
          : "Player registered successfully."
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to save player.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ====================================================
     ACTIVATE / DEACTIVATE
  ==================================================== */

  async function toggleActive(player: Player) {
    if (busy) return;

    setSaving(true);
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/players/${player.id}/`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify({
            is_active: !player.is_active,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            "Unable to update player status."
          )
        );
      }

      await loadData();

      showMessage(
        player.is_active
          ? "Player deactivated successfully."
          : "Player activated successfully."
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to update player status.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ====================================================
     DELETE
  ==================================================== */

  async function deletePlayer(player: Player) {
    if (busy) return;

    const confirmed = window.confirm(
      `Delete "${player.full_name}"?\n\nHistorical match events will retain the player's text name, but their player association will be cleared. Consider deactivating the player instead.`
    );

    if (!confirmed) return;

    setDeletingId(player.id);
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/players/${player.id}/`,
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
            "Unable to delete player."
          )
        );
      }

      if (editingId === player.id) {
        resetForm();
        setEditorOpen(false);
      }

      await loadData();

      showMessage(
        "Player deleted successfully."
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete player.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <main className="min-h-full bg-[#050D19] font-body text-white">
      <div className="mx-auto max-w-[1750px] px-4 pb-16 pt-7 sm:px-6 xl:px-9">

        {/* =============================================
            BREADCRUMB
        ============================================= */}

        <nav className="mb-7 flex items-center gap-2 text-[11px]">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[#7594BB] transition hover:text-white"
          >
            <ArrowLeft size={13} />
            Command Centre
          </Link>

          <ArrowRight
            size={12}
            className="text-[#45617F]"
          />

          <span className="font-bold text-[#8DC0FF]">
            Squad Management
          </span>
        </nav>

        {/* =============================================
            CINEMATIC HEADER
        ============================================= */}

        <header className="relative isolate mb-6 overflow-hidden rounded-xl border border-[#23456C] bg-[#091A30]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=85')",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#071426_0%,rgba(7,20,38,.95)_40%,rgba(7,20,38,.45)_100%)]" />

          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#218BFF] via-[#A16BFF] to-transparent" />

          <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-9 sm:px-9 sm:py-11">
            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.23em] text-[#73B5FF]">
                <Sparkles size={13} />
                Ultimate Squad Administration
              </p>

              <h1 className="font-heading text-[clamp(43px,6vw,76px)] font-black uppercase italic leading-[.95] tracking-[-0.075em] text-white [text-shadow:0_0_35px_rgba(37,125,255,.35)]">
                PLAYERS
                <span className="text-[#398EFF]">.</span>
              </h1>

              <p className="mt-4 max-w-lg text-[12px] leading-6 text-[#A3BCD9]">
                Assemble your roster. Manage club
                assignments, shirt numbers and player
                availability from one premium workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(110deg,#087AFF,#794CFF)] px-5 text-[11px] font-black uppercase tracking-wider text-white shadow-[0_10px_30px_rgba(31,111,255,.25)] transition hover:brightness-125"
            >
              <CirclePlus size={17} />
              Register Player
            </button>
          </div>
        </header>

        {/* =============================================
            STATS
        ============================================= */}

        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              title: "Total Players",
              value: players.length,
              icon: Users,
              color: "#35A3FF",
              background:
                "linear-gradient(120deg,#0C2748,#091A30)",
            },
            {
              title: "Active Players",
              value: activeCount,
              icon: Activity,
              color: "#27E2B2",
              background:
                "linear-gradient(120deg,#09352F,#091A30)",
            },
            {
              title: "Registered Teams",
              value: teams.length,
              icon: Shield,
              color: "#B66AFF",
              background:
                "linear-gradient(120deg,#281747,#091A30)",
            },
            {
              title: "Positions",
              value: POSITION_ORDER.filter(
                (position) =>
                  positionCounts[position] > 0
              ).length,
              icon: Trophy,
              color: "#EBC16D",
              background:
                "linear-gradient(120deg,#382A17,#091A30)",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="flex min-h-[105px] items-center gap-4 rounded-xl border border-[#27415F] p-4 sm:p-5"
                style={{
                  background: stat.background,
                }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    color: stat.color,
                    borderColor: `${stat.color}55`,
                    background: `${stat.color}15`,
                  }}
                >
                  <Icon size={21} />
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#91A9C7]">
                    {stat.title}
                  </p>

                  <p className="font-heading mt-1 text-[28px] font-black leading-none tracking-[-0.05em] text-white">
                    {loading ? "—" : stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* =============================================
            NOTIFICATION
        ============================================= */}

        {message && (
          <div
            role="alert"
            className={`mb-6 flex items-start justify-between gap-4 rounded-lg border px-5 py-4 ${
              messageType === "error"
                ? "border-[#A94A65]/50 bg-[#4A2032]/50 text-[#FFB3C3]"
                : "border-[#3376BD]/50 bg-[#12375C] text-[#B5D8FF]"
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

              <p className="text-[12px] leading-5">
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

        {/* =============================================
            EDITOR
        ============================================= */}

        {editorOpen && (
          <section
            ref={editorRef}
            className="mb-8 scroll-mt-24 overflow-hidden rounded-xl border border-[#2861A0] bg-[#0A1A2F] shadow-[0_15px_55px_rgba(0,0,0,.3)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#24415F] bg-[#102540] px-6 py-5">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.17em] text-[#70B1FF]">
                  Squad Editor /{" "}
                  {editingId !== null
                    ? "Modify Identity"
                    : "New Signing"}
                </p>

                <h2 className="font-heading text-xl font-black uppercase tracking-[-0.04em]">
                  {editingId !== null
                    ? "Edit Player"
                    : "Register New Player"}
                </h2>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                aria-label="Close editor"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#355577] text-[#A2BBD9] hover:bg-[#214162] disabled:opacity-40"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_270px]">
              <form
                onSubmit={handleSubmit}
                className="grid content-start gap-5 p-5 sm:grid-cols-2 sm:p-7"
              >
                {/* Team */}

                <div>
                  <label
                    htmlFor="player-team"
                    className={labelClass}
                  >
                    Club Assignment
                  </label>

                  <div className="relative">
                    <select
                      id="player-team"
                      value={form.team}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          team: event.target.value,
                        }))
                      }
                      className={`${inputClass} appearance-none pr-10`}
                      required
                    >
                      <option value="">
                        Select a team
                      </option>

                      {teams.map((team) => (
                        <option
                          key={team.id}
                          value={team.id}
                        >
                          {team.name} ({team.code})
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7898BE]"
                    />
                  </div>
                </div>

                {/* Full name */}

                <div>
                  <label
                    htmlFor="player-name"
                    className={labelClass}
                  >
                    Player Full Name
                  </label>

                  <input
                    id="player-name"
                    type="text"
                    maxLength={100}
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        full_name:
                          event.target.value,
                      }))
                    }
                    placeholder="e.g. Ahmed Khan"
                    className={inputClass}
                  />
                </div>

                {/* Jersey */}

                <div>
                  <label
                    htmlFor="player-jersey"
                    className={labelClass}
                  >
                    Shirt Number
                  </label>

                  <input
                    id="player-jersey"
                    type="number"
                    min={1}
                    max={99}
                    step={1}
                    required
                    value={form.jersey_number}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        jersey_number:
                          event.target.value,
                      }))
                    }
                    placeholder="01 - 99"
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>

                {/* Status */}

                <div>
                  <label className={labelClass}>
                    Player Availability
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        is_active:
                          !current.is_active,
                      }))
                    }
                    aria-pressed={form.is_active}
                    className={`flex h-[48px] w-full items-center justify-between rounded-xl border px-4 transition ${
                      form.is_active
                        ? "border-[#3878BC] bg-[#153456]"
                        : "border-[#674257] bg-[#342030]"
                    }`}
                  >
                    <span className="text-[12px] font-bold text-[#D7E6FA]">
                      {form.is_active
                        ? "Active Player"
                        : "Inactive Player"}
                    </span>

                    <span
                      className={`relative h-6 w-11 rounded-full transition ${
                        form.is_active
                          ? "bg-[#287FFF]"
                          : "bg-[#66455B]"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                          form.is_active
                            ? "left-6"
                            : "left-1"
                        }`}
                      />
                    </span>
                  </button>
                </div>

                {/* Position selection */}

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Playing Position
                  </label>

                  <div className="grid grid-cols-4 gap-2">
                    {POSITION_ORDER.map(
                      (position) => {
                        const theme =
                          POSITION_THEME[position];

                        const selected =
                          form.position === position;

                        return (
                          <button
                            key={position}
                            type="button"
                            onClick={() =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  position,
                                })
                              )
                            }
                            className={`flex min-h-[72px] flex-col items-center justify-center rounded-lg border transition hover:brightness-125 ${
                              selected
                                ? theme.button
                                : "border-[#2A4564] bg-[#0D2036] text-[#849FBE]"
                            }`}
                          >
                            <span className="font-heading text-xl font-black">
                              {position}
                            </span>

                            <span className="mt-1 text-[9px] font-semibold">
                              {POSITIONS[position]}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Submit */}

                <div className="flex flex-wrap gap-3 border-t border-[#294360] pt-5 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      loading ||
                      teams.length === 0
                    }
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(110deg,#087AFF,#794CFF)] px-5 text-[11px] font-black uppercase tracking-[0.07em] text-white transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
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
                      ? "Saving..."
                      : editingId !== null
                        ? "Save Player Changes"
                        : "Add to Squad"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#345474] px-5 text-[11px] font-bold text-[#A4BDD9] hover:bg-[#1C3653] disabled:opacity-40"
                  >
                    <RotateCcw size={14} />
                    Cancel
                  </button>
                </div>
              </form>

              {/* Live preview */}

              <aside className="flex flex-col items-center justify-center border-t border-[#294360] bg-[radial-gradient(ellipse_at_50%_30%,#19375A,#081525_75%)] p-6 lg:border-l lg:border-t-0">
                <p className="mb-5 text-[10px] font-black uppercase tracking-[0.17em] text-[#89AEDB]">
                  Live Card Preview
                </p>

                <div
                  className="relative h-[265px] w-[205px] overflow-hidden border-2"
                  style={{
                    clipPath:
                      "polygon(13% 0,87% 0,100% 9%,100% 89%,86% 100%,14% 100%,0 89%,0 9%)",
                    borderColor:
                      POSITION_THEME[form.position]
                        .primary,
                    background: `radial-gradient(ellipse at 50% 45%, ${
                      POSITION_THEME[form.position]
                        .secondary
                    },#06101F 80%)`,
                  }}
                >
                  <div className="absolute left-5 top-6 z-20">
                    <p
                      className="font-heading text-4xl font-black leading-none"
                      style={{
                        color:
                          POSITION_THEME[
                            form.position
                          ].primary,
                      }}
                    >
                      {form.jersey_number || "00"}
                    </p>

                    <p className="mt-1 text-xs font-black">
                      {form.position}
                    </p>
                  </div>

                  <div className="absolute right-4 top-6 z-20">
                    <ClubCrest
                      key={selectedFormTeam?.id}
                      team={selectedFormTeam}
                      size={35}
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-8 top-10">
                    <FootballerArtwork
                      accent={
                        POSITION_THEME[
                          form.position
                        ].primary
                      }
                      number={
                        form.jersey_number || "00"
                      }
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-5 z-30 px-3 text-center">
                    <p className="font-heading truncate text-sm font-black uppercase">
                      {form.full_name ||
                        "PLAYER NAME"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-center text-[10px] text-[#7696BC]">
                  Your player identity updates as
                  you edit the form.
                </p>
              </aside>
            </div>
          </section>
        )}

        {/* =============================================
            PLAYER DIRECTORY
        ============================================= */}

        <section className="overflow-hidden rounded-xl border border-[#203C5B] bg-[#081625]">
          {/* Toolbar */}

          <div className="border-b border-[#213D5C] bg-[#0C1B30] p-4 sm:p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.19em] text-[#69AEFF]">
                  <Grid2X2 size={13} />
                  Squad Collection
                </p>

                <h2 className="font-heading text-2xl font-black uppercase tracking-[-0.05em]">
                  Player Database
                  <span className="ml-2 text-[#398EFF]">
                    / {filteredPlayers.length}
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#345575] bg-[#132A45] px-4 text-[11px] font-bold text-[#A6C8EF] transition hover:border-[#398EFF] disabled:opacity-40"
              >
                <RefreshCw
                  size={14}
                  className={
                    loading ? "animate-spin" : ""
                  }
                />

                Refresh Squad
              </button>
            </div>

            {/* Filters */}

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_155px_145px]">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7797B9]"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name, team or shirt number..."
                  className={`${inputClass} h-11 pl-11`}
                  aria-label="Search players"
                />
              </div>

              <select
                value={teamFilter}
                onChange={(event) =>
                  setTeamFilter(event.target.value)
                }
                className={`${inputClass} h-11 py-2`}
                aria-label="Filter by team"
              >
                <option value="">All Teams</option>

                {teams.map((team) => (
                  <option
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
                  </option>
                ))}
              </select>

              <select
                value={positionFilter}
                onChange={(event) =>
                  setPositionFilter(
                    event.target.value
                  )
                }
                className={`${inputClass} h-11 py-2`}
                aria-label="Filter by position"
              >
                <option value="">
                  All Positions
                </option>

                {POSITION_ORDER.map(
                  (position) => (
                    <option
                      key={position}
                      value={position}
                    >
                      {POSITIONS[position]}
                    </option>
                  )
                )}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as StatusFilter
                  )
                }
                className={`${inputClass} h-11 py-2`}
                aria-label="Filter by status"
              >
                <option value="all">
                  All Statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </div>

            {/* Secondary toolbar */}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#7997BA]">
                  {filteredPlayers.length} /{" "}
                  {players.length} players
                </span>

                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#375B82] px-2.5 py-1.5 text-[10px] font-bold text-[#A4C9F5] hover:bg-[#183858]"
                  >
                    <FilterX size={12} />
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(
                      event.target.value as SortMode
                    )
                  }
                  className="h-9 rounded-lg border border-[#2C496A] bg-[#10243D] px-3 text-[11px] text-[#C3D7F0] outline-none"
                  aria-label="Sort players"
                >
                  <option value="name">
                    Name (A-Z)
                  </option>

                  <option value="jersey">
                    Shirt Number
                  </option>

                  <option value="team">
                    Team Name
                  </option>

                  <option value="newest">
                    Newest First
                  </option>
                </select>

                <div className="flex overflow-hidden rounded-lg border border-[#2C496A] bg-[#10243D]">
                  <button
                    type="button"
                    aria-label="Card view"
                    title="Card view"
                    onClick={() =>
                      setViewMode("grid")
                    }
                    className={`flex h-9 w-9 items-center justify-center ${
                      viewMode === "grid"
                        ? "bg-[#287FFF] text-white"
                        : "text-[#8AA9CB] hover:text-white"
                    }`}
                  >
                    <Grid2X2 size={15} />
                  </button>

                  <button
                    type="button"
                    aria-label="List view"
                    title="List view"
                    onClick={() =>
                      setViewMode("list")
                    }
                    className={`flex h-9 w-9 items-center justify-center ${
                      viewMode === "list"
                        ? "bg-[#287FFF] text-white"
                        : "text-[#8AA9CB] hover:text-white"
                    }`}
                  >
                    <LayoutList size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ===========================================
              LOADING
          =========================================== */}

          {loading ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center">
              <LoaderCircle
                size={35}
                className="animate-spin text-[#398EFF]"
              />

              <p className="mt-5 text-[12px] font-bold text-[#91B1D6]">
                Loading player collection...
              </p>
            </div>
          ) : filteredPlayers.length === 0 ? (

            /* =========================================
                EMPTY STATE
            ========================================= */

            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#305780] bg-[#123150]">
                <Users
                  size={34}
                  className="text-[#79B6FF]"
                />
              </div>

              <h3 className="font-heading mt-6 text-xl font-black uppercase tracking-[-0.04em]">
                {players.length === 0
                  ? "Build Your Dream Squad"
                  : "No Matching Players"}
              </h3>

              <p className="mt-3 max-w-sm text-[12px] leading-6 text-[#86A3C5]">
                {players.length === 0
                  ? "Your player collection is currently empty. Register your first footballer to begin building the squad."
                  : "No player matches the current search and filter selection."}
              </p>

              {players.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreateEditor}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#287FFF] px-5 py-3 text-[11px] font-black uppercase text-white hover:bg-[#4C98FF]"
                >
                  <Plus size={15} />
                  Add First Player
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 text-[12px] font-bold text-[#87BBFF] hover:text-white"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (

            /* =========================================
                FIFA-INSPIRED CARD GRID
            ========================================= */

            <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  team={teamMap.get(player.team)}
                  busy={busy}
                  deleting={
                    deletingId === player.id
                  }
                  onEdit={beginEditing}
                  onToggle={(selected) =>
                    void toggleActive(selected)
                  }
                  onDelete={(selected) =>
                    void deletePlayer(selected)
                  }
                />
              ))}
            </div>
          ) : (

            /* =========================================
                COMPACT LIST VIEW
            ========================================= */

            <div className="divide-y divide-[#1E3855]">
              {filteredPlayers.map((player) => {
                const theme =
                  POSITION_THEME[player.position];

                const team = teamMap.get(
                  player.team
                );

                return (
                  <div
                    key={player.id}
                    className="flex flex-wrap items-center gap-4 px-4 py-4 transition hover:bg-[#10253D] sm:px-6"
                  >
                    {/* Jersey */}

                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border font-heading text-xl font-black"
                      style={{
                        borderColor: `${theme.primary}65`,
                        color: theme.primary,
                        background: theme.soft,
                      }}
                    >
                      {player.jersey_number}
                    </div>

                    {/* Player identity */}

                    <div className="min-w-[140px] flex-1">
                      <p className="truncate text-[13px] font-extrabold text-white">
                        {player.full_name}
                      </p>

                      <p className="mt-1 truncate text-[10px] text-[#809EC0]">
                        {player.team_name}
                      </p>
                    </div>

                    {/* Position */}

                    <span
                      className="rounded-md border px-3 py-1.5 text-[10px] font-black"
                      style={{
                        borderColor: `${theme.primary}55`,
                        color: theme.primary,
                        background: theme.soft,
                      }}
                    >
                      {player.position}
                    </span>

                    {/* Status */}

                    <span
                      className={`min-w-[65px] text-center text-[10px] font-bold ${
                        player.is_active
                          ? "text-[#8DC0FF]"
                          : "text-[#DF91A5]"
                      }`}
                    >
                      {player.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                    {/* Actions */}

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          beginEditing(player)
                        }
                        disabled={busy}
                        title="Edit player"
                        aria-label={`Edit ${player.full_name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#365B86] bg-[#153354] text-[#9CC9FF] hover:bg-[#24507D] disabled:opacity-40"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void toggleActive(player)
                        }
                        disabled={busy}
                        className="h-9 rounded-lg border border-[#35516F] px-3 text-[10px] font-bold text-[#B2C8E2] hover:bg-[#1C3857] disabled:opacity-40"
                      >
                        {player.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void deletePlayer(player)
                        }
                        disabled={busy}
                        title="Delete player"
                        aria-label={`Delete ${player.full_name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#663849] bg-[#381F2D] text-[#F093A6] hover:bg-[#572738] disabled:opacity-40"
                      >
                        {deletingId === player.id ? (
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
                );
              })}
            </div>
          )}
        </section>

        {/* =============================================
            POSITION DISTRIBUTION
        ============================================= */}

        {!loading && players.length > 0 && (
          <section className="mt-7 overflow-hidden rounded-xl border border-[#233F60] bg-[#0B1B30] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <SlidersHorizontal
                size={15}
                className="text-[#80B9FF]"
              />

              <h2 className="font-heading text-sm font-black uppercase tracking-[0.08em]">
                Squad Composition
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {POSITION_ORDER.map((position) => {
                const theme =
                  POSITION_THEME[position];

                const count =
                  positionCounts[position];

                const percentage =
                  players.length > 0
                    ? (count / players.length) *
                      100
                    : 0;

                return (
                  <div key={position}>
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className="text-[11px] font-black"
                        style={{
                          color: theme.primary,
                        }}
                      >
                        {position}
                      </span>

                      <span className="font-mono text-[11px] font-bold text-white">
                        {count}
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-[#213852]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          background: theme.primary,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[10px] text-[#7594B8]">
                      {POSITIONS[position]}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =============================================
            FOOTER
        ============================================= */}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#213A57] pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={14}
              className="text-[#69AFFF]"
            />

            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7897BA]">
              FOOTBALLCUP / SQUAD ADMINISTRATION
            </span>
          </div>

          <Link
            href="/admin/teams"
            className="inline-flex items-center gap-2 text-[11px] font-bold text-[#8DC0FF] transition hover:text-white"
          >
            Manage Clubs
            <ArrowRight size={13} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
