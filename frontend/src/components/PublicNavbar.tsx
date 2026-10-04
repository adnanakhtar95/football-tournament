"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  CircleDot,
  LayoutDashboard,
  Menu,
  Radio,
  Trophy,
  X,
} from "lucide-react";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Tournaments", href: "/events" },
  { label: "Fixtures", href: "/matches" },
  { label: "Live Scores", href: "/live" },
  { label: "Players", href: "/players" },
];

export default function PublicNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname?.startsWith("/admin")) return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";

    return (
      pathname === href ||
      pathname?.startsWith(`${href}/`)
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0B0F14]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between gap-6 px-5 md:px-8 xl:px-12">

        {/* Brand */}
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="group flex shrink-0 items-center gap-3"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#F5C66C]/30 bg-[#F5C66C]/10 text-[#F5C66C] transition group-hover:border-[#F5C66C]">
            <Trophy size={23} strokeWidth={1.7} />
          </div>

          <div className="flex flex-col">
            <span className="font-heading text-[19px] font-bold leading-tight tracking-[-0.055em] text-white">
              FOOTBALL<span className="text-[#F5C66C]">CUP.</span>
            </span>

            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-[#83909F]">
              Tournament Platform
            </span>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden h-full items-center gap-1 lg:flex">
          {navigation.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex h-full items-center px-4 text-[13px] font-semibold transition-colors ${
                  active
                    ? "text-[#F5C66C]"
                    : "text-[#9AA6B2] hover:text-white"
                }`}
              >
                {item.label}

                {active && (
                  <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-[#F5C66C]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-lg border border-[#F5C66C]/20 bg-[#F5C66C]/[0.06] px-3.5 py-2.5 text-xs font-bold text-[#F5C66C] transition hover:bg-[#F5C66C]/10"
          >
            <Radio size={15} />
            LIVE CENTRE
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-[#34404B] bg-[#1B232C] px-4 py-2.5 text-xs font-semibold text-[#DCE2E8] transition hover:border-[#F5C66C]/50 hover:text-white"
          >
            <LayoutDashboard size={15} />
            Admin Portal
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-navigation"
          onClick={() => setMenuOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#34404B] bg-[#19212A] text-white lg:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile navigation */}
      {menuOpen && (
        <nav
          id="public-mobile-navigation"
          className="border-t border-white/[0.07] bg-[#10161D] px-5 py-5 lg:hidden"
        >
          <div className="mx-auto flex max-w-[1440px] flex-col gap-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center justify-between rounded-lg px-4 py-3.5 text-sm font-semibold transition ${
                  isActive(item.href)
                    ? "bg-[#F5C66C]/10 text-[#F5C66C]"
                    : "text-[#AAB5BF] hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}

                {isActive(item.href) && (
                  <CircleDot size={14} />
                )}
              </Link>
            ))}

            <div className="my-3 border-t border-white/[0.07]" />

            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-lg border border-[#34404B] bg-[#1B232C] px-4 py-3.5 text-sm font-semibold text-white"
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard size={17} />
                Admin Portal
              </span>

              <ArrowUpRight size={16} />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}