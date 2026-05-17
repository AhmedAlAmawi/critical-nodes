/**
 * Once-per-user role selection. Faculty must present an instructor code.
 *
 * Server-side guard: already-role'd users are redirected to their portal
 * (no re-assignment). Unauthenticated users get bounced to /sign-in.
 */

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { SelectRoleForm } from "@/components/select-role-form";

export const dynamic = "force-dynamic";

export default async function SelectRolePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const u = await currentUser();
  const role = u?.publicMetadata?.role as "faculty" | "student" | undefined;
  if (role) redirect(role === "faculty" ? "/faculty" : "/studio");
  return (
    <main className="min-h-screen grid place-items-center px-4 py-12">
      <SelectRoleForm />
    </main>
  );
}
