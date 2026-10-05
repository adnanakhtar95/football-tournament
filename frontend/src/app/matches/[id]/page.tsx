"use client";



import Link from "next/link";

import { useParams } from "next/navigation";

import { useEffect, useMemo, useState } from "react";

import {

  ArrowLeft, ArrowRight, CalendarDays, Clock3, Flag, MapPin,

  Radio, Trophy, Wifi, WifiOff, Zap,

} from "lucide-react";



const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");



type MatchStatus = "scheduled" | "live" | "finished";
type MatchPhase =
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

interface Team { id: number; name: string; code: string; logo: string | null; }
interface ShootoutKick {
  id: number;
  team_id: number;
  player_id: number | null;
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

  // Backend uses these names
  winner_id: number | null;
  is_finished: boolean;
}
interface Match {

  id: number; home_team: Team; away_team: Team; scheduled_at: string;

  venue: string; status: MatchStatus; started_at: string | null;

  ended_at: string | null; home_score: number; away_score: number;

  is_paused: boolean;

  paused_at: string | null;

  total_paused_seconds: number;

  extra_time_minutes: number;
  phase?: MatchPhase;
  clock_seconds?: number;
  first_half_elapsed_seconds?: number;
  first_half_stoppage_minutes?: number;
  first_half_ended_at?: string | null;
  second_half_started_at?: string | null;
  second_half_stoppage_minutes?: number;
  second_half_pause_baseline_seconds?: number;
  is_knockout: boolean;

  regulation_elapsed_seconds?: number;

  extra_time_first_half_started_at?: string | null;
  extra_time_first_half_ended_at?: string | null;

  extra_time_second_half_started_at?: string | null;
  extra_time_second_half_ended_at?: string | null;

  extra_time_first_half_elapsed_seconds?: number;
  extra_time_elapsed_seconds?: number;

  extra_time_first_half_pause_baseline_seconds?: number;
  extra_time_second_half_pause_baseline_seconds?: number;

  extra_time_first_half_stoppage_minutes?: number;
  extra_time_second_half_stoppage_minutes?: number;

  shootout?: ShootoutState | null;
  shootout_kicks?: ShootoutKick[];
}

interface MatchEvent {

  id: number; team: number | Team | null; type: string; player_name: string;

  minute: number; points: number; note: string; created_at: string;

}

interface SocketMatchEvent {

  id: number; team_id: number | null; type: string; player_name: string;

  minute: number; points: number; note: string;

}

// interface SocketUpdate {

//   type: string; event?: string; match_id?: number; status?: MatchStatus;

//   home_score?: number; away_score?: number; started_at?: string | null;

//   ended_at?: string | null; match_event?: SocketMatchEvent;

// }



interface SocketUpdate {

  type: string;

  event?: string;

  match_id?: number;

  status?: MatchStatus;

  home_score?: number;

  away_score?: number;

  started_at?: string | null;

  ended_at?: string | null;



  is_paused?: boolean;

  paused_at?: string | null;

  total_paused_seconds?: number;

  extra_time_minutes?: number;
  phase?: MatchPhase;
  clock_seconds?: number;
  first_half_elapsed_seconds?: number;
  first_half_stoppage_minutes?: number;
  first_half_ended_at?: string | null;
  second_half_started_at?: string | null;
  second_half_stoppage_minutes?: number;
  second_half_pause_baseline_seconds?: number;



  match_event?: SocketMatchEvent;
  is_knockout?: boolean;

  regulation_elapsed_seconds?: number;

  extra_time_first_half_started_at?: string | null;
  extra_time_first_half_ended_at?: string | null;

  extra_time_second_half_started_at?: string | null;
  extra_time_second_half_ended_at?: string | null;

  extra_time_first_half_elapsed_seconds?: number;
  extra_time_elapsed_seconds?: number;

  extra_time_first_half_pause_baseline_seconds?: number;
  extra_time_second_half_pause_baseline_seconds?: number;

  extra_time_first_half_stoppage_minutes?: number;
  extra_time_second_half_stoppage_minutes?: number;

  shootout?: ShootoutState | null;
  shootout_kicks?: ShootoutKick[];
}





function eventLabel(type: string) {

  const labels: Record<string, string> = {

    goal: "GOAL!", yellow_card: "Yellow card", red_card: "Red card",

    penalty_kick: "Penalty kick", reward: "Reward points",



    match_started: "MATCH KICKED OFF",

    match_paused: "MATCH PAUSED",

    match_resumed: "PLAY RESUMED",

    extra_time: "ADDITIONAL TIME",

    match_finished: "FULL TIME",
    half_time: "HALF TIME",
    second_half_started: "SECOND HALF KICKOFF",
    regulation_ended: "REGULATION TIME ENDED",

  };

  return labels[type] || type.replace(/_/g, " ");

}

function eventSymbol(type: string) {

  const symbols: Record<string, string> = {

    goal: "⚽", yellow_card: "🟨", red_card: "🟥",

    penalty_kick: "◎", reward: "★",



    match_started: "🏁",

    match_paused: "⏸️",

    match_resumed: "▶️",

    extra_time: "⏱️",

    match_finished: "🏁",
    half_time: "⏸️",
    second_half_started: "▶️",
    regulation_ended: "⏱️",



  };

  return symbols[type] || "•";

}



const SYSTEM_EVENT_TYPES = new Set([

  "match_started",

  "match_paused",

  "match_resumed",

  "extra_time",

  "match_finished",
  "half_time",
  "second_half_started",
  "regulation_ended",

]);



function isSystemEvent(type: string): boolean {

  return SYSTEM_EVENT_TYPES.has(type);

}





function formatDate(value: string | null) {

  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-US", {

    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",

  });

}

function normalizeEvents(data: unknown): MatchEvent[] {

  if (Array.isArray(data)) return data as MatchEvent[];

  if (data !== null && typeof data === "object" && "results" in data && Array.isArray(data.results)) {

    return data.results as MatchEvent[];

  }

  return [];

}

function sortEvents(items: MatchEvent[]) {

  return [...items].sort((a, b) => a.id - b.id);

}

function teamIdOf(event: MatchEvent) {

  return typeof event.team === "object" && event.team !== null ? event.team.id : event.team;

}

function Crest({ team, big = false }: { team: Team; big?: boolean }) {

  return (

    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#F5C66C]/30 bg-[linear-gradient(145deg,#3A3531,#17202B)] font-heading font-extrabold text-[#F5C66C] shadow-[0_0_35px_rgba(245,198,108,.07)] ${big ? "h-20 w-20 rounded-2xl text-xl sm:h-28 sm:w-28 sm:text-2xl" : "h-10 w-10 rounded-xl text-xs"}`}>

      {team.logo ? (

        // eslint-disable-next-line @next/next/no-img-element

        <img src={team.logo} alt={`${team.name} logo`} className="h-full w-full object-contain p-2" />

      ) : team.code.slice(0, 3).toUpperCase()}

    </div>

  );

}

// function Status({ status }: { status: MatchStatus }) {

//   return <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] ${status === "live" ? "border-[#EF6672]/40 bg-[#EF6672]/15 text-[#FF8E97]" : status === "finished" ? "border-white/20 bg-white/10 text-[#D4DCE3]" : "border-[#F5C66C]/35 bg-[#F5C66C]/10 text-[#F5C66C]"}`}>

//     {status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF6672]" />}

//     {status === "live" ? "Live Match" : status === "finished" ? "Full Time" : "Upcoming Fixture"}

//   </span>;

// }





function Status({

  status,

  isPaused = false,

}: {

  status: MatchStatus;

  isPaused?: boolean;

}) {

  const paused = status === "live" && isPaused;



  return (

    <span

      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] ${paused

          ? "border-[#F5C66C]/50 bg-[#F5C66C]/15 text-[#F5C66C]"

          : status === "live"

            ? "border-[#EF6672]/40 bg-[#EF6672]/15 text-[#FF8E97]"

            : status === "finished"

              ? "border-white/20 bg-white/10 text-[#D4DCE3]"

              : "border-[#F5C66C]/35 bg-[#F5C66C]/10 text-[#F5C66C]"

        }`}

    >

      {status === "live" && (

        <span

          className={`h-1.5 w-1.5 rounded-full ${paused

              ? "bg-[#F5C66C]"

              : "animate-pulse bg-[#EF6672]"

            }`}

        />

      )}



      {paused

        ? "Match Paused"

        : status === "live"

          ? "Live Match"

          : status === "finished"

            ? "Full Time"

            : "Upcoming Fixture"}

    </span>

  );

}





export default function MatchPage() {

  const params = useParams();

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;

  const matchId = Number(rawId);

  const [match, setMatch] = useState<Match | null>(null);

  const [events, setEvents] = useState<MatchEvent[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [socketConnected, setSocketConnected] = useState(false);



  // Local clock: no extra API requests required.

  const [clockNow, setClockNow] = useState(

    () => Date.now()

  );



  useEffect(() => {

    const timer = window.setInterval(() => {

      setClockNow(Date.now());

    }, 1000);



    return () => window.clearInterval(timer);

  }, []);



  // Phase-aware clock: use real timestamps for active play, freeze at HT/FT.
  // The optional fields also keep older API responses from crashing the page.
  const elapsedSeconds = useMemo(() => {
    if (!match?.started_at || match.status === "scheduled") {
      return 0;
    }

    // Finished match: backend owns the final frozen clock.
    if (
      match.status === "finished" ||
      match.phase === "full_time"
    ) {
      return match.clock_seconds ?? 0;
    }

    // Half-time: freeze at first-half snapshot.
    // if (match.phase === "half_time") {
    //   return (
    //     match.first_half_elapsed_seconds ??
    //     match.clock_seconds ??
    //     45 * 60
    //   );
    // }
    if (match.phase === "half_time") {
      return Math.max(
        match.first_half_elapsed_seconds ?? 0,
        match.clock_seconds ?? 0,
        45 * 60
      );
    }

    // Regulation has ended: freeze server snapshot.
    // if (match.phase === "regulation_ended") {
    //   return (
    //     match.regulation_elapsed_seconds ??
    //     match.clock_seconds ??
    //     90 * 60
    //   );
    // }
    if (match.phase === "regulation_ended") {
      return Math.max(
        match.regulation_elapsed_seconds ?? 0,
        match.clock_seconds ?? 0,
        90 * 60
      );
    }

    // Interval between ET halves.
    // if (match.phase === "extra_time_interval") {
    //   return (
    //     match.extra_time_first_half_elapsed_seconds ??
    //     match.clock_seconds ??
    //     105 * 60
    //   );
    // }
    if (match.phase === "extra_time_interval") {
      return Math.max(
        90 * 60 +
        (match.extra_time_first_half_elapsed_seconds ?? 0),
        105 * 60
      );
    }
    // Penalty shootout has no running match clock.
    if (match.phase === "penalty_shootout") {
      return Math.max(
        match.extra_time_elapsed_seconds ?? 0,
        match.clock_seconds ?? 0,
        120 * 60
      );
    }

    let anchor: string | null = null;
    let baseSeconds = 0;
    let pauseBaseline = 0;

    switch (match.phase) {
      case "first_half":
        anchor = match.started_at;
        baseSeconds = 0;
        pauseBaseline = 0;
        break;

      case "second_half":
        anchor = match.second_half_started_at ?? null;
        baseSeconds = 45 * 60;
        pauseBaseline =
          match.second_half_pause_baseline_seconds ?? 0;
        break;

      case "extra_time_first_half":
        anchor =
          match.extra_time_first_half_started_at ?? null;
        baseSeconds = 90 * 60;
        pauseBaseline =
          match.extra_time_first_half_pause_baseline_seconds ?? 0;
        break;

      case "extra_time_second_half":
        anchor =
          match.extra_time_second_half_started_at ?? null;
        baseSeconds = 105 * 60;
        pauseBaseline =
          match.extra_time_second_half_pause_baseline_seconds ?? 0;
        break;

      default:
        return match.clock_seconds ?? 0;
    }

    if (!anchor) {
      return match.clock_seconds ?? baseSeconds;
    }

    const startedAt = new Date(anchor).getTime();

    if (!Number.isFinite(startedAt)) {
      return match.clock_seconds ?? baseSeconds;
    }

    const referenceAt =
      match.is_paused && match.paused_at
        ? new Date(match.paused_at).getTime()
        : clockNow;

    if (!Number.isFinite(referenceAt)) {
      return match.clock_seconds ?? baseSeconds;
    }

    const phasePausedSeconds = Math.max(
      0,
      match.total_paused_seconds - pauseBaseline
    );

    return (
      baseSeconds +
      Math.max(
        0,
        Math.floor((referenceAt - startedAt) / 1000) -
        phasePausedSeconds
      )
    );
  }, [match, clockNow]);

  const phaseLabel =
    match?.status === "finished"
      ? "FULL TIME"
      : match?.phase === "first_half"
        ? "FIRST HALF"
        : match?.phase === "half_time"
          ? "HALF TIME"
          : match?.phase === "second_half"
            ? "SECOND HALF"
            : match?.phase === "regulation_ended"
              ? "REGULATION ENDED"
              : match?.phase === "extra_time_first_half"
                ? "EXTRA TIME · FIRST HALF"
                : match?.phase === "extra_time_interval"
                  ? "EXTRA TIME · HALF TIME"
                  : match?.phase === "extra_time_second_half"
                    ? "EXTRA TIME · SECOND HALF"
                    : match?.phase === "penalty_shootout"
                      ? "PENALTY SHOOTOUT"
                      : match?.phase === "full_time"
                        ? "FULL TIME"
                        : "AWAITING KICKOFF";
  const activeStoppage = match?.phase === "first_half"
    ? (match.first_half_stoppage_minutes ?? match.extra_time_minutes)
    : match?.phase === "second_half"
      ? (match.second_half_stoppage_minutes ?? match.extra_time_minutes)
      : 0;

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







  useEffect(() => {

    let cancelled = false;

    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    let refreshSequence = 0;



    if (!Number.isInteger(matchId) || matchId <= 0) {

      setError("Invalid match ID."); setLoading(false); return;

    }



    const matchUrl = `${API_BASE_URL}/matches/${matchId}/`;

    const eventsUrl = `${API_BASE_URL}/matches/${matchId}/events/`;

    const socketUrl = `${WS_BASE_URL}/ws/matches/${matchId}/`;



    async function refreshMatch(showLoader = false) {

      const sequence = ++refreshSequence;

      try {

        if (showLoader) { setLoading(true); setError(""); }

        const [matchResponse, eventsResponse] = await Promise.all([

          fetch(matchUrl, { cache: "no-store" }),

          fetch(eventsUrl, { cache: "no-store" }),

        ]);

        if (!matchResponse.ok) throw new Error(`Unable to load match (HTTP ${matchResponse.status}).`);

        if (!eventsResponse.ok) throw new Error(`Unable to load match events (HTTP ${eventsResponse.status}).`);

        const updatedMatch: Match = await matchResponse.json();

        const eventsData: unknown = await eventsResponse.json();

        if (cancelled || sequence !== refreshSequence) return;

        setMatch(updatedMatch);

        const latestEvents = normalizeEvents(eventsData);

        setEvents(current => {

          const merged = new Map<number, MatchEvent>();

          latestEvents.forEach(item => merged.set(item.id, item));

          current.forEach(item => { if (!merged.has(item.id)) merged.set(item.id, item); });

          return sortEvents(Array.from(merged.values()));

        });

        setError("");

      } catch (err) {

        if (cancelled || sequence !== refreshSequence) return;

        console.error("Match synchronization failed:", err);

        setError(err instanceof Error ? err.message : "Unable to load match.");

      } finally {

        if (!cancelled && sequence === refreshSequence && showLoader) setLoading(false);

      }

    }

    function scheduleRefresh() {

      if (refreshTimer) clearTimeout(refreshTimer);

      refreshTimer = setTimeout(() => {

        refreshTimer = null;

        if (!cancelled) void refreshMatch();

      }, 200);

    }

    function connectSocket() {

      if (cancelled) return;

      const currentSocket = new WebSocket(socketUrl);

      socket = currentSocket;

      currentSocket.addEventListener("open", () => {

        if (cancelled) currentSocket.close(1000, "Component unmounted");

      });

      currentSocket.onopen = () => {

        if (cancelled) return;

        setSocketConnected(true);

        scheduleRefresh();

      };

      currentSocket.onmessage = (message: MessageEvent) => {

        if (cancelled) return;

        try {

          const data: SocketUpdate = JSON.parse(message.data);

          if (data.type === "connection") return;

          if (data.match_id !== undefined && Number(data.match_id) !== matchId) return;

          // setMatch(current => current ? ({

          //   ...current, status: data.status ?? current.status,

          //   home_score: data.home_score ?? current.home_score,

          //   away_score: data.away_score ?? current.away_score,

          //   started_at: data.started_at !== undefined ? data.started_at : current.started_at,

          //   ended_at: data.ended_at !== undefined ? data.ended_at : current.ended_at,

          // }) : current);



          setMatch((current) =>

            current

              ? {

                ...current,



                status:

                  data.status ?? current.status,



                home_score:

                  data.home_score ??

                  current.home_score,



                away_score:

                  data.away_score ??

                  current.away_score,



                started_at:

                  data.started_at !== undefined

                    ? data.started_at

                    : current.started_at,



                ended_at:

                  data.ended_at !== undefined

                    ? data.ended_at

                    : current.ended_at,



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
                second_half_pause_baseline_seconds: data.second_half_pause_baseline_seconds ?? current.second_half_pause_baseline_seconds,
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

                extra_time_first_half_ended_at:
                  data.extra_time_first_half_ended_at !== undefined
                    ? data.extra_time_first_half_ended_at
                    : current.extra_time_first_half_ended_at,

                extra_time_second_half_started_at:
                  data.extra_time_second_half_started_at !== undefined
                    ? data.extra_time_second_half_started_at
                    : current.extra_time_second_half_started_at,

                extra_time_second_half_ended_at:
                  data.extra_time_second_half_ended_at !== undefined
                    ? data.extra_time_second_half_ended_at
                    : current.extra_time_second_half_ended_at,

                extra_time_first_half_elapsed_seconds:
                  data.extra_time_first_half_elapsed_seconds ??
                  current.extra_time_first_half_elapsed_seconds,

                extra_time_elapsed_seconds:
                  data.extra_time_elapsed_seconds ??
                  current.extra_time_elapsed_seconds,

                extra_time_first_half_pause_baseline_seconds:
                  data.extra_time_first_half_pause_baseline_seconds ??
                  current.extra_time_first_half_pause_baseline_seconds,

                extra_time_second_half_pause_baseline_seconds:
                  data.extra_time_second_half_pause_baseline_seconds ??
                  current.extra_time_second_half_pause_baseline_seconds,

                extra_time_first_half_stoppage_minutes:
                  data.extra_time_first_half_stoppage_minutes ??
                  current.extra_time_first_half_stoppage_minutes,

                extra_time_second_half_stoppage_minutes:
                  data.extra_time_second_half_stoppage_minutes ??
                  current.extra_time_second_half_stoppage_minutes,

                shootout:
                  data.shootout !== undefined
                    ? data.shootout
                    : current.shootout,

                shootout_kicks:
                  data.shootout_kicks !== undefined
                    ? data.shootout_kicks
                    : current.shootout_kicks,

              }

              : current

          );



          if (data.match_event) {

            const incoming = data.match_event;

            const newEvent: MatchEvent = {

              id: incoming.id, team: incoming.team_id, type: incoming.type,

              player_name: incoming.player_name, minute: incoming.minute,

              points: incoming.points, note: incoming.note, created_at: new Date().toISOString(),

            };

            setEvents(current => current.some(item => item.id === newEvent.id) ? current : sortEvents([...current, newEvent]));

          }

          scheduleRefresh();

        } catch (err) { console.error("Invalid WebSocket message:", err); }

      };

      currentSocket.onerror = () => { if (!cancelled) setSocketConnected(false); };

      currentSocket.onclose = () => {

        if (cancelled) return;

        setSocketConnected(false);

        if (reconnectTimer) clearTimeout(reconnectTimer);

        reconnectTimer = setTimeout(() => {

          reconnectTimer = null;

          if (!cancelled) connectSocket();

        }, 3000);

      };

    }

    async function initialize() {

      await refreshMatch(true);

      if (!cancelled) connectSocket();

    }

    void initialize();

    return () => {

      cancelled = true;

      refreshSequence += 1;

      if (refreshTimer) clearTimeout(refreshTimer);

      if (reconnectTimer) clearTimeout(reconnectTimer);

      if (socket) {

        const currentSocket = socket as WebSocket;

        currentSocket.onopen = null;

        currentSocket.onmessage = null;

        currentSocket.onerror = null;

        currentSocket.onclose = null;

        if (currentSocket.readyState === WebSocket.OPEN) currentSocket.close(1000, "Component unmounted");

      }

    };

  }, [matchId]);



  const eventSummary = useMemo(() => ({

    goals: events.filter(e => e.type === "goal").length,

    cards: events.filter(e => e.type === "yellow_card" || e.type === "red_card").length,

    penalties: events.filter(e => e.type === "penalty_kick").length,

  }), [events]);



  if (loading) return <main className="flex min-h-[75vh] items-center justify-center bg-[#090E13] px-5 text-white"><div className="text-center"><Radio className="mx-auto animate-pulse text-[#F5C66C]" size={40} /><p className="mt-5 font-heading text-xl font-bold">Tuning into Match Centre...</p><p className="mt-2 text-sm text-[#91A0AC]">Preparing the live broadcast</p></div></main>;

  if (!match) return <main className="flex min-h-[75vh] items-center justify-center bg-[#090E13] px-5 text-white"><div className="text-center"><Trophy className="mx-auto text-[#F5C66C]" size={42} /><h1 className="mt-5 font-heading text-3xl font-bold">Match not found</h1><p className="mt-3 text-sm text-[#AAB5C0]">{error || "Unable to load this match."}</p><Link href="/matches" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#F5C66C] px-5 py-3 text-xs font-extrabold text-[#11161C]"><ArrowLeft size={15} /> All Matches</Link></div></main>;



  const home = match.home_team;

  const away = match.away_team;

  const played = match.status !== "scheduled";
  const shootoutHomeScore = match.shootout?.home_score ?? 0;
  const shootoutAwayScore = match.shootout?.away_score ?? 0;

  const shootoutFinished =
    match.shootout?.is_finished ?? false;

  const shootoutWinnerId =
    match.shootout?.winner_id ?? null;

  const shootoutWinnerName =
    shootoutWinnerId === home.id
      ? home.name
      : shootoutWinnerId === away.id
        ? away.name
        : null;

  const hasShootoutResult =
    match.is_knockout &&
    shootoutFinished &&
    shootoutWinnerId !== null;



  return <main className="min-h-screen bg-[#090E13] text-white">

    {/* IMMERSIVE MATCH BROADCAST */}

    <section className="relative isolate overflow-hidden border-b border-white/10">

      <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: "url('https\://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2000&q=85')" }} />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,19,.68)_0%,rgba(9,14,19,.78)_42%,#090E13_100%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[400px] max-w-[850px] -translate-y-1/2 rounded-full bg-[#F5C66C]/[.045] blur-[100px]" />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-7 md:px-8 xl:px-12">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-5"><Link href="/matches" className="inline-flex items-center gap-2 text-xs font-semibold text-[#B6C1CA] transition hover:text-[#F5C66C]"><ArrowLeft size={15} /> All Matches</Link><span className="hidden h-4 w-px bg-white/20 sm:block" /><Link href="/live" className="hidden items-center gap-2 text-xs text-[#A3B0BC] hover:text-[#F5C66C] sm:inline-flex"><Radio size={14} /> Live Scoreboard</Link></div>

          <span className={`inline-flex items-center gap-2 text-[10px] font-bold tracking-[.1em] ${socketConnected ? "text-[#F5C66C]" : "text-[#A2AFBB]"}`}>{socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}{socketConnected ? "REALTIME CONNECTED" : "RECONNECTING FEED"}</span>

        </div>

        <div className="mt-12 flex flex-col items-center text-center sm:mt-16">

          <p className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[.24em] text-[#F5C66C]"><span className="h-px w-7 bg-[#F5C66C]/65" /> FOOTBALLCUP / MATCH {String(match.id).padStart(3, "0")} <span className="h-px w-7 bg-[#F5C66C]/65" /></p>

          {/* <div className="mt-5"><Status status={match.status}  isPaused={match.is_paused} /></div> */}



          <div className="mt-5">

            <Status

              status={match.status}

              isPaused={match.is_paused}

            />

          </div>



          {/* PUBLIC LIVE MATCH CLOCK */}



          {match.status !== "scheduled" && (

            <div className="mt-6 flex flex-col items-center gap-3">



              <div

                className={`flex items-center gap-3 rounded-xl border px-6 py-3 ${match.is_paused

                    ? "border-[#F5C66C]/45 bg-[#F5C66C]/10"

                    : "border-white/15 bg-[#151D26]/80"

                  }`}

              >

                <Clock3

                  size={19}

                  className="text-[#F5C66C]"

                />



                <span className="font-mono text-3xl font-extrabold tabular-nums tracking-[-.06em] text-white">

                  {clockDisplay}

                </span>



                {activeStoppage > 0 && (

                  <span className="border-l border-white/20 pl-3 font-mono text-lg font-bold text-[#F5C66C]">

                    +{activeStoppage}&apos;

                  </span>

                )}

              </div>



              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#F5C66C]">{phaseLabel}</p>

              {match.phase === "half_time" && (
                <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#F5C66C]">Half-time break — clock stopped</p>
              )}
              {match.is_paused && (

                <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#F5C66C]">

                  Match temporarily suspended

                </p>

              )}



              {match.status === "finished" && (

                <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#A8B5C0]">

                  Final match duration

                </p>

              )}



            </div>

          )}



          <div className="mt-9 grid w-full max-w-[1000px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">

            <div className="flex min-w-0 flex-col items-center"><Crest team={home} big /><span className="mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-[#B79C70]">Home Side</span><h1 className="mt-2 max-w-[290px] break-words font-heading text-lg font-extrabold leading-tight tracking-[-.04em] sm:text-3xl">{home.name}</h1><span className="mt-2 font-mono text-xs text-[#8796A4]">{home.code}</span></div>

            {/* <div className="min-w-[92px] px-1 text-center sm:min-w-[240px]"><div className="font-mono text-[clamp(38px,7vw,104px)] font-extrabold leading-none tracking-[-.105em] drop-shadow-[0_0_35px_rgba(245,198,108,.14)]">{played ? match.home_score : "–"}<span className="mx-2 text-[#A98E60] sm:mx-4">:</span>{played ? match.away_score : "–"}</div><p className={`mt-5 text-[10px] font-extrabold uppercase tracking-[.23em] ${match.status === "live" ? "text-[#FF8E97]" : "text-[#E3C18A]"}`}>{match.status === "live" ? "● IN PLAY" : match.status === "finished" ? "FULL TIME" : "VS"}</p></div> */}



            <div className="min-w-[92px] px-1 text-center sm:min-w-[240px]">

              {/* SCORE DISPLAY */}

              <div className="font-mono text-[clamp(38px,7vw,104px)] font-extrabold leading-none tracking-[-.105em] drop-shadow-[0_0_35px_rgba(245,198,108,.14)]">

                {played ? match.home_score : "–"}



                <span className="mx-2 text-[#A98E60] sm:mx-4">

                  :

                </span>



                {played ? match.away_score : "–"}

              </div>



              {/* MATCH STATUS */}

              <p

                className={`mt-5 text-[10px] font-extrabold uppercase tracking-[.23em] ${match.is_paused

                  ? "text-[#F5C66C]"

                  : match.status === "live"

                    ? "text-[#FF8E97]"

                    : "text-[#E3C18A]"

                  }`}

              >

                {match.is_paused

                  ? "Ⅱ PAUSED"

                  : match.status === "live"

                    ? "● IN PLAY"

                    : match.status === "finished"

                      ? "FULL TIME"

                      : "VS"}

              </p>
              {hasShootoutResult && (
                <div className="mt-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">
                    Penalties
                  </p>

                  <p className="mt-2 font-mono text-3xl font-extrabold text-white">
                    {shootoutHomeScore}
                    <span className="mx-3 text-[#A98E60]">:</span>
                    {shootoutAwayScore}
                  </p>

                  {shootoutWinnerName && (
                    <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F5C66C]">
                      {shootoutWinnerName} wins on penalties
                    </p>
                  )}
                </div>
              )}

            </div>





            <div className="flex min-w-0 flex-col items-center"><Crest team={away} big /><span className="mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-[#B79C70]">Away Side</span><h2 className="mt-2 max-w-[290px] break-words font-heading text-lg font-extrabold leading-tight tracking-[-.04em] sm:text-3xl">{away.name}</h2><span className="mt-2 font-mono text-xs text-[#8796A4]">{away.code}</span></div>

          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs text-[#BAC5CE]"><span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-[#F5C66C]" /> {formatDate(match.scheduled_at)}</span><span className="inline-flex items-center gap-2"><MapPin size={14} className="text-[#F5C66C]" /> {match.venue || "Venue TBA"}</span></div>

        </div>

      </div>

    </section>



    {/* MATCH METADATA STRIP */}

    <section className="border-b border-white/[.08] bg-[#151D26]"><div className="mx-auto grid max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 md:px-8 xl:px-12">{[

      { icon: Clock3, label: "Kickoff", value: formatDate(match.scheduled_at) },

      { icon: Radio, label: "Match Started", value: formatDate(match.started_at) },

      { icon: Flag, label: "Final Whistle", value: formatDate(match.ended_at) },

      { icon: MapPin, label: "Venue", value: match.venue || "Not specified" },

    ].map((item, i) => { const Icon = item.icon; return <div key={item.label} className={`flex min-w-0 items-start gap-3 py-5 ${i > 0 ? "sm:border-l sm:border-white/[.08] sm:pl-5" : ""} ${i > 1 ? "border-t border-white/[.08] sm:border-t-0" : ""}`}><Icon size={17} className="mt-0.5 shrink-0 text-[#F5C66C]" /><div className="min-w-0"><p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#8393A0]">{item.label}</p><p className="mt-1 break-words text-xs font-bold leading-5 text-[#E1E8ED]">{item.value}</p></div></div>; })}</div></section>



    <div className="mx-auto max-w-[1440px] px-5 py-12 md:px-8 xl:px-12">

      {error && <div className="mb-8 rounded-lg border border-[#EF6672]/35 bg-[#EF6672]/10 p-4 text-sm text-[#FFB2B9]">{error}</div>}

      {/* Editorial section heading */}

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#F5C66C]">The Story Of The Match</p><h2 className="mt-2 font-heading text-3xl font-extrabold tracking-[-.06em] sm:text-4xl">Match Commentary<span className="text-[#F5C66C]">.</span></h2><p className="mt-3 text-sm text-[#91A0AC]">Every goal, decision and defining moment, in chronological order.</p></div><div className="flex items-center gap-2 rounded-md border border-[#35414C] bg-[#151E27] px-3 py-2 font-mono text-[11px] text-[#D0DAE2]"><Zap size={13} className="text-[#F5C66C]" /> {events.length} EVENTS</div></div>

      {/* Asymmetric 2-column editorial layout */}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">

        <section className="overflow-hidden rounded-xl border border-[#303C47] bg-[#121B24]">

          <div className="grid grid-cols-[1fr_48px_1fr] items-center border-b border-[#303C47] bg-[linear-gradient(90deg,#302B28,#1A242E_50%,#302B28)] px-4 py-5 sm:grid-cols-[1fr_76px_1fr] sm:px-7"><div className="flex min-w-0 items-center gap-2"><Crest team={home} /><p className="truncate font-heading text-sm font-bold sm:text-base">{home.name}</p></div><div className="text-center font-mono text-[10px] font-bold tracking-[.16em] text-[#A9916C]">MIN</div><div className="flex min-w-0 items-center justify-end gap-2"><p className="truncate text-right font-heading text-sm font-bold sm:text-base">{away.name}</p><Crest team={away} /></div></div>

          {events.length === 0 ? <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-14 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#F5C66C]/25 bg-[#F5C66C]/[.07]"><Radio size={27} className="text-[#F5C66C]" /></div><h3 className="mt-5 font-heading text-xl font-bold">Awaiting the first moment</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#8F9EAB]">Kickoff, goals, cards and live match announcements will appear here as the match unfolds.</p></div> : <div className="relative px-3 py-6 sm:px-7 sm:py-8"><div className="pointer-events-none absolute bottom-7 left-1/2 top-7 w-px -translate-x-1/2 bg-gradient-to-b from-[#F5C66C]/60 via-[#3B4752] to-[#3B4752]" /><div className="space-y-4">

            {sortEvents(events).map(event => {



              // Match-wide system announcements belong to neither team.

              if (isSystemEvent(event.type) || teamIdOf(event) === null) {

                return (

                  <div

                    key={event.id}

                    className="relative z-10 flex justify-center py-2"

                  >

                    <div className="

          w-full max-w-[470px]

          rounded-xl border border-[#F5C66C]/30

          bg-[linear-gradient(135deg,#292A2B,#18232D)]

          px-5 py-4 text-center

          shadow-[0_8px_30px_rgba(0,0,0,.15)]

        ">

                      <div className="flex items-center justify-center gap-2">

                        <span className="text-lg">

                          {eventSymbol(event.type)}

                        </span>



                        <span className="

              text-[11px] font-extrabold uppercase

              tracking-[.15em] text-[#F5C66C]

            ">

                          {eventLabel(event.type)}

                        </span>

                      </div>



                      <p className="mt-2 font-mono text-xs font-bold text-white">

                        {event.minute}'

                      </p>



                      {event.note && (

                        <p className="

              mx-auto mt-2 max-w-[380px]

              text-xs leading-5 text-[#B6C3CD]

            ">

                          {event.note}

                        </p>

                      )}

                    </div>

                  </div>

                );

              }



              // Existing home/away football commentary continues below.

              const teamId = teamIdOf(event);



              const isHome = teamId === home.id;

              const team = isHome ? home : teamId === away.id ? away : null;

              const isGoal = event.type === "goal";

              return <div key={event.id} className="relative grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] sm:gap-3"><div className={isHome ? "flex justify-end" : ""}>{isHome && <div className={`w-full max-w-[340px] border-l-2 p-3 sm:p-4 ${isGoal ? "border-[#F5C66C] bg-[#F5C66C]/[.09]" : "border-[#4B5965] bg-[#202B35]"}`}><div className="flex flex-wrap items-center gap-2"><span className="text-lg">{eventSymbol(event.type)}</span><span className={`text-xs font-extrabold ${isGoal ? "text-[#F5C66C]" : "text-white"}`}>{eventLabel(event.type)}</span></div><p className="mt-1 break-words text-xs font-bold text-[#E3EAF0]">{event.player_name || team?.name || `Team #${teamId}`}</p>{event.player_name && <p className="mt-1 text-[10px] text-[#98A7B3]">{team?.name || `Team #${teamId}`}</p>}{event.note && <p className="mt-2 break-words text-[11px] leading-5 text-[#A9B6C0]">{event.note}</p>}{event.type === "reward" && event.points !== 0 && <p className="mt-2 text-[11px] font-extrabold text-[#F5C66C]">{event.points > 0 ? "+" : ""}{event.points} bonus points</p>}</div>}</div><div className="relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C66C]/50 bg-[#242B31] font-mono text-xs font-extrabold text-[#F5C66C] sm:h-12 sm:w-12">{event.minute}'</div><div>{!isHome && <div className={`w-full max-w-[340px] border-r-2 p-3 sm:p-4 ${isGoal ? "border-[#F5C66C] bg-[#F5C66C]/[.09]" : "border-[#4B5965] bg-[#202B35]"}`}><div className="flex flex-wrap items-center gap-2"><span className="text-lg">{eventSymbol(event.type)}</span><span className={`text-xs font-extrabold ${isGoal ? "text-[#F5C66C]" : "text-white"}`}>{eventLabel(event.type)}</span></div><p className="mt-1 break-words text-xs font-bold text-[#E3EAF0]">{event.player_name || team?.name || `Team #${teamId}`}</p>{event.player_name && <p className="mt-1 text-[10px] text-[#98A7B3]">{team?.name || `Team #${teamId}`}</p>}{event.note && <p className="mt-2 break-words text-[11px] leading-5 text-[#A9B6C0]">{event.note}</p>}{event.type === "reward" && event.points !== 0 && <p className="mt-2 text-[11px] font-extrabold text-[#F5C66C]">{event.points > 0 ? "+" : ""}{event.points} bonus points</p>}</div>}</div></div>;

            })}</div></div>}

          <div className="flex items-center justify-center gap-2 border-t border-[#303C47] bg-[#17212A] px-5 py-4 text-[10px] font-bold uppercase tracking-[.15em] text-[#8D9CA9]"><Flag size={13} className="text-[#F5C66C]" /> End of recorded commentary</div>

        </section>

        {/* Sidebar: compact insight dashboard, deliberately different shape */}

        <aside className="space-y-5"><div className="overflow-hidden rounded-xl border border-[#F5C66C]/25 bg-[linear-gradient(145deg,#302B27,#151E27_72%)] p-6"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#F5C66C]"><Trophy size={16} /> Match Snapshot</div><p className="mt-6 font-heading text-5xl font-extrabold tracking-[-.08em]">{played ? `${match.home_score} : ${match.away_score}` : "VS"}</p><p className="mt-2 text-xs text-[#AAB7C1]">{home.code} <span className="mx-2 text-[#F5C66C]">/</span> {away.code}</p><div className="mt-6 h-px bg-[#F5C66C]/20" /><div className="mt-5 flex items-center justify-between text-xs"><span className="text-[#91A0AC]">Match status</span><span className="font-bold uppercase text-[#F5C66C]">{match.status}</span></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-[#91A0AC]">Recorded moments</span><span className="font-mono font-bold">{events.length}</span></div></div>

          <div className="overflow-hidden rounded-xl border border-[#303C47] bg-[#141D26]"><div className="border-b border-[#303C47] px-5 py-4"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#F5C66C]">By The Numbers</p><h3 className="mt-1 font-heading text-lg font-bold">Match Activity</h3></div><div className="grid grid-cols-3 divide-x divide-[#303C47] py-6 text-center"><div><p className="font-mono text-3xl font-extrabold text-white">{eventSummary.goals}</p><p className="mt-2 text-[10px] uppercase tracking-[.1em] text-[#8D9CA9]">Goals</p></div><div><p className="font-mono text-3xl font-extrabold text-white">{eventSummary.cards}</p><p className="mt-2 text-[10px] uppercase tracking-[.1em] text-[#8D9CA9]">Cards</p></div><div><p className="font-mono text-3xl font-extrabold text-white">{eventSummary.penalties}</p><p className="mt-2 text-[10px] uppercase tracking-[.1em] text-[#8D9CA9]">Penalties</p></div></div></div>

          <Link href="/matches" className="group flex items-center justify-between rounded-xl border border-[#35424E] bg-[#19232D] p-5 transition hover:border-[#F5C66C]/50"><div><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-[#F5C66C]">Explore More</p><p className="mt-2 font-heading text-lg font-bold">All Fixtures</p><p className="mt-1 text-xs text-[#91A0AC]">Results and upcoming matches</p></div><ArrowRight size={20} className="text-[#F5C66C] transition group-hover:translate-x-1" /></Link>

          <Link href="/live" className="group flex items-center justify-between rounded-xl border border-[#35424E] bg-[#19232D] p-5 transition hover:border-[#F5C66C]/50"><div><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-[#F5C66C]">Never Miss A Goal</p><p className="mt-2 font-heading text-lg font-bold">Live Scoreboard</p><p className="mt-1 text-xs text-[#91A0AC]">Follow every match in play</p></div><Radio size={20} className="text-[#F5C66C]" /></Link>

        </aside>

      </div>

    </div>

    <section className="relative isolate overflow-hidden border-t border-white/10"><div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('https\://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1800&q=85')" }} /><div className="absolute inset-0 bg-gradient-to-r from-[#090E13] via-[#090E13]/90 to-[#090E13]/50" /><div className="relative mx-auto flex max-w-[1440px] flex-col justify-between gap-6 px-5 py-12 md:flex-row md:items-center md:px-8 xl:px-12"><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#F5C66C]">The Game Continues</p><h2 className="mt-2 font-heading text-3xl font-extrabold tracking-[-.05em]">Every match has a story.</h2><p className="mt-2 text-sm text-[#A8B5C0]">Explore more fixtures and follow the competition.</p></div><Link href="/matches" className="inline-flex shrink-0 items-center gap-3 self-start rounded-lg bg-[#F5C66C] px-6 py-3 text-xs font-extrabold uppercase text-[#11161C] transition hover:bg-[#FFDA91]">Browse All Matches <ArrowRight size={16} /></Link></div></section>

  </main>;

}
