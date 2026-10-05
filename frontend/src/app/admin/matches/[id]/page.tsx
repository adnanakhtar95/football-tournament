
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
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
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Flag,
  LoaderCircle,
  MapPin,
  Medal,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  Square,
  Target,
  Trophy,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
  Pause,
  Timer,
} from "lucide-react";

/*   CONFIGURATION */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-[#2C4A6C] bg-[#09182B] px-3.5 text-[12px] text-white outline-none transition placeholder:text-[#64809E] focus:border-[#398EFF] focus:ring-2 focus:ring-[#398EFF]/15 disabled:cursor-not-allowed disabled:opacity-40";

const labelClass =
  "mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-[#98B5D6]";

/* =========================================================
   TYPES
========================================================= */

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
  is_active: boolean;
}
interface ShootoutKick {
  id: number;
  team: number;
  player: number | null;
  player_name: string;
  kick_number: number;
  scored: boolean;
  created_at: string;
}

interface ShootoutState {
  home_score: number;
  away_score: number;

  home_taken: number;
  away_taken: number;

  next_team_id: number | null;

  winner_id: number | null;
  is_finished: boolean;
}
interface ShootoutResponse {
  match_id: number;
  is_knockout: boolean;
  match_status: Match["status"];
  phase: Match["phase"];

  regular_score: {
    home: number;
    away: number;
  };

  shootout: ShootoutState;
  kicks: ShootoutKick[];
}
interface Match {
  id: number;
  round: number;
  home_team: number;
  away_team: number;
  scheduled_at: string;
  venue: string;

  status: "scheduled" | "live" | "finished";

  started_at: string | null;
  ended_at: string | null;

  home_score: number;
  away_score: number;

  // Match lifecycle
  is_knockout: boolean;
  is_paused: boolean;
  paused_at: string | null;
  total_paused_seconds: number;

  phase:
  | "not_started"
  | "first_half"
  | "half_time"
  | "second_half"
  | "regulation_ended"
  | "extra_time_first_half"
  | "extra_time_interval"
  | "extra_time_second_half"
  | "penalty_shootout"
  | "full_time";

  clock_seconds: number;

  // Regulation
  regulation_elapsed_seconds: number;

  first_half_elapsed_seconds: number;
  first_half_stoppage_minutes: number;
  first_half_ended_at: string | null;

  second_half_started_at: string | null;
  second_half_stoppage_minutes: number;
  second_half_pause_baseline_seconds: number;

  // Existing stoppage-time field
  extra_time_minutes: number;

  // Extra-time lifecycle
  extra_time_first_half_started_at: string | null;
  extra_time_first_half_elapsed_seconds: number;
  extra_time_first_half_ended_at: string | null;

  extra_time_second_half_started_at: string | null;

  extra_time_pause_baseline_seconds: number;
  extra_time_second_half_pause_baseline_seconds: number;

  extra_time_elapsed_seconds: number;

  // Penalty shootout
  shootout?: ShootoutState | null;
  shootout_kicks?: ShootoutKick[];
}

interface EventTeam {
  id: number;
  event_id?: number;
  team_id: number;
  team: Team;
}

type MatchEventType =
  | "goal"
  | "foul"
  | "chance"
  | "save"

  | "yellow_card"
  | "red_card"
  | "penalty_kick"
  | "reward"
  | "match_started"
  | "match_paused"
  | "match_resumed"
  | "extra_time"
  | "half_time"
  | "second_half_started"
  | "regulation_ended"
  | "extra_time_started"
  | "extra_time_half_time"
  | "extra_time_second_half_started"
  | "extra_time_ended"
  | "penalty_shootout_started"
  | "penalty_shootout_finished"
  | "match_finished";

type OtherEventType = | "foul" | "chance" | "save" | "yellow_card" | "red_card" | "penalty_kick" | "reward";

interface MatchEvent {
  id: number;
  team: Team | number | null;
  type: MatchEventType;
  player_name: string;
  minute: number;
  points: number;
  note: string;
  created_at: string;
}


interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;

  status?: Match["status"];

  home_score?: number;
  away_score?: number;

  is_paused?: boolean;
  paused_at?: string | null;
  total_paused_seconds?: number;
  extra_time_minutes?: number;
  phase?: Match["phase"];
  clock_seconds?: number;
  first_half_elapsed_seconds?: number;
  first_half_stoppage_minutes?: number;
  first_half_ended_at?: string | null;
  second_half_started_at?: string | null;
  second_half_stoppage_minutes?: number;
  second_half_pause_baseline_seconds?: number;
  is_knockout?: boolean;

  regulation_elapsed_seconds?: number;

  extra_time_first_half_started_at?: string | null;
  extra_time_first_half_elapsed_seconds?: number;
  extra_time_first_half_ended_at?: string | null;

  extra_time_second_half_started_at?: string | null;

  extra_time_pause_baseline_seconds?: number;
  extra_time_second_half_pause_baseline_seconds?: number;

  extra_time_elapsed_seconds?: number;

  shootout?: ShootoutState | null;
  shootout_kicks?: ShootoutKick[];

  started_at?: string | null;
  ended_at?: string | null;

  match_event?: {
    id: number;
    team_id: number | null;
    type: MatchEventType;
    player_name: string;
    player_id?: number | null;
    minute: number;
    points: number;
    note: string;
  };
}


/*   API HELPERS  */

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
      "CSRF token was not found. Please refresh."
    );
  }

  return token;
}

async function readJson(
  response: Response
): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON from ${response.url} (HTTP ${response.status}).`
    );
  }
}

function apiError(
  data: unknown,
  fallback: string
): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const record = data as Record<string, unknown>;

  if (typeof record.detail === "string") {
    return record.detail;
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  return (
    Object.entries(record)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value);

        return `${key}: ${message}`;
      })
      .join(" | ") || fallback
  );
}

async function fetchAllPages<T>(
  initialUrl: string
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
    });

    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        apiError(data, "Unable to load records.")
      );
    }

    if (Array.isArray(data)) {
      items.push(...(data as T[]));
      nextUrl = null;
    } else {
      const result = data as {
        results?: T[];
        next?: string | null;
      };

      items.push(...(result.results ?? []));

      nextUrl = result.next
        ? new URL(
          result.next,
          currentUrl
        ).toString()
        : null;
    }
  }

  return items;
}

/* =========================================================
   DISPLAY HELPERS
========================================================= */

function formatDate(
  value: string | null
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    return `http:${value}`;
  }

  return `${origin}/${value.replace(/^\/+/, "")}`;
}

function eventLabel(
  type: MatchEventType
): string {
  const labels: Record<MatchEventType, string> = {
    
    goal: "Goal Scored",
    foul: "Foul",
    
    chance: "CHANCE!",
    save: "SAVE!",

    yellow_card: "Yellow Card",
    red_card: "Red Card",
    penalty_kick: "Penalty Kick",
    reward: "Bonus Reward",
    match_started: "Kickoff",
    match_paused: "Match Paused",
    match_resumed: "Match Resumed",
    extra_time: "Stoppage Time Announced",
    half_time: "Half Time",
    second_half_started: "Second Half Kickoff",
    regulation_ended: "Regulation Ended",
    match_finished: "Full Time",

    extra_time_started: "Extra Time Started",
    extra_time_half_time: "Extra Time Half Time",
    extra_time_second_half_started: "Extra Time Second Half",
    extra_time_ended: "Extra Time Ended",
    penalty_shootout_started: "Penalty Shootout Started",
    penalty_shootout_finished: "Penalty Shootout Finished",
  };

  return labels[type];
}

function EventSymbol({
  type,
  size = 17,
}: {
  type: MatchEventType;
  size?: number;
}) {
  switch (type) {
    case "foul":
      return <ShieldAlert size={size} />;

    case "chance":
      return <Target size={size} />;

    case "save":
      return <Shield size={size} />;
    case "goal":
      return <CircleDot size={size} />;
    case "yellow_card":
      return (
        <span
          className="inline-block rounded-[2px] bg-[#F5C66C]"
          style={{
            width: size * 0.65,
            height: size,
          }}
        />
      );
    case "red_card":
      return (
        <span
          className="inline-block rounded-[2px] bg-[#EF6672]"
          style={{
            width: size * 0.65,
            height: size,
          }}
        />
      );
    case "penalty_kick":
      return <Target size={size} />;
    case "reward":
      return <Medal size={size} />;
    default:
      return <Flag size={size} />;
  }
}

function eventColor(
  type: MatchEventType
): string {
  switch (type) {
    case "foul":
      return "#924f1f";
    case "chance":
      return "#62B0FF";

    case "save":
      return "#66C7A5";
    case "goal":
      return "#58A6FF";
    case "yellow_card":
      return "#F5C66C";
    case "red_card":
      return "#EF6672";
    case "penalty_kick":
      return "#AE8BFF";
    case "reward":
      return "#E8BD77";
    default:
      return "#E8BD77";
  }
}

function TeamCrest({
  team,
  size = 65,
}: {
  team?: Team;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const logo = resolveLogo(team?.logo);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#47709C] bg-[#112C4A] p-2 shadow-[0_0_25px_rgba(49,121,213,.12)]"
      style={{
        width: size,
        height: size,
      }}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={team?.name ?? "Team crest"}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Shield
          size={size * 0.45}
          className="text-[#A2CBFA]"
        />
      )}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function MatchControlPage() {
  const params = useParams();
  const matchId = String(params.id ?? "");

  const [match, setMatch] =
    useState<Match | null>(null);

  const [events, setEvents] =
    useState<MatchEvent[]>([]);

  const [eventTeams, setEventTeams] =
    useState<EventTeam[]>([]);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [activePanel, setActivePanel] = useState<
    "goal" | "event"
  >("goal");

  // Goal form
  const [goalTeam, setGoalTeam] = useState("");
  const [goalPlayer, setGoalPlayer] = useState("");
  const [goalPlayerId, setGoalPlayerId] =
    useState("");


  // Other event form
  const [eventTeam, setEventTeam] = useState("");
  const [eventType, setEventType] =
    useState<OtherEventType>("yellow_card");

  const [eventPlayer, setEventPlayer] =
    useState("");
  const [eventPlayerId, setEventPlayerId] = useState("");

  const [eventPoints, setEventPoints] =
    useState("");
  const [eventNote, setEventNote] =
    useState("");

  const refreshSequence = useRef(0);

  const [clockNow, setClockNow] = useState(
    () => Date.now()
  );

  const [extraTimeInput, setExtraTimeInput] =
    useState("");

  // Penalty shootout form
  const [shootoutPlayerId, setShootoutPlayerId] =
    useState("");

  const [shootoutPlayerName, setShootoutPlayerName] =
    useState("");
  // Update the displayed clock once per second.
  // This does not make additional API requests.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Clock follows the authoritative phase and timing anchors from Django.
  // Half-time and full-time never advance, even after a page refresh.
  const elapsedSeconds = useMemo(() => {
  if (!match || !match.started_at) {
    return 0;
  }

  // ==========================================
  // PHASES WHERE THE CLOCK MUST BE FROZEN
  // ==========================================

  if (match.phase === "not_started") {
    return 0;
  }

  // Normal half-time.
  // Keep the clock frozen until second half starts.
  if (match.phase === "half_time") {
    return Math.max(
      match.first_half_elapsed_seconds ?? 0,
      45 * 60
    );
  }

  // Regulation has ended.
  // Keep the clock frozen until ET starts / match finishes.
  if (match.phase === "regulation_ended") {
    return Math.max(
      match.regulation_elapsed_seconds ?? 0,
      match.clock_seconds ?? 0,
      90 * 60
    );
  }

  // ET half-time.
  // extra_time_first_half_elapsed_seconds is ONLY
  // the duration of ET first half, so add the 90-minute base.
  if (match.phase === "extra_time_interval") {
    return Math.max(
      90 * 60 +
        (match.extra_time_first_half_elapsed_seconds ?? 0),
      105 * 60
    );
  }

  // Penalty shootout.
  // Football clock no longer runs.
  if (match.phase === "penalty_shootout") {
    return Math.max(
      match.extra_time_elapsed_seconds ?? 0,
      match.clock_seconds ?? 0,
      120 * 60
    );
  }

  // Finished match.
  if (
    match.phase === "full_time" ||
    match.status === "finished"
  ) {
    return Math.max(
      match.clock_seconds ?? 0,
      match.extra_time_elapsed_seconds ?? 0
    );
  }

  // ==========================================
  // LIVE PHASES
  // ==========================================

  const referenceTime =
    match.is_paused && match.paused_at
      ? new Date(match.paused_at).getTime()
      : clockNow;

  // ------------------------------------------
  // FIRST HALF
  // ------------------------------------------

  if (match.phase === "first_half") {
    const startedAt = new Date(
      match.started_at
    ).getTime();

    return Math.max(
      0,
      Math.floor(
        (referenceTime - startedAt) / 1000
      ) - (match.total_paused_seconds ?? 0)
    );
  }

  // ------------------------------------------
  // SECOND HALF
  // ------------------------------------------

  if (match.phase === "second_half") {
    if (!match.second_half_started_at) {
      return 45 * 60;
    }

    const startedAt = new Date(
      match.second_half_started_at
    ).getTime();

    const phasePausedSeconds = Math.max(
      0,
      (match.total_paused_seconds ?? 0) -
        (match.second_half_pause_baseline_seconds ?? 0)
    );

    return (
      45 * 60 +
      Math.max(
        0,
        Math.floor(
          (referenceTime - startedAt) / 1000
        ) - phasePausedSeconds
      )
    );
  }

  // ------------------------------------------
  // EXTRA TIME - FIRST HALF
  // ------------------------------------------

  if (match.phase === "extra_time_first_half") {
    if (!match.extra_time_first_half_started_at) {
      return 90 * 60;
    }

    const startedAt = new Date(
      match.extra_time_first_half_started_at
    ).getTime();

    const phasePausedSeconds = Math.max(
      0,
      (match.total_paused_seconds ?? 0) -
        (match.extra_time_pause_baseline_seconds ?? 0)
    );

    return (
      90 * 60 +
      Math.max(
        0,
        Math.floor(
          (referenceTime - startedAt) / 1000
        ) - phasePausedSeconds
      )
    );
  }

  // ------------------------------------------
  // EXTRA TIME - SECOND HALF
  // ------------------------------------------

  if (match.phase === "extra_time_second_half") {
    if (!match.extra_time_second_half_started_at) {
      return 105 * 60;
    }

    const startedAt = new Date(
      match.extra_time_second_half_started_at
    ).getTime();

    const phasePausedSeconds = Math.max(
      0,
      (match.total_paused_seconds ?? 0) -
        (
          match.extra_time_second_half_pause_baseline_seconds ??
          0
        )
    );

    return (
      105 * 60 +
      Math.max(
        0,
        Math.floor(
          (referenceTime - startedAt) / 1000
        ) - phasePausedSeconds
      )
    );
  }

  return match.clock_seconds ?? 0;
}, [match, clockNow]);
  const liveEventMinute = Math.floor(elapsedSeconds / 60);
  const isPlaying =
    match?.status === "live" &&
    (
      match.phase === "first_half" ||
      match.phase === "second_half" ||
      match.phase === "extra_time_first_half" ||
      match.phase === "extra_time_second_half"
    );
  const systemEventTypes = new Set<MatchEventType>([
    "match_started",
    "match_paused",
    "match_resumed",
    "extra_time",
    "half_time",
    "second_half_started",
    "regulation_ended",

    "extra_time_started",
    "extra_time_half_time",
    "extra_time_second_half_started",
    "extra_time_ended",

    "penalty_shootout_started",
    "penalty_shootout_finished",

    "match_finished",
  ]);
  const eventTeamId = (team: MatchEvent["team"]): number | null =>
    typeof team === "number" ? team : team?.id ?? null;

  const clockDisplay = useMemo(() => {
    const minutes = Math.floor(
      elapsedSeconds / 60
    );

    const seconds = elapsedSeconds % 60;

    return (
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`
    );
  }, [elapsedSeconds]);

  /* REFRESH MATCH  */

  const refresh = useCallback(
    async (showLoading = false) => {
      if (!matchId) return;

      const requestId = ++refreshSequence.current;

      if (showLoading) {
        setRefreshing(true);
      }

      try {
        const matchResponse = await fetch(
          `${API_BASE_URL}/admin/matches/${matchId}/`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const matchData =
          await readJson(matchResponse);

        if (!matchResponse.ok) {
          throw new Error(
            apiError(
              matchData,
              "Unable to load match."
            )
          );
        }

        const loadedMatch = matchData as Match;
        let loadedShootout: ShootoutResponse | null = null;

        if (
  loadedMatch.is_knockout &&
  (
    loadedMatch.phase === "penalty_shootout" ||
    loadedMatch.phase === "full_time" ||
    loadedMatch.status === "finished" ||
    loadedMatch.shootout ||
    (loadedMatch.shootout_kicks?.length ?? 0) > 0
  )
) {
          const shootoutResponse = await fetch(
            `${API_BASE_URL}/matches/${matchId}/shootout/`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

          const shootoutData =
            await readJson(shootoutResponse);

          if (!shootoutResponse.ok) {
            throw new Error(
              apiError(
                shootoutData,
                "Unable to load penalty shootout."
              )
            );
          }

          loadedShootout =
            shootoutData as ShootoutResponse;
        }

        const [
          loadedEvents,
          roundResponse,
          homePlayers,
          awayPlayers,
        ] = await Promise.all([
          fetchAllPages<MatchEvent>(
            `${API_BASE_URL}/matches/${matchId}/events/`
          ),

          fetch(
            `${API_BASE_URL}/admin/rounds/${loadedMatch.round}/`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          ),

          fetchAllPages<Player>(
            `${API_BASE_URL}/players/?team=${loadedMatch.home_team}`
          ),

          fetchAllPages<Player>(
            `${API_BASE_URL}/players/?team=${loadedMatch.away_team}`
          ),
        ]);

        if (!roundResponse.ok) {
          throw new Error(
            "Unable to load the match round."
          );
        }

        const roundData = (
          await readJson(roundResponse)
        ) as {
          id: number;
          event: number;
        };

        const registrations =
          await fetchAllPages<EventTeam>(
            `${API_BASE_URL}/admin/event-teams/?event_id=${roundData.event}`
          );

        if (
          requestId !== refreshSequence.current
        ) {
          return;
        }

        setMatch({
          ...loadedMatch,

          shootout:
            loadedShootout?.shootout ??
            loadedMatch.shootout ??
            null,

          shootout_kicks:
            loadedShootout?.kicks ??
            loadedMatch.shootout_kicks ??
            [],
        });
        setEvents(loadedEvents);

        setPlayers(
          [...homePlayers, ...awayPlayers].filter(
            (player, index, all) =>
              all.findIndex(
                (item) => item.id === player.id
              ) === index
          )
        );

        setEventTeams(
          registrations.filter(
            (item) =>
              item.event_id === undefined ||
              item.event_id === roundData.event
          )
        );

        setError("");
      } catch (err) {
        if (
          requestId === refreshSequence.current
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to refresh match."
          );
        }
      } finally {
        if (
          requestId === refreshSequence.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [matchId]
  );

  /* ======================================================
     REALTIME WEBSOCKET
  ====================================================== */

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    let reconnectTimer:
      | ReturnType<typeof setTimeout>
      | null = null;

    let refreshTimer:
      | ReturnType<typeof setTimeout>
      | null = null;

    void refresh();

    function scheduleRefresh() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (active) {
          void refresh();
        }
      }, 300);
    }

    function connect() {
      if (!active || !matchId) return;

      const backendUrl = new URL(
        API_BASE_URL
      );

      const protocol =
        backendUrl.protocol === "https:"
          ? "wss:"
          : "ws:";

      const socketUrl =
        `${protocol}//${backendUrl.host}` +
        `/ws/matches/${matchId}/`;

      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        if (!active) return;

        setSocketConnected(true);
        scheduleRefresh();
      };

      socket.onmessage = (message) => {
        if (!active) return;

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          if (data.type === "connection") {
            return;
          }

          if (
            data.match_id !== undefined &&
            data.match_id !== Number(matchId)
          ) {
            return;
          }

          // setMatch((current) => {
          //   if (!current) return current;

          //   return {
          //     ...current,
          //     status:
          //       data.status ?? current.status,
          //     home_score:
          //       data.home_score ??
          //       current.home_score,
          //     away_score:
          //       data.away_score ??
          //       current.away_score,
          //   };
          // });

          setMatch((current) => {
            if (!current) return current;

            return {
              ...current,

              status:
                data.status ?? current.status,

              home_score:
                data.home_score ??
                current.home_score,

              away_score:
                data.away_score ??
                current.away_score,

              is_paused:
                data.is_paused ??
                current.is_paused,

              paused_at:
                data.paused_at !== undefined
                  ? data.paused_at
                  : current.paused_at,

              total_paused_seconds:
                data.total_paused_seconds ??
                current.total_paused_seconds,

              extra_time_minutes:
                data.extra_time_minutes ??
                current.extra_time_minutes,
              phase: data.phase ?? current.phase,
              clock_seconds: data.clock_seconds ?? current.clock_seconds,
              first_half_elapsed_seconds: data.first_half_elapsed_seconds ?? current.first_half_elapsed_seconds,
              first_half_stoppage_minutes: data.first_half_stoppage_minutes ?? current.first_half_stoppage_minutes,
              first_half_ended_at: data.first_half_ended_at !== undefined ? data.first_half_ended_at : current.first_half_ended_at,
              second_half_started_at: data.second_half_started_at !== undefined ? data.second_half_started_at : current.second_half_started_at,
              second_half_stoppage_minutes: data.second_half_stoppage_minutes ?? current.second_half_stoppage_minutes,
              second_half_pause_baseline_seconds:
                data.second_half_pause_baseline_seconds ??
                current.second_half_pause_baseline_seconds,

              is_knockout:
                data.is_knockout ??
                current.is_knockout,

              regulation_elapsed_seconds:
                data.regulation_elapsed_seconds ??
                current.regulation_elapsed_seconds,

              extra_time_first_half_started_at:
                data.extra_time_first_half_started_at !== undefined
                  ? data.extra_time_first_half_started_at
                  : current.extra_time_first_half_started_at,

              extra_time_first_half_elapsed_seconds:
                data.extra_time_first_half_elapsed_seconds ??
                current.extra_time_first_half_elapsed_seconds,

              extra_time_first_half_ended_at:
                data.extra_time_first_half_ended_at !== undefined
                  ? data.extra_time_first_half_ended_at
                  : current.extra_time_first_half_ended_at,

              extra_time_second_half_started_at:
                data.extra_time_second_half_started_at !== undefined
                  ? data.extra_time_second_half_started_at
                  : current.extra_time_second_half_started_at,

              extra_time_pause_baseline_seconds:
                data.extra_time_pause_baseline_seconds ??
                current.extra_time_pause_baseline_seconds,

              extra_time_second_half_pause_baseline_seconds:
                data.extra_time_second_half_pause_baseline_seconds ??
                current.extra_time_second_half_pause_baseline_seconds,

              extra_time_elapsed_seconds:
                data.extra_time_elapsed_seconds ??
                current.extra_time_elapsed_seconds,

              shootout:
                data.shootout !== undefined
                  ? data.shootout
                  : current.shootout,

              shootout_kicks:
                data.shootout_kicks !== undefined
                  ? data.shootout_kicks
                  : current.shootout_kicks,

              started_at:
                data.started_at !== undefined
                  ? data.started_at
                  : current.started_at,

              ended_at:
                data.ended_at !== undefined
                  ? data.ended_at
                  : current.ended_at,
            };
          });


          if (data.match_event) {
            const incoming = data.match_event;

            setEvents((current) => {
              if (
                current.some(
                  (event) =>
                    event.id === incoming.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                {
                  id: incoming.id,
                  team: incoming.team_id,
                  type: incoming.type,
                  player_name:
                    incoming.player_name,
                  minute: incoming.minute,
                  points: incoming.points,
                  note: incoming.note,
                  created_at:
                    new Date().toISOString(),
                },
              ];
            });
          }

          scheduleRefresh();
        } catch (err) {
          console.error(
            "WebSocket message error:",
            err
          );
        }
      };

      socket.onclose = () => {
        if (!active) return;

        setSocketConnected(false);

        reconnectTimer = setTimeout(
          connect,
          3000
        );
      };

      socket.onerror = () => {
        if (!active) return;
        setSocketConnected(false);
      };
    }

    connect();

    return () => {
      active = false;

      refreshSequence.current += 1;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      socket?.close();
    };
  }, [matchId, refresh]);

  /* ======================================================
     DERIVED DATA
  ====================================================== */

  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();

    for (const registration of eventTeams) {
      map.set(
        registration.team_id,
        registration.team
      );
    }

    return map;
  }, [eventTeams]);

  const timeline = useMemo(
    () =>
      [...events].sort((a, b) => a.id - b.id),
    [events]
  );

  const goalCount = events.filter(
    (event) => event.type === "goal"
  ).length;

  const cardCount = events.filter(
    (event) =>
      event.type === "yellow_card" ||
      event.type === "red_card"
  ).length;

  const homeTeam = match
    ? teamMap.get(match.home_team)
    : undefined;

  const awayTeam = match
    ? teamMap.get(match.away_team)
    : undefined;

  const homeName =
    homeTeam?.name ??
    (match
      ? `Team #${match.home_team}`
      : "Home Team");

  const hasShootoutResult = Boolean(
    match?.shootout?.is_finished  &&
    match.shootout.winner_id
  );
  

  const awayName =
    awayTeam?.name ??
    (match
      ? `Team #${match.away_team}`
      : "Away Team");

  const goalPlayers = useMemo(
    () =>
      players
        .filter(
          (player) =>
            player.is_active &&
            player.team.id === Number(goalTeam)
        )
        .sort(
          (a, b) =>
            a.jersey_number -
            b.jersey_number
        ),
    [players, goalTeam]
  );
  const shootoutHomeScore =
    match?.shootout?.home_score ?? 0;

  const shootoutAwayScore =
    match?.shootout?.away_score ?? 0;

  const shootoutWinnerName =
  match?.shootout?.winner_id === match?.home_team
    ? homeName
    : match?.shootout?.winner_id === match?.away_team
      ? awayName
      : null; 
  // Use the same loaded registered-player data as the Goal tab.
  const eventPlayers = useMemo(
    () =>
      players
        .filter(
          (player) =>
            player.is_active &&
            player.team.id === Number(eventTeam)
        )
        .sort((a, b) => a.jersey_number - b.jersey_number),
    [players, eventTeam]
  );

  const shootoutNextTeamId =
    match?.shootout?.next_team_id ?? null;

  const shootoutPlayers = useMemo(() => {
    if (!shootoutNextTeamId) return [];

    return players
      .filter(
        (player) =>
          player.is_active &&
          player.team.id === shootoutNextTeamId
      )
      .sort(
        (a, b) =>
          a.jersey_number - b.jersey_number
      );
  }, [players, shootoutNextTeamId]);

  const shootoutNextTeam =
    shootoutNextTeamId !== null
      ? teamMap.get(shootoutNextTeamId)
      : undefined;

  const shootoutNextTeamName =
    shootoutNextTeamId === match?.home_team
      ? homeName
      : shootoutNextTeamId === match?.away_team
        ? awayName
        : shootoutNextTeam?.name ?? "Awaiting team";

  function teamName(teamId: number): string {
    return (
      teamMap.get(teamId)?.name ??
      `Team #${teamId}`
    );
  }

  /* ======================================================
     API ACTIONS
  ====================================================== */

  async function performAction(
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<boolean> {
    if (actionLoading) return false;
    if (match?.status === "finished" || match?.phase === "full_time") {
      setError("This match is completed. Its official record is read-only.");
      return false;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const csrfToken =
        await getCsrfToken();

      const response = await fetch(
        `${API_BASE_URL}/matches/${matchId}/${endpoint}/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify(body ?? {}),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(
            data,
            "Unable to perform match action."
          )
        );
      }

      await refresh();

      setSuccess(
        endpoint === "half-time"
          ? "Half time confirmed."
          : endpoint === "second-half"
            ? "Second half started."
            : endpoint === "start"
              ? "Match started successfully."
              : endpoint === "finish"
                ? "Match finished successfully."
                : endpoint === "goal"
                  ? "Goal recorded successfully."
                  : endpoint === "end-regulation"
                    ? "Regulation ended."
                    : endpoint === "start-extra-time"
                      ? "Extra time started."
                      : endpoint === "extra-time-half-time"
                        ? "Extra-time first half ended."
                        : endpoint === "extra-time-second-half"
                          ? "Extra-time second half started."
                          : endpoint === "end-extra-time"
                            ? "Extra time ended."
                            : endpoint === "shootout/kick"
                              ? "Penalty shootout kick recorded successfully."
                              : "Match event recorded successfully."
      );
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Match action failed."
      );

      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStart() {
    await performAction("start");
  }

  async function handleHalfTime() {
    if (!window.confirm("Blow the half-time whistle? The clock will freeze until you start the second half.")) return;
    await performAction("half-time");
  }

  async function handleSecondHalf() {
    await performAction("second-half");
  }

  async function handleEndRegulation() {
    if (
      !window.confirm(
        "End regulation time? The match will move to the regulation-ended state."
      )
    ) {
      return;
    }

    await performAction("end-regulation");
  }

  async function handleStartExtraTime() {
    await performAction("start-extra-time");
  }

  async function handleExtraTimeHalfTime() {
    if (
      !window.confirm(
        "End the first half of extra time?"
      )
    ) {
      return;
    }

    await performAction("extra-time-half-time");
  }

  async function handleExtraTimeSecondHalf() {
    await performAction("extra-time-second-half");
  }

  async function handleEndExtraTime() {
    if (
      !window.confirm(
        "End extra time? If the score is still tied, the match will proceed to penalties."
      )
    ) {
      return;
    }

    await performAction("end-extra-time");
  }

  async function handleShootoutKick(scored: boolean) {
    if (!match) return;

    if (match.phase !== "penalty_shootout") {
      setError(
        "Penalty kicks can only be recorded during the penalty shootout."
      );
      return;
    }

    const teamId = match.shootout?.next_team_id;

    if (!teamId) {
      setError(
        "Unable to determine which team should take the next penalty."
      );
      return;
    }

    if (match.shootout?.is_finished) {
      setError(
        "The penalty shootout is already finished."
      );
      return;
    }

    const confirmed = window.confirm(
      `${scored ? "Record GOAL" : "Record MISS"} for ${shootoutNextTeamName}?`
    );

    if (!confirmed) return;

    const successful = await performAction(
      "shootout/kick",
      {
        team_id: teamId,
        scored,

        ...(shootoutPlayerId
          ? {
            player_id: Number(shootoutPlayerId),
          }
          : shootoutPlayerName.trim()
            ? {
              player_name:
                shootoutPlayerName.trim(),
            }
            : {}),
      }
    );

    if (successful) {
      setShootoutPlayerId("");
      setShootoutPlayerName("");
    }
  }

  async function handleFinish() {
    const confirmed = window.confirm(
      "Finish this match? No further goals or match events can be added afterward."
    );

    if (!confirmed) return;

    await performAction("finish");
  }


  async function handlePause() {
    await performAction("pause");
  }

  async function handleResume() {
    await performAction("resume");
  }

  async function handleExtraTime() {
    if (!isPlaying || match?.is_paused) {
      setError("Stoppage time can only be changed during active play.");
      return;
    }
    if (!extraTimeInput.trim()) {
      setError("Please enter extra time in minutes.");
      return;
    }

    const minutes = Number(extraTimeInput);

    if (
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > 30
    ) {
      setError(
        "Extra time must be between 0 and 30 minutes."
      );
      return;
    }

    const successful = await performAction(
      "extra-time",
      { minutes }
    );

    if (successful) {
      setExtraTimeInput("");
    }
  }


  async function handleGoal() {
    if (!goalTeam) {
      setError(
        "Please select the scoring team."
      );
      return;
    }

    if (!isPlaying || match?.is_paused || match?.status === "finished") {
      setError("Goals can only be recorded during active play.");
      return;
    }

    const successful = await performAction(
      "goal",
      {
        team_id: Number(goalTeam),
        player_name: goalPlayerId
          ? ""
          : goalPlayer.trim(),
        ...(goalPlayerId
          ? {
            player_id:
              Number(goalPlayerId),
          }
          : {}),
        minute: liveEventMinute,
      }
    );

    if (successful) {
      setGoalPlayer("");
      setGoalPlayerId("");

    }
  }

  async function handleEvent() {
    if (!eventTeam) {
      setError("Please select a team.");
      return;
    }

    if (!isPlaying || match?.is_paused || match?.status === "finished") {
      setError("Events can only be recorded during active play.");
      return;
    }

    if (
      eventType === "reward" &&
      (!eventPoints.trim() ||
        !Number.isInteger(
          Number(eventPoints)
        ) ||
        Number(eventPoints) <= 0)
    ) {
      setError(
        "Reward points must be a positive whole number."
      );
      return;
    }

    if (
      eventType === "reward" &&
      !eventNote.trim()
    ) {
      setError(
        "Please enter a reason for the reward."
      );
      return;
    }

    const body: Record<string, unknown> = {
      team_id: Number(eventTeam),
      event_type: eventType,
      // The existing match-event API accepts player_name, not player_id.
      // Resolve a selected registered player to their official name.
      player_name: eventPlayerId
        ? eventPlayers.find((player) => player.id === Number(eventPlayerId))?.full_name ?? ""
        : eventPlayer.trim(),
      ...(eventPlayerId
        ? { player_id: Number(eventPlayerId) }
        : {}),
      minute: liveEventMinute,
      note: eventNote.trim(),
    };

    if (eventType === "reward") {
      body.points = Number(eventPoints);
    }

    const successful =
      await performAction("event", body);

    if (successful) {
      setEventPlayer("");
      setEventPlayerId("");

      setEventPoints("");
      setEventNote("");
    }
  }

  /* ======================================================
     LOADING / ERROR
  ====================================================== */

  if (loading) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#050D19] text-white">
        <div className="text-center">
          <LoaderCircle
            size={37}
            className="mx-auto animate-spin text-[#398EFF]"
          />

          <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#8CACD0]">
            Initializing Match Control
          </p>
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="min-h-[75vh] bg-[#050D19] p-5 text-white sm:p-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-2 text-[12px] font-bold text-[#82B8FF]"
          >
            <ArrowLeft size={15} />
            Back to Matches
          </Link>

          <div className="mt-8 rounded-xl border border-[#754257] bg-[#291C2C] p-7">
            <AlertCircle
              size={28}
              className="text-[#FF92A6]"
            />

            <h1 className="font-heading mt-4 text-2xl font-black uppercase">
              Unable to Load Match
            </h1>

            <p className="mt-3 text-[12px] text-[#F2B1BF]">
              {error || "Match not found."}
            </p>

            <button
              type="button"
              onClick={() =>
                void refresh(true)
              }
              className="mt-6 rounded-lg bg-[#267FFF] px-5 py-3 text-[11px] font-black text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isScheduled =
    match.status === "scheduled";

  const isLive =
    match.status === "live";

  const isFinished =
    match.status === "finished" || match.phase === "full_time";

  const currentStoppageMinutes = match.phase === "first_half"
    ? match.first_half_stoppage_minutes
    : match.phase === "second_half"
      ? match.second_half_stoppage_minutes
      : 0;

  const formDisabled =
    !isPlaying || match.is_paused || actionLoading;

  /* PAGE  */

  return (
    <main className="min-h-full min-w-0 bg-[#050D19] font-body text-white">
      <div className="mx-auto max-w-[1700px] px-4 pb-16 pt-7 sm:px-6 xl:px-9">

        {/* NAVIGATION */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-2 text-[11px] font-bold text-[#8CB7E8] transition hover:text-white"
          >
            <ArrowLeft size={15} />
            Match Operations
            <span className="text-[#4D7197]">
              /
            </span>
            <span className="text-white">
              Fixture #{match.id}
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-wider ${socketConnected
                  ? "border-[#376CA2] bg-[#123455] text-[#92C6FF]"
                  : "border-[#6C5361] bg-[#302532] text-[#BDA8B6]"
                }`}
            >
              {socketConnected ? (
                <Wifi size={13} />
              ) : (
                <WifiOff size={13} />
              )}

              <span className="hidden sm:inline">
                {socketConnected
                  ? "Realtime Connected"
                  : "Reconnecting"}
              </span>

              <span className="sm:hidden">
                {socketConnected
                  ? "Online"
                  : "Offline"}
              </span>
            </span>

            <button
              type="button"
              onClick={() =>
                void refresh(true)
              }
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#355778] bg-[#112942] px-3 text-[10px] font-bold text-[#A9CCF2] transition hover:border-[#4A96F0] disabled:opacity-40"
            >
              <RefreshCw
                size={13}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>
          </div>
        </div>

        {/* HEADER */}

        <header className="mb-6">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#72AEF8]">
            <Sparkles size={13} />
            Football Operations / Live Desk
          </p>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-[clamp(31px,4.4vw,55px)] font-black uppercase italic leading-none tracking-[-0.065em]">
                MATCH{" "}
                <span className="text-[#438FFF]">
                  CONTROL.
                </span>
              </h1>

              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#8EACCE]">
                <span className="flex items-center gap-1.5">
                  <Flag size={12} />
                  Fixture #{match.id}
                </span>

                <span className="flex items-center gap-1.5">
                  <MapPin size={12} />
                  {match.venue ||
                    "Venue not specified"}
                </span>
              </p>
            </div>

            <Link
              href={`/matches/${match.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#3B6590] bg-[#123153] px-4 text-[10px] font-black uppercase tracking-wider text-[#A6D0FF] transition hover:bg-[#204B77]"
            >
              Public Match View
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>

        {/* FEEDBACK */}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-[#9A4960] bg-[#401E2D] px-5 py-4 text-[12px] text-[#FFB5C3]"
          >
            <AlertCircle
              size={16}
              className="mt-0.5 shrink-0"
            />
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-[#3E79B5] bg-[#123658] px-5 py-4 text-[12px] text-[#B2D8FF]"
          >
            <Check
              size={16}
              className="mt-0.5 shrink-0"
            />
            {success}
          </div>
        )}

        {/* IMMERSIVE SCOREBOARD  */}

        <section className="relative isolate overflow-hidden rounded-xl border border-[#31577E] bg-[#091A2F]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=85')",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,16,31,.97),rgba(8,25,46,.72)_50%,rgba(5,16,31,.97))]" />

          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2B8EFF] via-[#9268FF] to-[#2B8EFF]" />

          <div className="relative">
            {/* SCOREBOARD TOP */}

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8ABEFF]">
                  Official Match Scoreboard
                </p>

                <p className="mt-1.5 text-[10px] text-[#B2C6DD]">
                  {formatDate(
                    match.scheduled_at
                  )}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] ${isLive
                    ? "border-[#A64B61] bg-[#562335] text-[#FFA0B1]"
                    : isFinished
                      ? "border-[#876B45] bg-[#3D3024] text-[#EAC68A]"
                      : "border-[#4278AD] bg-[#173C61] text-[#9CCEFF]"
                  }`}
              >
                {isLive && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF8098]" />
                )}

                {/* {isLive
                  ? "Live Broadcast"
                  : isFinished
                    ? "Full Time"
                    : "Scheduled"} */}

                {match.is_paused
                  ? "Match Paused"
                  : isLive
                    ? "Live Broadcast"
                    : isFinished
                      ? "Full Time"
                      : "Scheduled"}

              </span>
            </div>

            {/* TEAM SCORE */}

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(100px,.9fr)_minmax(0,1fr)] items-center gap-2 px-3 py-9 sm:gap-5 sm:px-10 sm:py-14">
              <div className="flex min-w-0 flex-col items-center text-center">
                <TeamCrest
                  key={`home-${homeTeam?.id}-${homeTeam?.logo}`}
                  team={homeTeam}
                  size={68}
                />

                <h2 className="font-heading mt-4 w-full break-words text-[clamp(12px,1.9vw,24px)] font-black uppercase leading-tight tracking-[-0.035em]">
                  {homeName}
                </h2>

                <p className="mt-2 text-[9px] font-black uppercase tracking-[0.17em] text-[#83A9D1]">
                  Home
                </p>
              </div>

              <div className="min-w-0 text-center">
                <p
                  className={`mb-3 text-[10px] font-black uppercase tracking-[0.2em] ${isLive
                      ? "text-[#FF92A6]"
                      : "text-[#83B6EF]"
                    }`}
                >
                  {isLive
                    ? "● Live"
                    : isFinished
                      ? "FT"
                      : "Kickoff"}
                </p>

                <div className="font-heading whitespace-nowrap text-[clamp(39px,7.3vw,105px)] font-black leading-none tabular-nums tracking-[-0.09em]">
                  {match.home_score}
                  <span className="mx-1.5 text-[#52769C] sm:mx-3">
                    :
                  </span>
                  {match.away_score}
                  
                </div>

                {hasShootoutResult && (
  <div className="mt-4">
    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#B5A6FF]">
      Penalties
    </p>

    <p className="font-heading mt-1 text-[24px] font-black tabular-nums text-[#D4C8FF]">
      {shootoutHomeScore}
      <span className="mx-2 text-[#756B9A]">:</span>
      {shootoutAwayScore}
    </p>

    {shootoutWinnerName && (
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#F0CE91]">
        {shootoutWinnerName} wins on penalties
      </p>
    )}
  </div>
)}

                <div className="mx-auto mt-5 h-[2px] w-12 bg-[#438FFF]" />

                <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#9EC8F7]">

                  {match.is_paused
                    ? "Match Temporarily Suspended"
                    : isLive
                      ? "Match in Progress"
                      : isFinished
                        ? "Result Confirmed"
                        : "Awaiting Kickoff"}

                </p>
              </div>

              <div className="flex min-w-0 flex-col items-center text-center">
                <TeamCrest
                  key={`away-${awayTeam?.id}-${awayTeam?.logo}`}
                  team={awayTeam}
                  size={68}
                />

                <h2 className="font-heading mt-4 w-full break-words text-[clamp(12px,1.9vw,24px)] font-black uppercase leading-tight tracking-[-0.035em]">
                  {awayName}
                </h2>

                <p className="mt-2 text-[9px] font-black uppercase tracking-[0.17em] text-[#83A9D1]">
                  Away
                </p>
              </div>
            </div>

            {/* MATCH LIFECYCLE */}

            {/* <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-[#071629]/80 px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-[#8FAECD]">
                <span className="flex items-center gap-1.5">
                  <Play size={11} />
                  Started:{" "}
                  {formatDate(match.started_at)}
                </span>

                <span className="flex items-center gap-1.5">
                  <Flag size={11} />
                  Finished:{" "}
                  {formatDate(match.ended_at)}
                </span>
              </div>

              <div>
                {isScheduled && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleStart()
                    }
                    disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#267FFF] px-6 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#4897FF] disabled:opacity-40"
                  >
                    {actionLoading ? (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Play
                        size={15}
                        fill="currentColor"
                      />
                    )}

                    Start Match
                  </button>
                )}

                {isLive && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleFinish()
                    }
                    disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A94D61] bg-[#6A293B] px-6 text-[11px] font-black uppercase tracking-wider text-[#FFE0E6] transition hover:bg-[#85364C] disabled:opacity-40"
                  >
                    {actionLoading ? (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Square
                        size={13}
                        fill="currentColor"
                      />
                    )}

                    Finish Match
                  </button>
                )}

                {isFinished && (
                  <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#8A704C] bg-[#3D3023] px-5 text-[11px] font-black uppercase tracking-wider text-[#E9C58B]">
                    <Check size={15} />
                    Match Completed
                  </span>
                )}
              </div>
            </div> */}

            {/* MATCH LIFECYCLE */}

            <div className="border-t border-white/10 bg-[#071629]/90 px-5 py-5 sm:px-7">

              {/* CLOCK AND MATCH INFORMATION */}

              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

                <div className="flex flex-wrap items-center gap-5">

                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#83A8CE]">
                      {match.phase.replaceAll("_", " ")} · Match Clock
                    </p>

                    <div className="flex items-center gap-2">
                      <Clock3
                        size={17}
                        className={
                          match.is_paused
                            ? "text-[#F5C66C]"
                            : "text-[#62A8FF]"
                        }
                      />

                      <span className="font-mono text-[26px] font-black tabular-nums text-white">
                        {clockDisplay}
                      </span>
                    </div>
                  </div>

                  {currentStoppageMinutes > 0 && (
                    <div className="rounded-lg border border-[#80663E] bg-[#352B1D] px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#C9A76F]">
                        Stoppage Time
                      </p>

                      <p className="mt-1 font-mono text-lg font-black text-[#F5D394]">
                        +{currentStoppageMinutes}&apos;
                      </p>
                    </div>
                  )}

                  {match.is_paused && (
                    <span className="inline-flex items-center gap-2 rounded-lg border border-[#A17C40] bg-[#40321E] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#F6D18B]">
                      <Pause size={13} />
                      Match Paused
                    </span>
                  )}

                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[#8FAECD]">

                  <span className="flex items-center gap-1.5">
                    <Play size={11} />
                    Started: {formatDate(match.started_at)}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Flag size={11} />
                    Finished: {formatDate(match.ended_at)}
                  </span>

                </div>
              </div>

              {isPlaying && !match.is_paused &&
                ((match.phase === "first_half" && elapsedSeconds >= 45 * 60) ||
                  (match.phase === "second_half" && elapsedSeconds >= 90 * 60)) && (
                  <div role="status" className="mb-4 rounded-lg border border-[#A78144] bg-[#40321E] px-4 py-3 text-[11px] font-semibold text-[#F6D18B]">
                    {match.phase === "first_half"
                      ? "45 minutes reached. Announce stoppage time or end the first half when the referee whistles."
                      : "90 minutes reached. Announce stoppage time or finish the match when the referee whistles."}
                  </div>
                )}

              {isFinished && (
                <div role="status" className="mb-5 flex items-start gap-3 rounded-lg border border-[#8A704C] bg-[#3D3023] px-4 py-3 text-[11px] leading-5 text-[#E9C58B]">
                  <Check size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-black uppercase tracking-wider">Official result · Full time</p>
                    <p className="mt-1">This match is completed. Its final score, match clock and commentary remain available below. All match controls and event recording are locked.</p>
                    <p className="mt-1 font-mono">
                      {homeName} {match.home_score} – {match.away_score} {awayName}
                      {hasShootoutResult &&
                        ` (${shootoutHomeScore}–${shootoutAwayScore} pens)`}
                      {" · "}
                      {clockDisplay}
                    </p>

                    {hasShootoutResult && shootoutWinnerName && (
                      <p className="mt-1 font-black uppercase tracking-wider">
                        {shootoutWinnerName} wins on penalties
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* MATCH CONTROL BUTTONS */}

              <div className="flex flex-wrap items-center gap-3">

                {isScheduled && (
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#267FFF] px-6 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#4897FF] disabled:opacity-40"
                  >
                    <Play size={15} />
                    Start Match
                  </button>
                )}

                {isPlaying && !match.is_paused && (
                  <button
                    type="button"
                    onClick={() => void handlePause()}
                    disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A78144] bg-[#4A361D] px-5 text-[11px] font-black uppercase tracking-wider text-[#F5D394] transition hover:bg-[#654922] disabled:opacity-40"
                  >
                    <Pause size={15} />
                    Pause Match
                  </button>
                )}

                {isPlaying && match.is_paused && (
                  <button
                    type="button"
                    onClick={() => void handleResume()}
                    disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#388B70] bg-[#174D3C] px-5 text-[11px] font-black uppercase tracking-wider text-[#9DF0C9] transition hover:bg-[#20644D] disabled:opacity-40"
                  >
                    <Play size={15} />
                    Resume Match
                  </button>
                )}

                {isLive && match.phase === "first_half" && !match.is_paused && (
                  <button type="button" onClick={() => void handleHalfTime()} disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A78144] bg-[#4A361D] px-5 text-[11px] font-black uppercase text-[#F5D394] disabled:opacity-40">
                    <Flag size={15} /> End First Half
                  </button>
                )}
                {isLive && match.phase === "half_time" && (
                  <button type="button" onClick={() => void handleSecondHalf()} disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#267FFF] px-5 text-[11px] font-black uppercase text-white disabled:opacity-40">
                    <Play size={15} /> Start Second Half
                  </button>
                )}
                {/* {isLive && (match.phase === "second_half" || match.phase === "regulation_ended") && !match.is_paused && (
                  <button
                    type="button"
                    onClick={() => void handleFinish()}
                    disabled={actionLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A94D61] bg-[#6A293B] px-5 text-[11px] font-black uppercase tracking-wider text-[#FFE0E6] transition hover:bg-[#85364C] disabled:opacity-40"
                  >
                    <Square size={13} fill="currentColor" />
                    Finish Match
                  </button>
                )} */}
                {/* NORMAL LEAGUE / NON-KNOCKOUT FINISH */}

                {isLive &&
                  !match.is_knockout &&
                  (match.phase === "second_half" ||
                    match.phase === "regulation_ended") &&
                  !match.is_paused && (
                    <button
                      type="button"
                      onClick={() => void handleFinish()}
                      disabled={actionLoading}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A94D61] bg-[#6A293B] px-5 text-[11px] font-black uppercase tracking-wider text-[#FFE0E6] transition hover:bg-[#85364C] disabled:opacity-40"
                    >
                      <Square size={13} fill="currentColor" />
                      Finish Match
                    </button>
                  )}


                {/* KNOCKOUT — END REGULATION */}

                {isLive &&
                  match.is_knockout &&
                  match.phase === "second_half" &&
                  !match.is_paused && (
                    <button
                      type="button"
                      onClick={() => void handleEndRegulation()}
                      disabled={actionLoading}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A94D61] bg-[#6A293B] px-5 text-[11px] font-black uppercase tracking-wider text-[#FFE0E6] transition hover:bg-[#85364C] disabled:opacity-40"
                    >
                      <Square size={13} />
                      End Regulation
                    </button>
                  )}


                {/* KNOCKOUT — REGULATION ENDED */}

                {isLive &&
                  match.is_knockout &&
                  match.phase === "regulation_ended" && (
                    <>
                      {match.home_score === match.away_score ? (
                        <button
                          type="button"
                          onClick={() => void handleStartExtraTime()}
                          disabled={actionLoading}
                          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#6753CE] px-5 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#7965E2] disabled:opacity-40"
                        >
                          <Timer size={15} />
                          Start Extra Time
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleFinish()}
                          disabled={actionLoading}
                          className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A94D61] bg-[#6A293B] px-5 text-[11px] font-black uppercase tracking-wider text-[#FFE0E6] transition hover:bg-[#85364C] disabled:opacity-40"
                        >
                          <Square size={13} fill="currentColor" />
                          Finish Match
                        </button>
                      )}
                    </>
                  )}


                {/* EXTRA TIME — FIRST HALF */}

                {isLive &&
                  match.phase === "extra_time_first_half" &&
                  !match.is_paused && (
                    <button
                      type="button"
                      onClick={() => void handleExtraTimeHalfTime()}
                      disabled={actionLoading}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#8E72ED] bg-[#382F65] px-5 text-[11px] font-black uppercase tracking-wider text-[#D4C8FF] transition hover:bg-[#4B3E80] disabled:opacity-40"
                    >
                      <Flag size={15} />
                      End ET First Half
                    </button>
                  )}


                {/* EXTRA TIME INTERVAL */}

                {isLive &&
                  match.phase === "extra_time_interval" && (
                    <button
                      type="button"
                      onClick={() => void handleExtraTimeSecondHalf()}
                      disabled={actionLoading}
                      className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#6753CE] px-5 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#7965E2] disabled:opacity-40"
                    >
                      <Play size={15} />
                      Start ET Second Half
                    </button>
                  )}


                {/* EXTRA TIME — SECOND HALF */}

                {isLive &&
                  match.phase === "extra_time_second_half" &&
                  !match.is_paused && (
                    <button
                      type="button"
                      onClick={() => void handleEndExtraTime()}
                      disabled={actionLoading}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#A94D61] bg-[#6A293B] px-5 text-[11px] font-black uppercase tracking-wider text-[#FFE0E6] transition hover:bg-[#85364C] disabled:opacity-40"
                    >
                      <Square size={13} />
                      End Extra Time
                    </button>
                  )}

                {isFinished && (
                  <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#8A704C] bg-[#3D3023] px-5 text-[11px] font-black uppercase tracking-wider text-[#E9C58B]">
                    <Check size={15} />
                    Match Completed
                  </span>
                )}

              </div>

              {/* EXTRA TIME CONTROL */}

              {isPlaying && !match.is_paused && (
                <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-white/10 pt-5">

                  <div className="w-full max-w-[180px]">
                    <label
                      htmlFor="extra-time"
                      className={labelClass}
                    >
                      <Timer size={12} className="mr-1 inline" />
                      Stoppage Time (Minutes)
                    </label>

                    <input
                      id="extra-time"
                      type="number"
                      min={0}
                      max={30}
                      step={1}
                      value={extraTimeInput}
                      onChange={(event) =>
                        setExtraTimeInput(event.target.value)
                      }
                      placeholder={String(currentStoppageMinutes)}
                      disabled={actionLoading}
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleExtraTime()}
                    disabled={
                      actionLoading ||
                      !extraTimeInput.trim()
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#417CB6] bg-[#163F68] px-5 text-[11px] font-black uppercase tracking-wider text-[#ADD5FF] transition hover:bg-[#225889] disabled:opacity-40"
                  >
                    {actionLoading ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Plus size={15} />
                    )}

                    Set Stoppage Time
                  </button>

                  <p className="w-full text-[10px] text-[#819FBE]">
                    Sets stoppage time for the current half only. Enter 0 to cancel the current half’s announcement; first-half history is retained.
                  </p>

                </div>
              )}

            </div>

          </div>
        </section>
        {/* PENALTY SHOOTOUT CONTROL */}

        {(
          match.phase === "penalty_shootout" ||
          (match.shootout_kicks?.length ?? 0) > 0
        ) && (
            <section className="my-5 overflow-hidden rounded-xl border border-[#725CC7] bg-[#0E1830]">

              {/* HEADER */}

            <div className="border-b border-[#3D3569] bg-[linear-gradient(110deg,#241E49,#162B50)] px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#B5A6FF]">
                    <Target size={13} />
                    Knockout Decider
                  </p>

                  <h2 className="font-heading mt-2 text-[24px] font-black uppercase tracking-[-0.04em]">
                    PENALTY{" "}
                    <span className="text-[#9B83FF]">
                      SHOOTOUT.
                    </span>
                  </h2>

                  <p className="mt-2 text-[11px] text-[#A8B7D3]">
                    Record each official penalty kick.
                    Kick order and winner detection are controlled
                    by the match engine.
                  </p>
                </div>

                <div className="rounded-lg border border-[#725CC7] bg-[#30275B] px-5 py-3 text-center">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#B8AAEE]">
                    Shootout Score
                  </p>

                  <p className="font-heading mt-1 text-[30px] font-black tabular-nums">
                    {match.shootout?.home_score ?? 0}

                    <span className="mx-3 text-[#756B9A]">
                      :
                    </span>

                    {match.shootout?.away_score ?? 0}
                  </p>
                </div>

              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">

              {/* NEXT KICK */}

              <div className="rounded-xl border border-[#3A5272] bg-[#0A1A2D] p-5">

                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#819FC1]">
                  Next Penalty
                </p>

                <div className="mt-4 flex items-center gap-3">

                  <TeamCrest
                    team={shootoutNextTeam}
                    size={52}
                  />

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8EADD0]">
                      Taking Next Kick
                    </p>

                    <h3 className="font-heading mt-1 text-lg font-black uppercase">
                      {shootoutNextTeamName}
                    </h3>
                  </div>

                </div>

                <div className="mt-5">

                  <label
                    htmlFor="shootout-player"
                    className={labelClass}
                  >
                    Penalty Taker
                  </label>

                  <select
                    id="shootout-player"
                    value={shootoutPlayerId}
                    onChange={(event) => {
                      setShootoutPlayerId(
                        event.target.value
                      );

                      if (event.target.value) {
                        setShootoutPlayerName("");
                      }
                    }}
                    disabled={
                      actionLoading ||
                      match.shootout?.is_finished ||
                      !shootoutNextTeamId
                    }
                    className={inputClass}
                  >
                    <option value="">
                      Manual / Unknown
                    </option>

                    {shootoutPlayers.map((player) => (
                      <option
                        key={player.id}
                        value={player.id}
                      >
                        #{player.jersey_number}
                        {" — "}
                        {player.full_name}
                      </option>
                    ))}
                  </select>

                  {!shootoutPlayerId && (
                    <input
                      type="text"
                      value={shootoutPlayerName}
                      onChange={(event) =>
                        setShootoutPlayerName(
                          event.target.value
                        )
                      }
                      placeholder="Optional penalty taker name"
                      disabled={
                        actionLoading ||
                        match.shootout?.is_finished
                      }
                      className={`${inputClass} mt-2.5`}
                    />
                  )}

                </div>

                {/* GOAL / MISS */}

                {!match.shootout?.is_finished && (
                  <div className="mt-5 grid grid-cols-2 gap-3">

                    <button
                      type="button"
                      onClick={() =>
                        void handleShootoutKick(true)
                      }
                      disabled={
                        actionLoading ||
                        !shootoutNextTeamId
                      }
                      className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[#31846A] bg-[#18513F] text-[11px] font-black uppercase tracking-wider text-[#A5F2CF] transition hover:bg-[#216A51] disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <LoaderCircle
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <Check size={17} />
                      )}

                      Goal
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleShootoutKick(false)
                      }
                      disabled={
                        actionLoading ||
                        !shootoutNextTeamId
                      }
                      className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[#9A4A5C] bg-[#552334] text-[11px] font-black uppercase tracking-wider text-[#FFB2C0] transition hover:bg-[#6D2C41] disabled:opacity-40"
                    >
                      <AlertCircle size={16} />
                      Miss
                    </button>

                  </div>
                )}

                {/* WINNER */}

                {match.shootout?.is_finished && (
                  <div className="mt-5 rounded-lg border border-[#927747] bg-[#3A3021] px-4 py-4 text-[#F0CE91]">

                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider">
                      <Trophy size={16} />
                      Shootout Complete
                    </p>

                    <p className="mt-2 text-[11px]">
                      Winner:{" "}
                      <strong>
                        {match.shootout.winner_id
                          ? teamName(
                              match.shootout
                                .winner_id
                            )
                          : "Confirmed"}
                      </strong>
                    </p>

                  </div>
                )}

              </div>

              {/* KICK HISTORY */}

              <div className="rounded-xl border border-[#3A5272] bg-[#0A1A2D] p-5">

                <div className="flex items-center justify-between gap-3">

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#819FC1]">
                      Official Record
                    </p>

                    <h3 className="font-heading mt-1 text-lg font-black uppercase">
                      Kick History
                    </h3>
                  </div>

                  <span className="rounded-md border border-[#465E7B] bg-[#142A43] px-3 py-2 font-mono text-[10px] text-[#A8C7E8]">
                    {match.shootout_kicks?.length ?? 0} KICKS
                  </span>

                </div>

                {!match.shootout_kicks?.length ? (
                  <div className="mt-5 flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-[#3B526D] bg-[#0D2035] px-5 text-center">

                    <p className="text-[11px] leading-5 text-[#809FBE]">
                      No penalties recorded yet.
                      The first kick will appear here.
                    </p>

                  </div>
                ) : (
                  <div className="mt-5 space-y-2">

                    {match.shootout_kicks.map(
                      (kick, index) => {
                        const kickTeam =
                          teamMap.get(kick.team);

                        const kickTeamName =
                          kickTeam?.name ??
                          teamName(kick.team);

                        return (
                          <div
                            key={kick.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-[#304A66] bg-[#10253A] px-4 py-3"
                          >

                            <div className="flex min-w-0 items-center gap-3">

                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                                  kick.scored
                                    ? "border-[#39886F] bg-[#194D3D] text-[#A1EBC9]"
                                    : "border-[#944C5C] bg-[#4A2430] text-[#FFABB9]"
                                }`}
                              >
                                {kick.scored ? (
                                  <Check size={15} />
                                ) : (
                                  <AlertCircle size={14} />
                                )}
                              </span>

                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black">
                                  {kickTeamName}
                                </p>

                                <p className="mt-0.5 truncate text-[10px] text-[#819FBE]">
                                  {kick.player_name ||
                                    "Unknown taker"}
                                </p>
                              </div>

                            </div>

                            <div className="shrink-0 text-right">

                              <p
                                className={`text-[10px] font-black uppercase ${
                                  kick.scored
                                    ? "text-[#8CE2BA]"
                                    : "text-[#FF9CAE]"
                                }`}
                              >
                                {kick.scored
                                  ? "GOAL"
                                  : "MISS"}
                              </p>

                              <p className="mt-1 font-mono text-[9px] text-[#6888A8]">
                                Kick #{kick.kick_number ?? index + 1}
                              </p>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

            </div>
          </section>
        )}

       
        {/* OPERATIONAL STATS  */}

        <section className="my-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Home Goals",
              value: match.home_score,
              icon: Target,
              color: "#4A9FFF",
            },
            {
              label: "Away Goals",
              value: match.away_score,
              icon: Target,
              color: "#A58CFF",
            },
            {
              label: "Cards Issued",
              value: cardCount,
              icon: ShieldAlert,
              color: "#F0C47D",
            },
            {
              label: "Match Events",
              value: timeline.length,
              icon: Activity,
              color: "#79B7FF",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="flex min-h-[96px] items-center gap-3 rounded-xl border border-[#294866] bg-[#0B1C30] p-4"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    color: stat.color,
                    borderColor:
                      `${stat.color}55`,
                    background:
                      `${stat.color}12`,
                  }}
                >
                  <Icon size={18} />
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#87A6C8]">
                    {stat.label}
                  </p>

                  <p className="font-heading mt-1 text-[26px] font-black leading-none tabular-nums">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* =================================================
           CONTROL DESK + TIMELINE
        ================================================= */}

        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(350px,.95fr)]">

          {/* LEFT - OPERATIONS */}

          <section className="min-w-0 overflow-hidden rounded-xl border border-[#2B4C70] bg-[#0A1B2E]">
            <div className="border-b border-[#294765] bg-[#102640] px-5 py-5 sm:px-6">
              <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#79B7FF]">
                <Zap size={13} />
                Referee Operations
              </p>

              <h2 className="font-heading text-[24px] font-black uppercase tracking-[-0.045em]">
                EVENT CONTROL{" "}
                <span className="text-[#438FFF]">
                  DESK.
                </span>
              </h2>

              <p className="mt-2 text-[11px] leading-5 text-[#91ADCD]">
                Record official goals, disciplinary
                actions and match rewards.
              </p>
            </div>

            {(!isLive || !isPlaying) && (
              <div className="mx-5 mt-5 flex items-start gap-3 rounded-lg border border-[#4D6380] bg-[#172B43] px-4 py-3 text-[11px] leading-5 text-[#B4CBE4] sm:mx-6">
                <AlertCircle
                  size={15}
                  className="mt-0.5 shrink-0 text-[#9AC8FF]"
                />

                {isFinished
                  ? "This fixture is completed. Match event recording is now locked."
                  : match.phase === "penalty_shootout"
                    ? "Penalty shootout is active. Record penalties using the Penalty Shootout panel above."
                    : match.phase === "regulation_ended"
                      ? "Regulation has ended. Start extra time or finish the knockout match using the scoreboard controls."
                      : match.phase === "half_time"
                        ? "Half time is active. Start the second half to resume event recording."
                        : match.phase === "extra_time_interval"
                          ? "Extra-time interval is active. Start the second half of extra time to resume event recording."
                          : "Start the match using the scoreboard controls to enable event recording."}
              </div>
            )}
            {/* TAB SELECTOR */}

            <div className="grid grid-cols-2 gap-2 px-5 pt-5 sm:px-6">
              <button
                type="button"
                disabled={!isPlaying || match.is_paused || isFinished}
                onClick={() =>
                  setActivePanel("goal")
                }
                className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-[11px] font-black uppercase tracking-[0.07em] transition ${activePanel === "goal"
                    ? "border-[#398EFF] bg-[#1A4A7D] text-white"
                    : "border-[#2B4A69] bg-[#0B1A2C] text-[#89A9CB] hover:bg-[#16324F]"
                  }`}
              >
                <CircleDot size={16} />
                Record Goal
              </button>

              <button
                type="button"
                disabled={!isPlaying || match.is_paused || isFinished}
                onClick={() =>
                  setActivePanel("event")
                }
                className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-[11px] font-black uppercase tracking-[0.07em] transition ${activePanel === "event"
                    ? "border-[#8E72ED] bg-[#382F65] text-white"
                    : "border-[#2B4A69] bg-[#0B1A2C] text-[#89A9CB] hover:bg-[#16324F]"
                  }`}
              >
                <Flag size={16} />
                Match Event
              </button>
            </div>

            {/* GOAL FORM */}

            {activePanel === "goal" && (
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#7DB7F8]">
                      Scoring Control
                    </p>

                    <h3 className="font-heading mt-1 text-lg font-black uppercase">
                      Add Official Goal
                    </h3>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#3974B4] bg-[#153B63] text-[#8DC5FF]">
                    <Target size={22} />
                  </div>
                </div>

                {/* SCORING TEAM */}

                <div>
                  <label
                    htmlFor="goal-team"
                    className={labelClass}
                  >
                    Scoring Team
                  </label>

                  <div className="relative">
                    <select
                      id="goal-team"
                      value={goalTeam}
                      onChange={(event) => {
                        setGoalTeam(
                          event.target.value
                        );
                        setGoalPlayerId("");
                        setGoalPlayer("");
                      }}
                      disabled={formDisabled}
                      className={`${inputClass} appearance-none pr-9`}
                    >
                      <option value="">
                        Select scoring team
                      </option>

                      <option
                        value={match.home_team}
                      >
                        {homeName} (Home)
                      </option>

                      <option
                        value={match.away_team}
                      >
                        {awayName} (Away)
                      </option>
                    </select>

                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8FB0D3]"
                    />
                  </div>
                </div>

                {/* PLAYER + MINUTE */}

                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_115px]">
                  <div className="min-w-0">
                    <label
                      htmlFor="goal-player"
                      className={labelClass}
                    >
                      Registered Scorer
                    </label>

                    <select
                      id="goal-player"
                      value={goalPlayerId}
                      onChange={(event) => {
                        setGoalPlayerId(
                          event.target.value
                        );

                        if (
                          event.target.value
                        ) {
                          setGoalPlayer("");
                        }
                      }}
                      disabled={
                        formDisabled ||
                        !goalTeam
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Manual / Unknown
                      </option>

                      {goalPlayers.map(
                        (player) => (
                          <option
                            key={player.id}
                            value={player.id}
                          >
                            #{player.jersey_number}
                            {" — "}
                            {player.full_name}
                          </option>
                        )
                      )}
                    </select>

                    {!goalPlayerId && (
                      <input
                        type="text"
                        value={goalPlayer}
                        onChange={(event) =>
                          setGoalPlayer(
                            event.target.value
                          )
                        }
                        placeholder="Optional manual scorer name"
                        disabled={formDisabled}
                        aria-label="Manual scorer name"
                        className={`${inputClass} mt-2.5`}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="goal-minute"
                      className={labelClass}
                    >
                      Minute
                    </label>

                    <div className="relative">
                      <input
                        id="goal-minute"
                        type="number"
                        min={0}
                        max={120}
                        step={1}
                        value={liveEventMinute}
                        readOnly
                        placeholder="45"
                        disabled={formDisabled}
                        className={`${inputClass} pr-7`}
                      />

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#83A5CA]">
                        &apos;
                      </span>
                    </div>
                  </div>
                </div>

                {goalTeam &&
                  goalPlayers.length === 0 && (
                    <div className="rounded-lg border border-[#806440] bg-[#33291D] px-4 py-3 text-[10px] leading-5 text-[#E9C78F]">
                      No active registered players
                      found for this team. You may
                      enter a manual scorer, but
                      manual goals will not count
                      towards the player-linked
                      Top Scorers leaderboard.
                    </div>
                  )}

                <button
                  type="button"
                  onClick={() =>
                    void handleGoal()
                  }
                  disabled={formDisabled}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(110deg,#087AFF,#654FFF)] text-[11px] font-black uppercase tracking-[0.1em] text-white transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionLoading ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
                  )}

                  Confirm Goal
                </button>

                <p className="text-center text-[10px] text-[#7899BA]">
                  Linked player goals contribute
                  to tournament statistics.
                </p>
              </div>
            )}

            {/* OTHER EVENT FORM */}

            {activePanel === "event" && (
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#B19AFF]">
                      Match Operations
                    </p>

                    <h3 className="font-heading mt-1 text-lg font-black uppercase">
                      Record Match Event
                    </h3>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#7962B5] bg-[#302752] text-[#C0AEFF]">
                    <Flag size={21} />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="event-team"
                    className={labelClass}
                  >
                    Select Team
                  </label>

                  <select
                    id="event-team"
                    value={eventTeam}
                    onChange={(event) => {
                      setEventTeam(event.target.value);
                      setEventPlayerId("");
                      setEventPlayer("");
                    }}
                    disabled={formDisabled}
                    className={inputClass}
                  >
                    <option value="">
                      Select team
                    </option>

                    <option
                      value={match.home_team}
                    >
                      {homeName}
                    </option>

                    <option
                      value={match.away_team}
                    >
                      {awayName}
                    </option>
                  </select>
                </div>

                {/* EVENT TYPE BUTTONS */}

                <div>
                  <span className={labelClass}>
                    Event Classification
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        "foul",
                        "chance",
                        "save",
                        "yellow_card",
                        "red_card",
                        "penalty_kick",
                        "reward",
                      ] as OtherEventType[]
                    ).map((type) => (
                      <button
                        key={type}
                        type="button"
                        disabled={formDisabled}
                        onClick={() =>
                          setEventType(type)
                          
                        }
                        // onClick={() => {
                        //   setEventType(type);
                        //   setEventPlayer("");
                        //   setEventPlayerId("");
                        //   setEventPoints("");
                        //   setEventNote("");
                        // }}
                        className={`flex min-h-[47px] items-center justify-center gap-2 rounded-lg border px-2 text-[10px] font-bold transition disabled:opacity-40 ${eventType === type
                            ? "border-[#927AFF] bg-[#352B60] text-white"
                            : "border-[#304B6A] bg-[#0B1B2D] text-[#9DB9D8] hover:bg-[#193450]"
                          }`}
                      >
                        <span
                          style={{
                            color:
                              eventColor(type),
                          }}
                        >
                          <EventSymbol
                            type={type}
                            size={15}
                          />
                        </span>

                        {eventLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_115px]">
                  <div className="min-w-0">
                    {/* <label
                      htmlFor="event-player"
                      className={labelClass}
                    >
                      Registered Player
                    </label> */}
                    <label
                      htmlFor="event-player"
                      className={labelClass}
                    >
                      {eventType === "chance"
                        ? "Player Creating Chance"
                        : eventType === "save"
                          ? "Goalkeeper / Player"
                          : "Registered Player"}
                    </label>

                    <select
                      id="event-player"
                      value={eventPlayerId}
                      onChange={(event) => {
                        setEventPlayerId(event.target.value);
                        if (event.target.value) setEventPlayer("");
                      }}
                      disabled={formDisabled || !eventTeam}
                      className={inputClass}
                    >
                      <option value="">Manual / Unknown</option>
                      {eventPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.jersey_number} — {player.full_name}
                        </option>
                      ))}
                    </select>

                    {!eventPlayerId && (
                      <input
                        type="text"
                        value={eventPlayer}
                        onChange={(event) => setEventPlayer(event.target.value)}
                        placeholder="Optional manual player name"
                        disabled={formDisabled}
                        aria-label="Manual event player name"
                        className={`${inputClass} mt-2.5`}
                      />
                    )}
                    {eventTeam && eventPlayers.length === 0 && (
                      <p className="mt-2 text-[10px] text-[#E9C78F]">
                        No active registered players for this team. You can enter a name manually.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="event-minute"
                      className={labelClass}
                    >
                      Minute
                    </label>

                    <input
                      id="event-minute"
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      value={liveEventMinute}
                      readOnly
                      placeholder="60"
                      disabled={formDisabled}
                      className={inputClass}
                    />
                  </div>
                </div>

                {eventType === "reward" && (
                  <div>
                    <label
                      htmlFor="reward-points"
                      className={labelClass}
                    >
                      Bonus Points
                    </label>

                    <input
                      id="reward-points"
                      type="number"
                      min={1}
                      step={1}
                      value={eventPoints}
                      onChange={(event) =>
                        setEventPoints(
                          event.target.value
                        )
                      }
                      placeholder="e.g. 2"
                      disabled={formDisabled}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="event-note"
                    className={labelClass}
                  >
                    {eventType === "reward"
                      ? "Reward Reason"
                      : "Additional Note"}
                  </label>

                  <textarea
                    id="event-note"
                    rows={3}
                    value={eventNote}
                    onChange={(event) =>
                      setEventNote(
                        event.target.value
                      )
                    }
                    // placeholder={
                    //   eventType === "reward"
                    //     ? "Why is this team receiving bonus points?"
                    //     : "Optional event details"
                    // }
                    placeholder={
                      eventType === "reward"
                        ? "Why is this team receiving bonus points?"
                        : eventType === "chance"
                          ? "e.g. Powerful shot narrowly misses the target"
                          : eventType === "save"
                            ? "e.g. Goalkeeper makes an excellent save"
                            : eventType === "foul"
                              ? "e.g. Late challenge near the penalty area"
                              : "Optional event details"
}
                    disabled={formDisabled}
                    className={`${inputClass} h-auto min-h-[90px] resize-y py-3`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void handleEvent()
                  }
                  disabled={formDisabled}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(110deg,#6753CE,#3975D6)] text-[11px] font-black uppercase tracking-[0.1em] text-white transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionLoading ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
                  )}

                  Record Official Event
                </button>
              </div>
            )}

            {/* FORM FOOTER */}

            <div className="flex items-center gap-2 border-t border-[#294665] bg-[#0D2138] px-5 py-4 text-[10px] text-[#89A9CB] sm:px-6">
              <Shield size={13} />
              Authorized match operations only
            </div>
          </section>

          {/* RIGHT - TIMELINE */}

          <section className="min-w-0 overflow-hidden rounded-xl border border-[#2B4C70] bg-[#0A1B2E]">
            <div className="border-b border-[#294765] bg-[#102640] px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#79B7FF]">
                    <Radio size={13} />
                    Match Broadcast Feed
                  </p>

                  <h2 className="font-heading text-[24px] font-black uppercase tracking-[-0.045em]">
                    LIVE{" "}
                    <span className="text-[#438FFF]">
                      TIMELINE.
                    </span>
                  </h2>
                </div>

                <span className="rounded-lg border border-[#3A6088] bg-[#173554] px-3 py-2 font-mono text-[10px] font-bold text-[#B0D5FF]">
                  {timeline.length} EVENTS
                </span>
              </div>

              <p className="mt-3 text-[11px] text-[#8EACCD]">
                Official events in chronological order.
              </p>
            </div>

            {timeline.length === 0 ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#345A80] bg-[#153453]">
                  <Activity
                    size={26}
                    className="text-[#7CB8F9]"
                  />
                </div>

                <h3 className="font-heading mt-5 text-lg font-black uppercase">
                  Awaiting Match Activity
                </h3>

                <p className="mt-2 max-w-xs text-[11px] leading-6 text-[#83A3C6]">
                  Goals, cards, penalty kicks, rewards and
                  referee announcements will appear here
                  as they are recorded.
                </p>
              </div>
            ) : (
              <div className="max-h-[850px] overflow-y-auto px-4 py-6 sm:px-6">
                <div className="relative">
                  <div className="absolute bottom-4 left-[22px] top-4 w-px bg-gradient-to-b from-[#398EFF] via-[#365A81] to-transparent" />

                  <div className="space-y-5">
                    {timeline.map(
                      (event, index) => {
                        const color =
                          eventColor(
                            event.type
                          );

                        const teamId = eventTeamId(event.team);
                        const isSystem = systemEventTypes.has(event.type);
                        const belongsHome = teamId === match.home_team;

                        return (
                          <article
                            key={event.id}
                            className="relative flex min-w-0 items-start gap-4"
                          >
                            {/* MINUTE */}

                            <div
                              className="relative z-10 flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-lg border bg-[#0B2037] font-mono text-[12px] font-black tabular-nums"
                              style={{
                                color,
                                borderColor:
                                  `${color}75`,
                              }}
                            >
                              {event.minute}
                              &apos;
                            </div>

                            {/* EVENT */}

                            <div className="min-w-0 flex-1 rounded-lg border border-[#2B4A69] bg-[#10253C] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                                    style={{
                                      color,
                                      background:
                                        `${color}15`,
                                      borderColor:
                                        `${color}55`,
                                    }}
                                  >
                                    <EventSymbol
                                      type={
                                        event.type
                                      }
                                      size={16}
                                    />
                                  </span>

                                  <div className="min-w-0">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.06em]">
                                      {eventLabel(
                                        event.type
                                      )}
                                    </h3>

                                    <p className="mt-1 truncate text-[10px] text-[#8EAFCF]">
                                      {isSystem ? "Official match announcement" : teamId !== null ? teamName(teamId) : "Official match event"}
                                    </p>
                                  </div>
                                </div>

                                <span
                                  className={`rounded px-2 py-1 text-[9px] font-black uppercase tracking-wider ${belongsHome
                                      ? "bg-[#1B4775] text-[#99CAFF]"
                                      : "bg-[#392F61] text-[#C2B1FF]"
                                    }`}
                                >
                                  {isSystem ? "Official" : belongsHome ? "Home" : "Away"}
                                </span>
                              </div>

                              {event.player_name && (
                                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#D2E1F3]">
                                  <UserRound
                                    size={12}
                                    className="text-[#8FB9E9]"
                                  />
                                  {
                                    event.player_name
                                  }
                                </div>
                              )}

                              {event.note && (
                                <p className="mt-3 break-words border-t border-[#2A4765] pt-3 text-[10px] leading-5 text-[#94B1D0]">
                                  {event.note}
                                </p>
                              )}

                              {event.type ===
                                "reward" &&
                                event.points !==
                                0 && (
                                  <p className="mt-3 font-mono text-[11px] font-black text-[#EAC58B]">
                                    +
                                    {
                                      event.points
                                    }{" "}
                                    BONUS POINTS
                                  </p>
                                )}

                              <p className="mt-3 font-mono text-[9px] text-[#6587AB]">
                                EVENT #
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </p>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TIMELINE FOOTER */}

            <div className="flex items-center justify-between gap-3 border-t border-[#294765] bg-[#0D2138] px-5 py-4 text-[10px] text-[#8DAFD0] sm:px-6">
              <span className="flex items-center gap-2">
                {socketConnected ? (
                  <Wifi
                    size={13}
                    className="text-[#7CB9FF]"
                  />
                ) : (
                  <WifiOff size={13} />
                )}

                {socketConnected
                  ? "Receiving realtime updates"
                  : "Waiting for connection"}
              </span>

              <span className="font-mono">
                {goalCount} GOALS
              </span>
            </div>
          </section>
        </div>

        {/* FOOTER */}

        <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-[#243F5D] pt-6">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7696B8]">
            FOOTBALLCUP / MATCH CONTROL
          </p>

          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-2 text-[11px] font-bold text-[#8CBFFF] hover:text-white"
          >
            Back to All Fixtures
            <ArrowLeft size={13} />
          </Link>
        </footer>
      </div>
    </main>
  );
}
