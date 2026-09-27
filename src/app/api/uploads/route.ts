/**
 * POST /api/uploads
 *
 * Token broker for *client-side* Vercel Blob uploads from the student studio
 * (sketches, act images, mission diagrams). Using the client-upload flow
 * means the file bytes go straight from the browser to Blob storage, which
 * sidesteps the 4.5 MB request-body ceiling on Vercel Functions — phone
 * photos of sketches routinely exceed that once base64-encoded.
 *
 * The client sends `clientPayload = JSON.stringify({ sessionId, key })`.
 * We verify the session belongs to the signed-in student before minting a
 * token, then persist nothing here — the phase runner writes the resulting
 * URL into session_node_state via the normal PATCH path.
 */

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per image

export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage not configured (BLOB_READ_WRITE_TOKEN missing)." },
      { status: 503 },
    );
  }

  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let sessionId: number | null = null;
        try {
          const parsed = JSON.parse(clientPayload ?? "{}") as {
            sessionId?: number;
          };
          sessionId = parsed.sessionId ?? null;
        } catch {
          // fallthrough → rejected below
        }
        if (!sessionId || !Number.isFinite(sessionId)) {
          throw new Error("sessionId required in clientPayload");
        }
        const sql = neon(process.env.DATABASE_URL!);
        const owns = (await sql`
          SELECT id FROM sessions
          WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
        `) as Array<{ id: number }>;
        if (!owns[0]) throw new Error("session not found");

        // Namespace every student upload under its session.
        if (!pathname.startsWith(`sessions/${sessionId}/`)) {
          throw new Error("pathname must live under the session folder");
        }

        return {
          allowedContentTypes: ["image/*", "application/pdf"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ sessionId, userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the phase runner records the URL in session_node_state.
        // (This webhook cannot reach localhost during `next dev`, which is
        // fine — the client still receives the blob URL directly.)
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
