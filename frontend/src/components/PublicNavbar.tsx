
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Live Scoreboard", href: "/live" },
];

export default function PublicNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin pages have their own interface.
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname?.startsWith(`${href}/`)
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
        {/* Brand */}

        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl shadow-lg shadow-blue-950/30">
            ⚽
          </div>

          <div>
            <p className="text-sm font-extrabold tracking-tight text-white sm:text-base">
              Football Tournament
            </p>

            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
              Management System
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}

        <nav className="hidden items-center gap-2 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                isActive(item.href)
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="mx-2 h-6 w-px bg-slate-800" />

          <Link
            href="/admin"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-blue-500 hover:text-white"
          >
            Admin Panel →
          </Link>
        </nav>

        {/* Mobile Menu Button */}

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xl text-white md:hidden"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Navigation */}

      {menuOpen && (
        <nav className="border-t border-slate-800 bg-slate-950 px-5 py-4 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive(item.href)
                    ? "bg-blue-600/15 text-blue-400"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Admin Panel →
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
