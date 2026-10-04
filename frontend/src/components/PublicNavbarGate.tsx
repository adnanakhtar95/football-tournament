"use client";

import { usePathname } from "next/navigation";

import PublicNavbar from "./PublicNavbar";

export default function PublicNavbarGate() {
  const pathname = usePathname();

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (isAdminRoute) {
    return null;
  }

  return <PublicNavbar />;
}