
"use client";

import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "completed";
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
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to initialize CSRF protection.");
  }

  return getCookie("csrftoken");
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "draft",
  });

  async function loadEvents() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/admin/events/`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        setMessage("Unable to load events.");
        return;
      }

      const data = await response.json();

      setEvents(data.results ?? data);
    } catch {
      setMessage("Unable to connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function createEvent(event: FormEvent) {
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
        `${API_BASE_URL}/admin/events/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data.detail ||
          Object.values(data)
            .flat()
            .join(" ");

        setMessage(errorMessage || "Unable to create event.");
        return;
      }

      setForm({
        name: "",
        description: "",
        start_date: "",
        end_date: "",
        status: "draft",
      });

      setMessage("Event created successfully.");

      await loadEvents();
    } catch (error) {
      console.error("CREATE EVENT ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create event."
      );
    }
  }

  async function deleteEvent(id: number) {
    if (!window.confirm("Delete this event?")) {
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
        `${API_BASE_URL}/admin/events/${id}/`,
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
          // No JSON response body.
        }

        setMessage(
          data.detail ||
            "Unable to delete event."
        );

        return;
      }

      setMessage("Event deleted.");

      await loadEvents();
    } catch (error) {
      console.error("DELETE EVENT ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend."
      );
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">TOURNAMENT ADMIN</p>

          <h1>Events</h1>

          <p className="subtitle">
            Create and manage football tournament events.
          </p>
        </div>

        <div className="event-count">
          <span>{events.length}</span>
          <small>Events</small>
        </div>
      </div>

      {message && (
        <div className="admin-message">
          {message}
        </div>
      )}

      <section className="admin-card create-event-card">
        <div className="card-heading">
          <div>
            <h2>Create Event</h2>

            <p>
              Set up a new football tournament.
            </p>
          </div>
        </div>

        <form
          onSubmit={createEvent}
          className="event-form"
        >
          <div className="form-group full">
            <label>Event Name</label>

            <input
              type="text"
              placeholder="e.g. Islamabad Football Cup"
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

          <div className="form-group full">
            <label>Description</label>

            <textarea
              placeholder="Describe the tournament..."
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Start Date</label>

            <input
              type="datetime-local"
              value={form.start_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  start_date: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-group">
            <label>End Date</label>

            <input
              type="datetime-local"
              value={form.end_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  end_date: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Status</label>

            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value,
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">
                Completed
              </option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
            >
              + Create Event
            </button>
          </div>
        </form>
      </section>

      <section className="events-section">
        <div className="section-heading">
          <div>
            <h2>Existing Events</h2>
            <p>Your tournament events</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚽</div>

            <h3>No events yet</h3>

            <p>
              Create your first tournament using the
              form above.
            </p>
          </div>
        ) : (
          <div className="event-grid">
            {events.map((event) => (
              <article
                key={event.id}
                className="event-card"
              >
                <div className="event-card-top">
                  <span
                    className={`status-badge ${event.status}`}
                  >
                    {event.status}
                  </span>

                  <span className="event-id">
                    #{event.id}
                  </span>
                </div>

                <h3>{event.name}</h3>

                <p className="event-description">
                  {event.description ||
                    "No description provided."}
                </p>

                <div className="event-dates">
                  <div>
                    <span>START</span>

                    <strong>
                      {formatDate(event.start_date)}
                    </strong>
                  </div>

                  <div>
                    <span>END</span>

                    <strong>
                      {formatDate(event.end_date)}
                    </strong>
                  </div>
                </div>

                <div className="event-card-footer">
                  <button
                    className="danger-button"
                    onClick={() =>
                      deleteEvent(event.id)
                    }
                  >
                    Delete
                  </button>
                </div>
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

        .event-count {
          min-width: 100px;
          padding: 16px 22px;
          border: 1px solid #334155;
          border-radius: 14px;
          background: #111c32;
          text-align: center;
        }

        .event-count span {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: #60a5fa;
        }

        .event-count small {
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

        .event-form {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
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

        input,
        textarea,
        select {
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

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #3b82f6;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-actions {
          display: flex;
          align-items: end;
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

        .event-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(280px, 1fr)
          );
          gap: 20px;
        }

        .event-card {
          padding: 22px;
          border: 1px solid #263449;
          border-radius: 16px;
          background: #111c32;
          transition:
            transform 0.15s ease,
            border-color 0.15s ease;
        }

        .event-card:hover {
          transform: translateY(-2px);
          border-color: #3b82f6;
        }

        .event-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .status-badge {
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-badge.draft {
          background: #3f3f46;
          color: #d4d4d8;
        }

        .status-badge.active {
          background: #064e3b;
          color: #6ee7b7;
        }

        .status-badge.completed {
          background: #172554;
          color: #93c5fd;
        }

        .event-id {
          color: #64748b;
          font-size: 12px;
        }

        .event-card h3 {
          margin: 0 0 10px;
          font-size: 20px;
          color: white;
        }

        .event-description {
          min-height: 42px;
          margin: 0 0 22px;
          color: #94a3b8;
          line-height: 1.5;
          font-size: 14px;
        }

        .event-dates {
          display: grid;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid #263449;
          border-bottom: 1px solid #263449;
        }

        .event-dates span {
          display: block;
          margin-bottom: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
        }

        .event-dates strong {
          font-size: 13px;
          font-weight: 500;
          color: #cbd5e1;
        }

        .event-card-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
        }

        .danger-button {
          padding: 8px 14px;
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
          font-size: 42px;
          margin-bottom: 12px;
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

          .event-form {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}

