
"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-300";

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
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to initialize CSRF protection.");
  }

  const token = getCookie("csrftoken");

  if (!token) {
    throw new Error(
      "CSRF cookie missing. Please refresh and try again."
    );
  }

  return token;
}

function getApiError(data: unknown, fallback: string): string {
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

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl !== null) {
    const currentUrl: string = nextUrl;

    const response = await fetch(currentUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

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

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [form, setForm] = useState<PlayerForm>({
    ...EMPTY_FORM,
  });

  const [editingId, setEditingId] = useState<number | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  function showMessage(
    text: string,
    type: "success" | "error" = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [loadedPlayers, loadedTeams] = await Promise.all([
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

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players.filter((player) => {
      const matchesSearch =
        !query ||
        player.full_name.toLowerCase().includes(query) ||
        player.team_name.toLowerCase().includes(query) ||
        String(player.jersey_number).includes(query);

      const matchesTeam =
        !teamFilter || String(player.team) === teamFilter;

      return matchesSearch && matchesTeam;
    });
  }, [players, search, teamFilter]);

  const activeCount = players.filter(
    (player) => player.is_active
  ).length;

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function beginEditing(player: Player) {
    setEditingId(player.id);

    setForm({
      team: String(player.team),
      full_name: player.full_name,
      jersey_number: String(player.jersey_number),
      position: player.position,
      is_active: player.is_active,
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    const fullName = form.full_name.trim();
    const teamId = Number(form.team);
    const jerseyNumber = Number(form.jersey_number);

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
      showMessage("Please select a valid team.", "error");
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

    setSaving(true);
    setMessage("");

    const isEditing = editingId !== null;

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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            isEditing
              ? "Unable to update player."
              : "Unable to create player."
          )
        );
      }

      resetForm();
      await loadData();

      showMessage(
        isEditing
          ? "Player updated successfully."
          : "Player created successfully."
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

  async function deletePlayer(player: Player) {
    if (deletingId !== null) return;

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
        const data = await response.json().catch(() => ({}));

        throw new Error(
          getApiError(data, "Unable to delete player.")
        );
      }

      if (editingId === player.id) {
        resetForm();
      }

      await loadData();
      showMessage("Player deleted successfully.");
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

  async function toggleActive(player: Player) {
    if (saving) return;

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

      const data = await response.json().catch(() => ({}));

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

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <header className="mb-9">
          <Link
            href="/admin"
            className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
          >
            ← Admin Dashboard
          </Link>

          <p className="mt-7 text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            Tournament Administration
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Player Management
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Register football players, manage their team
            assignments and update their availability.
          </p>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            ["Total Players", players.length],
            ["Active Players", activeCount],
            ["Inactive Players", players.length - activeCount],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {label}
              </p>
              <p className="mt-3 text-3xl font-bold">
                {value}
              </p>
            </div>
          ))}
        </section>

        {message && (
          <div
            role="alert"
            className={`mb-7 rounded-xl border px-5 py-4 text-sm ${
              messageType === "error"
                ? "border-red-900 bg-red-950/40 text-red-300"
                : "border-green-900 bg-green-950/30 text-green-300"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mb-11 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {editingId !== null
                  ? `Edit Player #${editingId}`
                  : "Register New Player"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {editingId !== null
                  ? "Update the selected player's details."
                  : "Add a registered player to an existing team."}
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
              >
                Cancel Editing
              </button>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-2"
          >
            <div>
              <label htmlFor="player-name" className={labelClass}>
                Full Name
              </label>
              <input
                id="player-name"
                type="text"
                maxLength={100}
                value={form.full_name}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    full_name: e.target.value,
                  }))
                }
                placeholder="e.g. Ahmed Khan"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="player-team" className={labelClass}>
                Team
              </label>
              <select
                id="player-team"
                value={form.team}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    team: e.target.value,
                  }))
                }
                className={inputClass}
                required
              >
                <option value="">Select a team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="player-jersey" className={labelClass}>
                Jersey Number
              </label>
              <input
                id="player-jersey"
                type="number"
                min={1}
                max={99}
                step={1}
                value={form.jersey_number}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    jersey_number: e.target.value,
                  }))
                }
                placeholder="1–99"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="player-position" className={labelClass}>
                Position
              </label>
              <select
                id="player-position"
                value={form.position}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    position: e.target.value as Position,
                  }))
                }
                className={inputClass}
              >
                {(
                  Object.entries(POSITIONS) as [
                    Position,
                    string
                  ][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    is_active: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-blue-500"
              />
              <span className="text-sm font-medium text-slate-300">
                Active player
              </span>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || loading || teams.length === 0}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "+ Register Player"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Registered Players
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Browse and manage your football squads.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm text-slate-300 hover:border-blue-500 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, team or jersey number..."
              className={inputClass}
            />

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
              <p className="mt-5 text-sm text-slate-400">
                Loading registered players...
              </p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900 px-6 py-16 text-center">
              <div className="text-5xl">⚽</div>
              <h3 className="mt-5 text-xl font-semibold">
                No players found
              </h3>
              <p className="mt-3 text-sm text-slate-400">
                Register a player above or adjust your filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredPlayers.map((player) => (
                <article
                  key={player.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-900 bg-blue-950/40 text-2xl font-extrabold text-blue-300">
                      {player.jersey_number}
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        player.is_active
                          ? "border-green-900 bg-green-950/40 text-green-300"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                      }`}
                    >
                      {player.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold">
                    {player.full_name}
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    {player.team_name}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                    <span className="text-sm text-slate-400">
                      Position
                    </span>
                    <span className="text-sm font-semibold text-blue-300">
                      {POSITIONS[player.position]}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => beginEditing(player)}
                      disabled={saving || deletingId !== null}
                      className="rounded-xl border border-blue-800 bg-blue-950/30 px-3 py-2.5 text-sm font-semibold text-blue-300 hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleActive(player)}
                      disabled={saving || deletingId !== null}
                      className="rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 disabled:opacity-50"
                    >
                      {player.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void deletePlayer(player)}
                      disabled={saving || deletingId !== null}
                      className="col-span-2 rounded-xl border border-red-900 bg-red-950/20 px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingId === player.id
                        ? "Deleting..."
                        : "Delete Player"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Player Administration
        </footer>
      </div>
    </main>
  );
}
