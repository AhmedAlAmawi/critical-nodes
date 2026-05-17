/**
 * Student route group — gated to role=student.
 */

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

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
  return <>{children}</>;
}
