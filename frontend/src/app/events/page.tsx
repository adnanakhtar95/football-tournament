"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "completed";
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON from ${response.url} (HTTP ${response.status}).`
    );
  }
}

export default function EventsPage() {
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/events/`);

        if (!response.ok) {
          throw new Error("Unable to load events.");
        }

        const data = await readJson(response);

        setEvents(data.results || data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load events."
        );
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function statusLabel(status: Event["status"]) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
        <h1>Football Events</h1>
        <p>Loading events...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          marginBottom: 35,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Football Events</h1>

          <p style={{ margin: 0, color: "#666" }}>
            Explore tournaments, fixtures, standings and live matches.
          </p>
        </div>

        <button
          onClick={() => router.push("/")}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          ← Home
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 14,
            marginBottom: 25,
            border: "1px solid #dc2626",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 35,
            textAlign: "center",
          }}
        >
          <h2>No events available</h2>
          <p style={{ color: "#666" }}>
            There are currently no football tournaments to display.
          </p>
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {events.map((event) => (
            <article
              key={event.id}
              onClick={() => router.push(`/events/${event.id}`)}
              style={{
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 24,
                cursor: "pointer",
                background: "#fff",
                boxShadow: "0 3px 12px rgba(0,0,0,0.06)",
                transition: "transform 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 15,
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                  }}
                >
                  {event.name}
                </h2>

                <span
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background:
                      event.status === "active"
                        ? "#dcfce7"
                        : event.status === "completed"
                        ? "#e5e7eb"
                        : "#fef3c7",
                    color:
                      event.status === "active"
                        ? "#166534"
                        : event.status === "completed"
                        ? "#374151"
                        : "#92400e",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {statusLabel(event.status)}
                </span>
              </div>

              <p
                style={{
                  color: "#555",
                  lineHeight: 1.6,
                  minHeight: 50,
                }}
              >
                {event.description || "No description available."}
              </p>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid #eee",
                  color: "#666",
                  fontSize: 14,
                }}
              >
                <div>
                  <strong>Start:</strong>{" "}
                  {formatDate(event.start_date)}
                </div>

                <div style={{ marginTop: 6 }}>
                  <strong>End:</strong>{" "}
                  {formatDate(event.end_date)}
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  fontWeight: 600,
                }}
              >
                View tournament →
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}