
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Trophy,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Radio,
} from "lucide-react";

/* =====================================================
   CONFIGURATION
===================================================== */

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =====================================================
   TYPES
===================================================== */

interface LoginResponse {
  detail?: string;
  error?: string;
  message?: string;
}

/* =====================================================
   LOGIN PAGE
===================================================== */

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* =====================================================
     LOGIN HANDLER
  ===================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    if (!username.trim() || !password) {
      setError(
        "Please enter your username and password."
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/login/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      const text = await response.text();

      let data: LoginResponse = {};

      if (text.trim()) {
        try {
          data = JSON.parse(text) as LoginResponse;
        } catch {
          data = {
            detail: response.ok
              ? ""
              : text.slice(0, 250),
          };
        }
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.error ||
            data.message ||
            `Login failed (HTTP ${response.status}).`
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

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080D14] font-sans text-[#F5F3EC] selection:bg-[#D8BD87] selection:text-[#10151D]">

      {/* ==========================================
          BACKGROUND TEXTURE
      ========================================== */}

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "radial-gradient(#ffffff 0.6px, transparent 0.6px)",
          backgroundSize: "6px 6px",
        }}
      />

      <div className="pointer-events-none absolute -right-48 -top-48 h-[500px] w-[500px] rounded-full bg-[#C9A86D]/[0.045] blur-[110px]" />

      <div className="pointer-events-none absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full bg-[#25415C]/20 blur-[110px]" />

      {/* ==========================================
          MAIN GRID
      ========================================== */}

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">

        {/* ========================================
            LEFT: CINEMATIC FOOTBALL SHOWCASE
        ======================================== */}

        <section className="relative isolate flex min-h-[285px] flex-col overflow-hidden border-b border-white/10 bg-[#111923] sm:min-h-[350px] lg:min-h-screen lg:border-b-0 lg:border-r">

          {/* Stadium image */}

          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=90')",
            }}
          />

          {/* Image treatment */}

          <div className="absolute inset-0 bg-[#07101A]/35" />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,17,.80)_0%,rgba(5,10,17,.18)_36%,rgba(5,10,17,.60)_65%,#080D14_100%)]" />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,17,.22),transparent_65%)]" />

          {/* Top navigation */}

          <div className="relative z-10 flex items-center justify-between gap-4 px-6 pt-6 sm:px-10 sm:pt-9 xl:px-14">

            <Link
              href="/"
              className="group inline-flex min-w-0 items-center gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#D7BB84]/50 bg-[#D7BB84]/10 text-[#E7CE9B] backdrop-blur-md">
                <Trophy size={21} strokeWidth={1.7} />
              </div>

              <div className="min-w-0">
                <span className="block text-[17px] font-black uppercase italic leading-none tracking-[-0.065em] text-white">
                  FOOTBALL
                  <span className="text-[#D8BA82]">
                    CUP.
                  </span>
                </span>

                <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.24em] text-white/60">
                  Tournament Platform
                </span>
              </div>
            </Link>

            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#E8D6B3] transition hover:text-white"
            >
              <span className="hidden sm:inline">
                Explore Portal
              </span>

              <ArrowUpRight size={16} />
            </Link>
          </div>

          {/* Decorative stadium lines */}

          <div className="pointer-events-none absolute bottom-[20%] right-[-65px] hidden h-[290px] w-[290px] rounded-full border border-white/10 lg:block" />

          <div className="pointer-events-none absolute bottom-[20%] right-[-22px] hidden h-[205px] w-[205px] rounded-full border border-white/[0.07] lg:block" />

          {/* Hero content */}

          <div className="relative z-10 mt-auto px-6 pb-8 pt-12 sm:px-10 sm:pb-12 lg:px-14 lg:pb-16">

            {/* Eyebrow */}

            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-9 bg-[#D9BD88]" />

              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[#E6CE9F]">
                Behind Every Great Match
              </span>
            </div>

            {/* Main editorial heading */}

            <h1 className="max-w-[650px] text-[clamp(38px,5.7vw,85px)] font-black uppercase italic leading-[0.89] tracking-[-0.075em] text-white">
              THE GAME
              <br />
              BEHIND
              <br />
              <span className="text-[#D9BD88]">
                THE GAME.
              </span>
            </h1>

            <p className="mt-6 hidden max-w-[440px] text-[13px] leading-7 text-[#D1D6D9] sm:block">
              Every fixture. Every goal. Every
              unforgettable moment. The command
              centre where competitions come to life.
            </p>

            {/* Decorative stats */}

            <div className="mt-9 hidden max-w-[490px] grid-cols-3 border-t border-white/20 pt-6 sm:grid">

              <div className="border-r border-white/15 pr-4">
                <p className="text-[21px] font-black italic tracking-tight text-white">
                  01
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#C5AF89]">
                  One Platform
                </p>
              </div>

              <div className="border-r border-white/15 px-5">
                <p className="text-[21px] font-black italic tracking-tight text-white">
                  90<span className="text-[#D9BD88]">+</span>
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#C5AF89]">
                  Minutes of Glory
                </p>
              </div>

              <div className="pl-5">
                <p className="text-[21px] font-black italic tracking-tight text-white">
                  ∞
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#C5AF89]">
                  Possibilities
                </p>
              </div>
            </div>
          </div>

          {/* Vertical decorative label */}

          <div className="absolute bottom-12 right-7 hidden text-[9px] font-black uppercase tracking-[0.35em] text-white/30 [writing-mode:vertical-rl] xl:block">
            BUILT FOR THE BEAUTIFUL GAME
          </div>
        </section>

        {/* ========================================
            RIGHT: LOGIN AREA
        ======================================== */}

        <section className="relative flex min-h-[calc(100vh-285px)] flex-col bg-[#0A111B] lg:min-h-screen">

          {/* Top bar */}

          <div className="flex items-center justify-between gap-3 px-6 pt-7 sm:px-10 sm:pt-9 xl:px-16">

            <div className="inline-flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#D6B77C]/40" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D6B77C]" />
              </span>

              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#A5B1C0]">
                Administration Access
              </span>
            </div>

            <span className="rounded-sm border border-[#D5B780]/25 bg-[#D5B780]/[0.055] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#D7BB88]">
              Secure Portal
            </span>
          </div>

          {/* Main login container */}

          <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:py-16 xl:px-16">

            <div className="w-full max-w-[440px]">

              {/* Section identification */}

              <div className="mb-9">

                <div className="mb-6 inline-flex h-13 w-13 items-center justify-center rounded-lg border border-[#D6BA86]/25 bg-[#D6BA86]/[0.065] p-3 text-[#D9BD88]">
                  <LockKeyhole size={23} strokeWidth={1.6} />
                </div>

                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#D9BD88]">
                  The Control Room
                </p>

                <h2 className="text-[clamp(32px,4vw,47px)] font-black uppercase leading-[1.03] tracking-[-0.065em] text-[#F8F7F2]">
                  WELCOME
                  <br />
                  <span className="text-[#D8BB84]">
                    BACK.
                  </span>
                </h2>

                <p className="mt-4 max-w-[340px] text-[12px] leading-6 text-[#91A0B3]">
                  Sign in with your administrator
                  credentials to manage the tournament.
                </p>
              </div>

              {/* ====================================
                  LOGIN FORM
              ==================================== */}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >

                {/* USERNAME */}

                <div>
                  <label
                    htmlFor="username"
                    className="mb-2.5 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#C8D0DA]"
                  >
                    Username

                    <span className="font-normal normal-case tracking-normal text-[#66768B]">
                      Required
                    </span>
                  </label>

                  <div className="group relative">

                    <UserRound
                      size={17}
                      strokeWidth={1.7}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#75869B] transition group-focus-within:text-[#D9BD88]"
                    />

                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);

                        if (error) setError("");
                      }}
                      placeholder="Enter your username"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      disabled={loading}
                      className="h-[56px] w-full rounded-md border border-[#2C394B] bg-[#101B2A] pl-12 pr-4 text-[13px] font-medium text-white outline-none transition-all placeholder:text-[#68788C] hover:border-[#43526A] focus:border-[#D1B37C] focus:bg-[#142132] focus:ring-[3px] focus:ring-[#D1B37C]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* PASSWORD */}

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2.5 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#C8D0DA]"
                  >
                    Password

                    <span className="font-normal normal-case tracking-normal text-[#66768B]">
                      Required
                    </span>
                  </label>

                  <div className="group relative">

                    <LockKeyhole
                      size={17}
                      strokeWidth={1.7}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#75869B] transition group-focus-within:text-[#D9BD88]"
                    />

                    <input
                      id="password"
                      name="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);

                        if (error) setError("");
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      disabled={loading}
                      className="h-[56px] w-full rounded-md border border-[#2C394B] bg-[#101B2A] pl-12 pr-14 text-[13px] font-medium text-white outline-none transition-all placeholder:text-[#68788C] hover:border-[#43526A] focus:border-[#D1B37C] focus:bg-[#142132] focus:ring-[3px] focus:ring-[#D1B37C]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    {/* Visibility toggle */}

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setShowPassword(
                          (previous) => !previous
                        )
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      aria-pressed={showPassword}
                      className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#8291A4] transition hover:bg-white/5 hover:text-[#D9BD88] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D9BD88] disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* ERROR */}

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-3 rounded-md border border-[#9D515B]/40 bg-[#5D2832]/20 px-4 py-3.5"
                  >
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0 text-[#F19BA6]"
                    />

                    <div>
                      <p className="text-[11px] font-bold text-[#FFB9C0]">
                        Unable to sign in
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-[#DCA6AF]">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative mt-2 flex h-[56px] w-full items-center justify-center overflow-hidden rounded-md bg-[#D9BD88] px-5 text-[#10151B] shadow-[0_8px_30px_rgba(217,189,136,0.10)] transition-all duration-300 hover:bg-[#EBD3A4] hover:shadow-[0_8px_35px_rgba(217,189,136,0.20)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9BD88] disabled:cursor-wait disabled:opacity-65"
                >
                  <span className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.15em]">
                    {loading ? (
                      <>
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                        />

                        Authenticating...
                      </>
                    ) : (
                      <>
                        Enter Command Centre

                        <ArrowRight
                          size={17}
                          className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* ====================================
                  SECURITY INFORMATION
              ==================================== */}

              <div className="mt-7 flex items-start gap-3 rounded-md border border-[#293747] bg-[#101A27]/65 px-4 py-4">

                <ShieldCheck
                  size={19}
                  strokeWidth={1.6}
                  className="mt-0.5 shrink-0 text-[#D4B783]"
                />

                <div>
                  <p className="text-[10px] font-bold text-[#D7DCE3]">
                    Restricted Administration Area
                  </p>

                  <p className="mt-1.5 text-[10px] leading-[1.7] text-[#8292A5]">
                    Access is reserved for authorized
                    tournament administrators. Your
                    session is managed through the
                    platform authentication system.
                  </p>
                </div>
              </div>

              {/* ====================================
                  BACK TO PUBLIC PORTAL
              ==================================== */}

              <div className="mt-9 border-t border-white/[0.09] pt-6">
                <Link
                  href="/"
                  className="group inline-flex items-center gap-2.5 text-[11px] font-bold text-[#A5B2C2] transition hover:text-[#D9BD88]"
                >
                  <ArrowLeft
                    size={15}
                    className="transition-transform group-hover:-translate-x-1"
                  />

                  Back to Tournament Portal
                </Link>
              </div>
            </div>
          </div>

          {/* ========================================
              BOTTOM FOOTER
          ======================================== */}

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.065] px-6 py-5 sm:px-10 xl:px-16">

            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#5F7085]">
              FOOTBALLCUP / ADMINISTRATION
            </span>

            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8292A5]">
              <CheckCircle2
                size={13}
                className="text-[#CDB17D]"
              />

              Authorized Access Only
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
