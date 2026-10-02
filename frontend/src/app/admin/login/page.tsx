"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const text = await response.text();

      let data: { detail?: string } = {};

      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }

      if (!response.ok) {
        throw new Error(
          data.detail || `Login failed (${response.status})`
        );
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07140f] text-white">
      <div className="flex min-h-screen items-center justify-center px-4 py-12">

        <div className="w-full max-w-[440px]">

          {/* Branding */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-3xl shadow-lg shadow-emerald-950/30">
              ⚽
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Tournament Control
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Football Tournament Management System
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-2xl border border-white/10 bg-[#102219] p-6 shadow-2xl sm:p-8">

            <div className="mb-7">
              <h2 className="text-xl font-semibold text-white">
                Admin Login
              </h2>

              <p className="mt-1.5 text-sm text-slate-400">
                Sign in to access your tournament dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Username
                </label>

                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-white/10 bg-[#091810] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 disabled:opacity-60"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="w-full rounded-lg border border-white/10 bg-[#091810] px-4 py-3 pr-16 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    className="absolute inset-y-0 right-4 text-xs font-medium text-slate-400 transition hover:text-emerald-400"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-[#07140f] transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#102219] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In →"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-7 text-center">
            <a
              href="/"
              className="text-sm text-slate-400 transition hover:text-emerald-400"
            >
              ← Back to Tournament
            </a>

            <p className="mt-5 text-xs text-slate-600">
              Authorized administrators only
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
