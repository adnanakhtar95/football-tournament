
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface AdminUser {
  authenticated: boolean;
  id: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
}

const dashboardItems = [
  {
    title: "Events",
    description: "Create, edit and manage football tournaments.",
    href: "/admin/events",
    icon: "🏆",
  },
  {
    title: "Teams",
    description: "Manage participating football teams.",
    href: "/admin/teams",
    icon: "🛡️",
  },
  {
    title: "Event Teams",
    description: "Register teams for specific tournaments.",
    href: "/admin/event-teams",
    icon: "👥",
  },
  {
    title: "Rounds",
    description: "Organize tournament stages and match rounds.",
    href: "/admin/rounds",
    icon: "📋",
  },
  {
    title: "Matches",
    description: "Schedule matches and manage live match actions.",
    href: "/admin/matches",
    icon: "⚽",
  },
];

function getCookie(name: string): string {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return "";
}

export default function AdminPage() {
  const router = useRouter();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me/`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/admin/login");
          return;
        }

        const data: AdminUser = await response.json();

        if (!data.authenticated || !data.is_staff) {
          router.replace("/admin/login");
          return;
        }

        if (active) {
          setUser(data);
        }
      } catch (err) {
        console.error("Authentication check failed:", err);

        router.replace("/admin/login");
      } finally {
        if (active) {
          setCheckingAuth(false);
        }
      }
    }

    void checkAuthentication();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      // Ensure Django has issued a CSRF cookie.
      await fetch(`${API_BASE_URL}/auth/csrf/`, {
        method: "GET",
        credentials: "include",
      });

      const csrfToken = getCookie("csrftoken");

      const response = await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Logout failed (HTTP ${response.status}).`);
      }

      setUser(null);

      // Full navigation clears client-side dashboard state.
      window.location.replace("/admin/login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  if (checkingAuth || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

          <p className="mt-5 text-sm text-slate-400">
            Verifying administrator session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {/* Admin header */}

        <header className="mb-10 flex flex-col justify-between gap-6 border-b border-slate-800 pb-8 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
            >
              ← Back to Website
            </Link>

            <p className="mt-7 text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
              Tournament Management
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Admin Dashboard
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              Manage tournaments, participating teams, rounds and live matches.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">
                {user.username}
              </p>

              <p className="text-xs text-slate-500">
                {user.is_superuser ? "Super Administrator" : "Administrator"}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/15 font-bold uppercase text-blue-400">
              {user.username.charAt(0)}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:border-red-600 hover:bg-red-950/60 disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-900 bg-red-950/30 px-5 py-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {/* Welcome section */}

        <section className="mb-9 rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-950/60 to-slate-900 p-7 sm:p-9">
          <span className="inline-flex rounded-full border border-green-900 bg-green-950/40 px-3 py-1 text-xs font-semibold text-green-400">
            ● Authenticated Session
          </span>

          <h2 className="mt-5 text-2xl font-bold">
            Welcome back, {user.username}!
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Your tournament control center is ready. Select a management
            section below to organize events, register teams, schedule
            matches or control live scoring.
          </p>
        </section>

        {/* Dashboard cards */}

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Management Sections
            </h2>

            <span className="text-sm text-slate-500">
              {dashboardItems.length} modules
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-800/80"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-2xl transition group-hover:border-blue-500/40">
                  {item.icon}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">
                    {item.title}
                  </h3>

                  <span className="text-xl text-blue-400 transition group-hover:translate-x-1">
                    →
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          Football Tournament Management System · Administration
        </footer>
      </div>
    </main>
  );
}
