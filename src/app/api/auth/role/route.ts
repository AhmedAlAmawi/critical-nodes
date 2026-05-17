/**
 * POST /api/auth/role
 *
 * Once-per-user role assignment. Faculty must present a matching INSTRUCTOR_CODE.
 * Writes both Clerk publicMetadata.role (so middleware can read it) and our
 * local users.role column.
 */

import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  role: "faculty" | "student";
  instructorCode?: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.role !== "faculty" && body.role !== "student") {
    return NextResponse.json({ error: "Bad role" }, { status: 400 });
  }
  if (body.role === "faculty") {
    const required = process.env.INSTRUCTOR_CODE;
    if (!required) {
      return NextResponse.json(
        { error: "Faculty role disabled — set INSTRUCTOR_CODE on the server." },
        { status: 503 },
      );
    }
    if ((body.instructorCode ?? "").trim() !== required) {
      return NextResponse.json(
        { error: "Instructor code did not match." },
        { status: 403 },
      );
    }
  }

  const clerkUser = await currentUser();
  const existingRole = clerkUser?.publicMetadata?.role as
    | "faculty"
    | "student"
    | undefined;
  if (existingRole) {
    return NextResponse.json(
      { error: "Role already assigned.", role: existingRole },
      { status: 409 },
    );
  }

  // Persist on Clerk so middleware reads it without hitting our DB.
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: body.role },
  });

  // Upsert locally.
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.users)
      .set({ role: body.role })
      .where(eq(schema.users.id, existing[0].id));
  } else {
    await db.insert(schema.users).values({
      clerkId: userId,
      role: body.role,
      displayName:
        clerkUser?.firstName ?? clerkUser?.username ?? "Anonymous",
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? null,
    });
  }

  return NextResponse.json({ ok: true, role: body.role });
}
