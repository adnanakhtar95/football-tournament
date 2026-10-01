"use client";

import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

interface Team {
  id: number;
  name: string;
  code: string;
  logo: string | null;
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

async function getCsrfToken(): Promise<string | null> {
  const response = await fetch(
    `${API_BASE_URL}/auth/csrf/`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to initialize CSRF protection.");
  }

  return getCookie("csrftoken");
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    code: "",
    logo: "",
  });

  async function loadTeams() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/admin/teams/`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        setMessage("Unable to load teams.");
        return;
      }

      const data = await response.json();

      setTeams(data.results ?? data);
    } catch {
      setMessage("Unable to connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      if (!csrfToken) {
        setMessage(
          "CSRF token missing. Please refresh the page and try again."
        );
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/teams/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            logo: form.logo.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data.detail ||
          Object.values(data)
            .flat()
            .join(" ");

        setMessage(
          errorMessage || "Unable to create team."
        );
        return;
      }

      setForm({
        name: "",
        code: "",
        logo: "",
      });

      setMessage("Team created successfully.");

      await loadTeams();
    } catch (error) {
      console.error("CREATE TEAM ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create team."
      );
    }
  }

  async function deleteTeam(id: number) {
    if (!window.confirm("Delete this team?")) {
      return;
    }

    setMessage("");

    try {
      const csrfToken = await getCsrfToken();

      if (!csrfToken) {
        setMessage(
          "CSRF token missing. Please refresh the page and try again."
        );
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/teams/${id}/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "X-CSRFToken": csrfToken,
          },
        }
      );

      if (!response.ok) {
        let data: any = {};

        try {
          data = await response.json();
        } catch {
          // No JSON response.
        }

        setMessage(
          data.detail ||
            "Unable to delete team."
        );

        return;
      }

      setMessage("Team deleted.");

      await loadTeams();
    } catch (error) {
      console.error("DELETE TEAM ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend."
      );
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">TOURNAMENT ADMIN</p>

          <h1>Teams</h1>

          <p className="subtitle">
            Create and manage teams participating in tournaments.
          </p>
        </div>

        <div className="team-count">
          <span>{teams.length}</span>
          <small>Teams</small>
        </div>
      </div>

      {message && (
        <div className="admin-message">
          {message}
        </div>
      )}

      <section className="admin-card">
        <div className="card-heading">
          <div>
            <h2>Create Team</h2>

            <p>
              Add a football team to the tournament system.
            </p>
          </div>
        </div>

        <form
          onSubmit={createTeam}
          className="team-form"
        >
          <div className="form-group">
            <label>Team Name</label>

            <input
              type="text"
              placeholder="e.g. Islamabad United"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Short Code</label>

            <input
              type="text"
              placeholder="e.g. ISL"
              maxLength={10}
              value={form.code}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value.toUpperCase(),
                })
              }
              required
            />
          </div>

          <div className="form-group full">
            <label>Logo URL</label>

            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={form.logo}
              onChange={(e) =>
                setForm({
                  ...form,
                  logo: e.target.value,
                })
              }
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
            >
              + Create Team
            </button>
          </div>
        </form>
      </section>

      <section className="teams-section">
        <div className="section-heading">
          <div>
            <h2>Existing Teams</h2>

            <p>
              Teams currently available in the system.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" />

            <p>Loading teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ⚽
            </div>

            <h3>No teams yet</h3>

            <p>
              Create your first team using the form above.
            </p>
          </div>
        ) : (
          <div className="team-grid">
            {teams.map((team) => (
              <article
                key={team.id}
                className="team-card"
              >
                <div className="team-logo">
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={`${team.name} logo`}
                    />
                  ) : (
                    <span>
                      {team.code.substring(0, 2)}
                    </span>
                  )}
                </div>

                <div className="team-info">
                  <div className="team-card-top">
                    <span className="team-code">
                      {team.code}
                    </span>

                    <span className="team-id">
                      #{team.id}
                    </span>
                  </div>

                  <h3>{team.name}</h3>

                  <p>
                    {team.logo
                      ? "Team logo configured"
                      : "No logo configured"}
                  </p>
                </div>

                <button
                  className="danger-button"
                  onClick={() =>
                    deleteTeam(team.id)
                  }
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          padding: 40px;
          background: #0f172a;
          color: #e2e8f0;
        }

        .admin-page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #60a5fa;
        }

        h1 {
          margin: 0;
          font-size: 36px;
          color: white;
        }

        .subtitle {
          margin-top: 8px;
          color: #94a3b8;
        }

        .team-count {
          min-width: 100px;
          padding: 16px 22px;
          border: 1px solid #334155;
          border-radius: 14px;
          background: #111c32;
          text-align: center;
        }

        .team-count span {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: #60a5fa;
        }

        .team-count small {
          color: #94a3b8;
        }

        .admin-message {
          margin-bottom: 24px;
          padding: 14px 18px;
          border-radius: 10px;
          background: #172554;
          border: 1px solid #1d4ed8;
          color: #bfdbfe;
        }

        .admin-card {
          background: #111c32;
          border: 1px solid #263449;
          border-radius: 18px;
          padding: 28px;
          margin-bottom: 42px;
        }

        .card-heading h2,
        .section-heading h2 {
          margin: 0;
          color: white;
          font-size: 22px;
        }

        .card-heading p,
        .section-heading p {
          margin: 6px 0 0;
          color: #64748b;
        }

        .team-form {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-top: 26px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        label {
          font-size: 13px;
          font-weight: 600;
          color: #cbd5e1;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #334155;
          border-radius: 10px;
          background: #0f172a;
          color: white;
          padding: 13px 14px;
          font-size: 14px;
          outline: none;
        }

        input:focus {
          border-color: #3b82f6;
        }

        .form-actions {
          grid-column: 1 / -1;
        }

        .primary-button {
          width: 100%;
          padding: 13px 18px;
          border: none;
          border-radius: 10px;
          background: #2563eb;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #1d4ed8;
        }

        .section-heading {
          margin-bottom: 18px;
        }

        .team-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(320px, 1fr)
          );
          gap: 20px;
        }

        .team-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border: 1px solid #263449;
          border-radius: 16px;
          background: #111c32;
          transition:
            transform 0.15s ease,
            border-color 0.15s ease;
        }

        .team-card:hover {
          transform: translateY(-2px);
          border-color: #3b82f6;
        }

        .team-logo {
          width: 64px;
          height: 64px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid #334155;
          background: #0f172a;
        }

        .team-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .team-logo span {
          font-size: 18px;
          font-weight: 800;
          color: #60a5fa;
        }

        .team-info {
          flex: 1;
          min-width: 0;
        }

        .team-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .team-code {
          padding: 4px 8px;
          border-radius: 6px;
          background: #172554;
          color: #93c5fd;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .team-id {
          color: #64748b;
          font-size: 11px;
        }

        .team-info h3 {
          margin: 8px 0 4px;
          color: white;
          font-size: 18px;
        }

        .team-info p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
        }

        .danger-button {
          flex-shrink: 0;
          padding: 8px 12px;
          border: 1px solid #7f1d1d;
          border-radius: 8px;
          background: transparent;
          color: #fca5a5;
          cursor: pointer;
        }

        .danger-button:hover {
          background: #450a0a;
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
          border: 1px dashed #334155;
          border-radius: 16px;
          color: #64748b;
        }

        .empty-icon {
          margin-bottom: 12px;
          font-size: 42px;
        }

        .empty-state h3 {
          margin: 0 0 8px;
          color: #cbd5e1;
        }

        .empty-state p {
          margin: 0;
        }

        .spinner {
          width: 28px;
          height: 28px;
          margin: 0 auto 14px;
          border: 3px solid #334155;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .admin-page {
            padding: 22px;
          }

          .admin-page-header {
            align-items: flex-start;
            gap: 20px;
          }

          .team-form {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .form-actions {
            grid-column: auto;
          }

          .team-card {
            align-items: flex-start;
          }

          .danger-button {
            align-self: center;
          }
        }
      `}</style>
    </main>
  );
}

