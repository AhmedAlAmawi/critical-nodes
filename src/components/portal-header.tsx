/**
 * Thin header bar shared by (faculty) and (student) layouts.
 *
 * Sticky top with the app name on the left and Clerk's UserButton on the
 * right (handles avatar, "Manage account", and "Sign out" via its built-in
 * popover).
 *
 * Hidden on /studio/[id]/visualize where the v2 full-bleed canvas owns its
 * own top nav — we still render a floating UserButton at top-right so the
 * student can sign out from the canvas too.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

type Props = {
  homeHref: string;
  label: string;
};

export function PortalHeader({ homeHref, label }: Props) {
  const pathname = usePathname() ?? "";
  const isCanvas = /^\/studio\/[^/]+\/visualize\b/.test(pathname);

  if (isCanvas) {
    // Floating UserButton only — no full header to compete with v2 nav.
    return (
      <div className="fixed top-3 right-3 z-[60]">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { userButtonAvatarBox: "h-7 w-7" },
          }}
        />
      </div>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between h-12 px-4 sm:px-6 bg-white/85 backdrop-blur border-b border-stone-200/80">
      <Link
        href={homeHref}
        className="flex items-center gap-2 text-sm font-medium text-stone-800 hover:text-stone-900"
      >
        <span className="font-serif text-base">Critical Nodes</span>
        <span className="text-[10px] uppercase tracking-widest text-stone-500 hidden sm:inline">
          · {label}
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { userButtonAvatarBox: "h-7 w-7" },
          }}
        />
      </div>
    </header>
  );
}
