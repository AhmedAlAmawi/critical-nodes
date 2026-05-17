/**
 * Student route group — gated to role=student.
 */

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { PortalHeader } from "@/components/portal-header";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const u = await currentUser();
  const role = u?.publicMetadata?.role as "faculty" | "student" | undefined;
  if (!role) redirect("/select-role");
  if (role !== "student") redirect("/faculty");
  // children may be full-bleed (the /studio/[id]/visualize canvas) or
  // padded by a page-level container; the PortalHeader handles its own
  // hide-on-canvas behavior, so we don't blindly pad here. Pages that need
  // breathing room from the fixed header should use their own `pt-` or
  // `min-h-screen px-* py-*` (most already do).
  return (
    <>
      <PortalHeader homeHref="/studio" label="Studio" />
      {children}
    </>
  );
}
