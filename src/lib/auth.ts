/**
 * Auth helpers — thin wrappers over Clerk + our `users` table.
 *
 * On first sign-in we lazily upsert a row into our local `users` table keyed
 * by the Clerk user id. Role lives in Clerk's `publicMetadata.role` so it can
 * be checked in middleware without a DB round-trip.
 */

import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export type Role = "faculty" | "student";

export type AppUser = {
  id: number; // local DB id
  clerkId: string;
  role: Role;
  displayName: string | null;
  email: string | null;
};

/**
 * Returns the current user from Clerk + our local users row. Lazily creates
 * the local row if it doesn't exist. Returns null when unauthenticated.
 */
export async function requireUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getDb();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);

  if (existing[0]) {
    return {
      id: existing[0].id,
      clerkId: existing[0].clerkId,
      role: existing[0].role as Role,
      displayName: existing[0].displayName,
      email: existing[0].email,
    };
  }

  const clerkUser = await currentUser();
  const role = (clerkUser?.publicMetadata?.role as Role | undefined) ?? null;
  if (!role) {
    // Role not selected yet — caller should redirect to /select-role.
    return {
      id: -1,
      clerkId: userId,
      role: "student",
      displayName: clerkUser?.firstName ?? null,
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? null,
    };
  }

  const [row] = await db
    .insert(schema.users)
    .values({
      clerkId: userId,
      role,
      displayName:
        clerkUser?.firstName ?? clerkUser?.username ?? "Anonymous",
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? null,
    })
    .returning();

  return {
    id: row.id,
    clerkId: row.clerkId,
    role: row.role as Role,
    displayName: row.displayName,
    email: row.email,
  };
}

/** 401 if no user, 403 if role mismatch. Returns the user otherwise. */
export async function requireRole(role: Role): Promise<AppUser> {
  const user = await requireUser();
  if (!user || user.id === -1) {
    throw new Response("Unauthorized", { status: 401 });
  }
  if (user.role !== role) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}
