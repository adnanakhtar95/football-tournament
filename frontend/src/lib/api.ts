export interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
}

export interface Match {
  id: number;
  home_team: Team;
  away_team: Team;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  started_at: string | null;
  ended_at: string | null;
  home_score: number;
  away_score: number;
}

export interface Round {
  id: number;
  name: string;
  order_number: number;
  matches: Match[];
}

export interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "completed";
  teams: Team[];
  rounds: Round[];
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${API_BASE_URL}/events/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  const data: PaginatedResponse<Event> = await response.json();

  return data.results;
}

export interface Standing {
  team_id: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export async function getStandings(eventId: number): Promise<Standing[]> {
  const response = await fetch(
    `${API_BASE_URL}/events/${eventId}/standings/`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch standings");
  }

  return response.json();
}

export async function getMatches(): Promise<Match[]> {
  const response = await fetch(`${API_BASE_URL}/matches/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch matches");
  }

  const data: PaginatedResponse<Match> = await response.json();

  return data.results;
}

export async function getMatch(id: number): Promise<Match> {
  const response = await fetch(`${API_BASE_URL}/matches/${id}/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch match");
  }

  return response.json();
}