/**
 * Faculty route group — gated to role=faculty.
 *
 * Clerk's middleware authenticates; this layout enforces the role check
 * server-side so the user can't be a signed-in student who navigated to /faculty.
 */

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const u = await currentUser();
  const role = u?.publicMetadata?.role as "faculty" | "student" | undefined;
  if (!role) redirect("/select-role");
  if (role !== "faculty") redirect("/studio");
  return <>{children}</>;
}
