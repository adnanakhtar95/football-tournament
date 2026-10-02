
"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface AdminUser {
  authenticated: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  username: string;
}

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/admin/login";

  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      setChecking(true);
      setAuthorized(false);

      // The login page must remain accessible without authentication.
      if (isLoginPage) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me/`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No valid administrator session.");
        }

        const user: AdminUser = await response.json();

        if (!user.authenticated || !user.is_staff) {
          throw new Error("Administrator access required.");
        }

        if (active) {
          setAuthorized(true);
        }
      } catch {
        if (active) {
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

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking || !authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

          <p className="mt-5 text-sm text-slate-400">
            Verifying administrator access...
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
