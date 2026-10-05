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
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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
  let url: string | null = `${API_BASE_URL}/matches/`;

  const matchesById = new Map<number, Match>();
  const visitedUrls = new Set<string>();

  while (url) {
    // Protect against a malformed pagination loop.
    if (visitedUrls.has(url)) {
      console.warn("Duplicate pagination URL detected:", url);
      break;
    }

    visitedUrls.add(url);

    const response: Response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load matches (HTTP ${response.status}).`
      );
    }

    const data: unknown = await response.json();

    // Non-paginated response
    if (Array.isArray(data)) {
      for (const match of data as Match[]) {
        matchesById.set(match.id, match);
      }

      break;
    }

    // Paginated DRF response
    const page = data as {
      results?: Match[];
      next?: string | null;
    };

    if (Array.isArray(page.results)) {
      for (const match of page.results) {
        matchesById.set(match.id, match);
      }
    }

    url = page.next ?? null;
  }

  return Array.from(matchesById.values());
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

export async function getCsrfToken() {
  await fetch(`${API_BASE_URL}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });
}

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