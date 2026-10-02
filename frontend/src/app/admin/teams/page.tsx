
"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

const EMPTY_FORM: TeamForm = {
  name: "",
  code: "",
  logo: "",
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

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState<TeamForm>({ ...EMPTY_FORM });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);

      const allTeams: Team[] = [];

      let nextUrl: string | null =
        `${API_BASE_URL}/admin/teams/`;

      while (nextUrl !== null) {
        const currentUrl: string = nextUrl;

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
            ? new URL(data.next, currentUrl).toString()
            : null;
        }
      }

      setTeams(allTeams);
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
    void loadTeams();
  }, [loadTeams]);

  function showMessage(
    text: string,
    type: "success" | "error" = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function beginEditing(team: Team) {
    setEditingId(team.id);

    setForm({
      name: team.name,
      code: team.code,
      logo: team.logo ?? "",
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    const logo = form.logo.trim();

    if (!name || !code) {
      showMessage("Team name and short code are required.", "error");
      return;
    }

    setSaving(true);
    setMessage("");

    const isEditing = editingId !== null;

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

      const data = await response.json().catch(() => ({}));

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

      await loadTeams();

      showMessage(
        isEditing
          ? "Team updated successfully."
          : "Team created successfully."
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
        const data = await response.json().catch(() => ({}));

        throw new Error(
          getApiError(data, "Unable to delete team.")
        );
      }

      if (editingId === team.id) {
        resetForm();
      }

      await loadTeams();

      showMessage("Team deleted successfully.");
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

  const teamsWithLogos = teams.filter(
    (team) => Boolean(team.logo)
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {/* Header */}

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
            Team Management
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Create, edit and manage participating football teams.
          </p>
        </header>

        {/* Summary */}

        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Total Teams
            </p>

            <p className="mt-3 text-3xl font-bold">
              {teams.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Teams With Logos
            </p>

            <p className="mt-3 text-3xl font-bold">
              {teamsWithLogos}
            </p>
          </div>
        </section>

        {/* Feedback */}

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

        {/* Create / Edit form */}

        <section className="mb-11 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {editingId !== null
                  ? `Edit Team #${editingId}`
                  : "Create New Team"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {editingId !== null
                  ? "Update the selected football team."
                  : "Add a new football team to the system."}
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
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
              <label htmlFor="team-name" className={labelClass}>
                Team Name
              </label>

              <input
                id="team-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g. Islamabad United"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="team-code" className={labelClass}>
                Short Code
              </label>

              <input
                id="team-code"
                type="text"
                maxLength={10}
                value={form.code}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g. ISL"
                className={inputClass}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="team-logo" className={labelClass}>
                Logo URL
                <span className="ml-2 font-normal text-slate-500">
                  (Optional)
                </span>
              </label>

              <input
                id="team-logo"
                type="url"
                value={form.logo}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    logo: e.target.value,
                  }))
                }
                placeholder="https://example.com/logo.png"
                className={inputClass}
              />

              <p className="mt-2 text-xs text-slate-500">
                Leave blank to display the team&apos;s short code
                instead of a logo.
              </p>
            </div>

            {/* Logo preview */}

            {form.logo.trim() && (
              <div className="md:col-span-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Logo Preview
                </p>

                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.logo.trim()}
                    alt="Team logo preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "+ Create Team"}
              </button>
            </div>
          </form>
        </section>

        {/* Existing Teams */}

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Existing Teams
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Teams currently available in the system.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTeams()}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 py-16 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

              <p className="mt-5 text-sm text-slate-400">
                Loading football teams...
              </p>
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900 px-6 py-16 text-center">
              <div className="text-5xl">⚽</div>

              <h3 className="mt-5 text-xl font-semibold">
                No teams yet
              </h3>

              <p className="mt-3 text-sm text-slate-400">
                Create your first team using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <article
                  key={team.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600"
                >
                  <div className="flex items-center gap-4">
                    {/* Logo */}

                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2">
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logo}
                          alt={`${team.name} logo`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xl font-extrabold text-blue-400">
                          {team.code.substring(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-lg border border-blue-900 bg-blue-950/40 px-2.5 py-1 text-xs font-bold tracking-wider text-blue-300">
                          {team.code}
                        </span>

                        <span className="text-xs text-slate-500">
                          #{team.id}
                        </span>
                      </div>

                      <h3 className="mt-3 truncate text-lg font-bold">
                        {team.name}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {team.logo
                          ? "Team logo configured"
                          : "No logo configured"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 border-t border-slate-800 pt-5">
                    <button
                      type="button"
                      onClick={() => beginEditing(team)}
                      disabled={saving || deletingId !== null}
                      className="flex-1 rounded-xl border border-blue-800 bg-blue-950/30 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteTeam(team)}
                      disabled={saving || deletingId !== null}
                      className="flex-1 rounded-xl border border-red-900 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingId === team.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Team Administration
        </footer>
      </div>
    </main>
  );
}
