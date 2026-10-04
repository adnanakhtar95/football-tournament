// "use client";

// import {
//   ReactNode,
//   useEffect,
//   useState,
// } from "react";

// import {
//   usePathname,
//   useRouter,
// } from "next/navigation";

// const API_BASE_URL =
//   process.env.NEXT_PUBLIC_API_URL ||
//   "http://localhost:8000/api";

// interface AdminUser {
//   authenticated: boolean;
//   is_staff: boolean;
//   is_superuser: boolean;
//   username: string;
// }

// export default function AdminLayout({
//   children,
// }: {
//   children: ReactNode;
// }) {
//   const pathname = usePathname();
//   const router = useRouter();

//   const isLoginPage = pathname === "/admin/login";

//   const [authorized, setAuthorized] = useState(false);
//   const [checking, setChecking] = useState(true);

//   useEffect(() => {
//     let active = true;

//     async function verifySession() {
//       setChecking(true);
//       setAuthorized(false);

//       if (isLoginPage) {
//         setChecking(false);
//         return;
//       }

//       try {
//         const response = await fetch(
//           `${API_BASE_URL}/auth/me/`,
//           {
//             method: "GET",
//             credentials: "include",
//             cache: "no-store",
//           }
//         );

//         if (!response.ok) {
//           throw new Error(
//             "No valid administrator session."
//           );
//         }

//         const user: AdminUser =
//           await response.json();

//         if (
//           !user.authenticated ||
//           !user.is_staff
//         ) {
//           throw new Error(
//             "Administrator access required."
//           );
//         }

//         if (active) {
//           setAuthorized(true);
//         }
//       } catch {
//         if (active) {
//           router.replace("/admin/login");
//         }
//       } finally {
//         if (active) {
//           setChecking(false);
//         }
//       }
//     }

//     void verifySession();

//     return () => {
//       active = false;
//     };
//   }, [isLoginPage, pathname, router]);

//   // Login has its own independent layout.
//   if (isLoginPage) {
//     return (
//       <div className="admin-shell">
//         {children}
//       </div>
//     );
//   }

//   // Authentication loading state.
//   if (checking || !authorized) {
//     return (
//       <main className="admin-shell flex min-h-screen items-center justify-center">
//         <div className="flex flex-col items-center text-center">
//           <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
//             <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
//           </div>

//           <h2 className="fc-heading mt-6 text-lg text-white">
//             Football Cup Admin
//           </h2>

//           <p className="mt-2 text-sm text-muted">
//             Verifying administrator access...
//           </p>
//         </div>
//       </main>
//     );
//   }

//   // Authenticated administrator.
//   return (
//     <div className="admin-shell">
//       {children}
//     </div>
//   );
// }

"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Command,
  Globe2,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  UserRound,
  X,
} from "lucide-react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

/* =========================================
   TYPES
========================================= */

interface AdminUser {
  authenticated: boolean;
  id?: number;
  is_staff: boolean;
  is_superuser: boolean;
  username: string;
}

/* =========================================
   NAVIGATION
========================================= */

const navigation = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Tournaments",
    href: "/admin/events",
    icon: Trophy,
  },
  {
    label: "Teams",
    href: "/admin/teams",
    icon: Shield,
  },
  {
    label: "Players",
    href: "/admin/players",
    icon: UserRound,
  },
  {
    label: "Event Teams",
    href: "/admin/event-teams",
    icon: Users,
  },
  {
    label: "Rounds",
    href: "/admin/rounds",
    icon: Layers3,
  },
  {
    label: "Matches",
    href: "/admin/matches",
    icon: CalendarDays,
  },
];

/* =========================================
   HELPERS
========================================= */

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

/* =========================================
   ADMIN LAYOUT
========================================= */

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/admin/login";

  const [user, setUser] = useState<AdminUser | null>(null);

  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const [mobileOpen, setMobileOpen] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  /* =========================================
     AUTHENTICATION
  ========================================= */

  useEffect(() => {
    let active = true;

    async function verifySession() {
      setChecking(true);
      setAuthorized(false);

      if (isLoginPage) {
        setUser(null);
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/me/`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "No valid administrator session."
          );
        }

        const data: AdminUser = await response.json();

        if (
          !data.authenticated ||
          !data.is_staff
        ) {
          throw new Error(
            "Administrator access required."
          );
        }

        if (active) {
          setUser(data);
          setAuthorized(true);
        }
      } catch (error) {
        console.error(
          "Admin authentication failed:",
          error
        );

        if (active) {
          setUser(null);
          router.replace("/admin/login");
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [isLoginPage, pathname, router]);

  /* =========================================
     CLOSE MOBILE NAV ON ROUTE CHANGE
  ========================================= */

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /* =========================================
     LOGOUT
  ========================================= */

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await fetch(
        `${API_BASE_URL}/auth/csrf/`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const csrfToken = getCookie("csrftoken");

      const response = await fetch(
        `${API_BASE_URL}/auth/logout/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            ...(csrfToken
              ? { "X-CSRFToken": csrfToken }
              : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Logout failed (HTTP ${response.status}).`
        );
      }

      setAuthorized(false);
      setUser(null);

      window.location.replace("/admin/login");
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Unable to log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  /* =========================================
     LOGIN PAGE
  ========================================= */

  if (isLoginPage) {
    return (
      <div className="admin-shell min-h-screen bg-[#080F1C]">
        {children}
      </div>
    );
  }

  /* =========================================
     AUTHENTICATION LOADER
  ========================================= */

  if (checking || !authorized || !user) {
    return (
      <main className="admin-shell flex min-h-screen items-center justify-center bg-[#080F1C] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#448AFF]/30 bg-[#2563EB]/10">
            <Command
              size={28}
              className="animate-pulse text-[#78ADFF]"
            />
          </div>

          <div className="mx-auto mt-6 h-[2px] w-32 overflow-hidden rounded-full bg-[#243B5A]">
            <div className="h-full w-1/2 animate-pulse bg-[#448AFF]" />
          </div>

          <h2 className="font-heading mt-6 text-lg font-bold text-white">
            FOOTBALLCUP COMMAND
          </h2>

          <p className="mt-2 text-xs text-[#8299B6]">
            Verifying administrator access...
          </p>
        </div>
      </main>
    );
  }

  /* =========================================
     ACTIVE PAGE
  ========================================= */

  const currentPage =
    navigation.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/admin" &&
          pathname.startsWith(`${item.href}/`))
    )?.label || "Administration";

  /* =========================================
     RENDER
  ========================================= */

  return (
    <div className="admin-shell min-h-screen bg-[#080F1C] text-[#F4F7FC]">

      {/* =====================================
          MOBILE OVERLAY
      ===================================== */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* =====================================
          SHARED ADMIN SIDEBAR
      ===================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[#24354D] bg-[#0B1525] transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Logo */}

        <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-[#24354D] px-6">
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#448AFF]/40 bg-[#2563EB]/15">
              <Command
                size={23}
                strokeWidth={1.7}
                className="text-[#75ACFF]"
              />
            </div>

            <div>
              <p className="font-heading text-[15px] font-extrabold tracking-[-0.055em] text-white">
                FOOTBALLCUP
                <span className="text-[#448AFF]">
                  .
                </span>
              </p>

              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#8296B2]">
                Command Centre
              </p>
            </div>
          </Link>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
            className="text-[#91A5BE] lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar navigation */}

        <div className="flex-1 overflow-y-auto px-3 py-7">
          <p className="mb-4 px-4 text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#637893]">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex h-[46px] items-center gap-3 rounded-lg px-4 text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-[#2563EB] text-white shadow-[0_5px_25px_rgba(37,99,235,0.22)]"
                      : "text-[#91A5BE] hover:bg-[#17283D] hover:text-white"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    className={
                      active
                        ? "text-white"
                        : "text-[#7393BC] group-hover:text-white"
                    }
                  />

                  <span className="flex-1">
                    {item.label}
                  </span>

                  {active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : (
                    <ChevronRight
                      size={14}
                      className="opacity-0 transition group-hover:opacity-100"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Secondary links */}

          <div className="my-7 h-px bg-[#24354D]" />

          <p className="mb-4 px-4 text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#637893]">
            Public Access
          </p>

          <Link
            href="/"
            className="flex h-[46px] items-center gap-3 rounded-lg px-4 text-xs font-semibold text-[#91A5BE] transition hover:bg-[#17283D] hover:text-white"
          >
            <Globe2 size={17} />

            <span className="flex-1">
              Public Website
            </span>

            <ArrowUpRight size={14} />
          </Link>

          <Link
            href="/live"
            className="flex h-[46px] items-center gap-3 rounded-lg px-4 text-xs font-semibold text-[#91A5BE] transition hover:bg-[#17283D] hover:text-white"
          >
            <Radio size={17} />

            <span className="flex-1">
              Live Arena
            </span>

            <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Bottom section */}

        <div className="shrink-0 border-t border-[#24354D] p-4">
          <div className="mb-4 rounded-xl border border-[#2A405C] bg-[#132239] p-4">
            <div className="flex items-center gap-2 text-[#79ACFF]">
              <ShieldCheck size={15} />

              <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                Authorized Access
              </span>
            </div>

            <p className="mt-2 truncate text-[11px] text-[#92A6C0]">
              Signed in as{" "}
              <span className="font-bold text-white">
                {user.username}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-xs font-semibold text-[#E59DA5] transition hover:bg-[#E05D70]/10 disabled:opacity-50"
          >
            <LogOut size={16} />

            {loggingOut
              ? "Signing out..."
              : "Sign Out"}

            <ArrowUpRight
              size={14}
              className="ml-auto"
            />
          </button>
        </div>
      </aside>

      {/* =====================================
          MAIN WORKSPACE
      ===================================== */}

      <div className="min-h-screen lg:pl-[260px]">

        {/* SHARED TOP BAR */}

        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-[#24354D] bg-[#0B1525]/95 px-5 backdrop-blur-xl md:px-8 xl:px-10">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2B3F59] text-[#A8BDD8] lg:hidden"
            >
              <Menu size={19} />
            </button>

            {/* Breadcrumb */}

            <div className="flex items-center gap-2 text-xs">
              <span className="hidden text-[#657C99] sm:inline">
                Command Centre
              </span>

              <ChevronRight
                size={13}
                className="hidden text-[#536D8E] sm:block"
              />

              <span className="font-semibold text-[#E5EEFC]">
                {currentPage}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-[#2B405D] bg-[#122138] px-3 py-2 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#70A9FF]" />

              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9CB7DC]">
                Admin Session Active
              </span>
            </div>

            <div className="h-8 w-px bg-[#2B3E56]" />

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-white">
                  {user.username}
                </p>

                <p className="mt-0.5 text-[10px] text-[#7890AE]">
                  {user.is_superuser
                    ? "Super Administrator"
                    : "Administrator"}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#448AFF]/35 bg-[#2563EB]/20 text-xs font-extrabold uppercase text-[#85B6FF]">
                {user.username.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Logout errors */}

        {logoutError && (
          <div
            role="alert"
            className="mx-5 mt-5 rounded-lg border border-[#E05D70]/35 bg-[#E05D70]/10 px-5 py-4 text-sm text-[#FFB6C0] md:mx-8"
          >
            {logoutError}
          </div>
        )}

        {/* =====================================
            ADMIN PAGE CONTENT
        ===================================== */}

        <div className="min-h-[calc(100vh-72px)]">
          {children}
        </div>

        {/* SHARED FOOTER */}

        <footer className="flex flex-col justify-between gap-3 border-t border-[#24354D] bg-[#0B1525] px-5 py-5 text-[10px] text-[#68809F] sm:flex-row sm:items-center md:px-8 xl:px-10">
          <div className="flex items-center gap-2">
            <Command
              size={13}
              className="text-[#70A9FF]"
            />

            <span className="font-bold uppercase tracking-[0.12em]">
              FOOTBALLCUP / COMMAND
            </span>
          </div>

          <p>
            Tournament Management System · Administration
          </p>
        </footer>
      </div>
    </div>
  );
}
