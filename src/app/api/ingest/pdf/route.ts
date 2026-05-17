/**
 * POST /api/ingest/pdf
 *
 * Multipart form: { courseId, title, file }. Uploads the file to Vercel Blob,
 * creates a `sources` row, kicks off PDF ingestion in the background
 * (still inside this request — Vercel Functions allow up to 300s with
 * Fluid Compute). Returns the source id immediately so the client can
 * subscribe to the SSE progress stream.
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { ingestPdf } from "@/lib/rag/ingest/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid form: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const courseIdRaw = form.get("courseId");
  const file = form.get("file");
  const title = (form.get("title") as string | null) ?? "Untitled PDF";

  if (typeof courseIdRaw !== "string") {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }
  const courseId = parseInt(courseIdRaw, 10);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ error: "bad courseId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `PDF too large (>${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Verify the course belongs to this faculty.
  const owns = (await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Upload to Blob first so we always have the original.
  const buf = Buffer.from(await file.arrayBuffer());
  const blob = await put(`sources/${courseId}/${Date.now()}-${file.name}`, buf, {
    access: "public",
    contentType: file.type || "application/pdf",
    addRandomSuffix: true,
  });

  const rows = (await sql`
    INSERT INTO sources (course_id, kind, title, blob_url, mime, uploaded_by, ingest_status)
    VALUES (${courseId}, 'pdf', ${title}, ${blob.url}, ${file.type}, ${user.id}, 'queued')
    RETURNING id
  `) as Array<{ id: number }>;
  const sourceId = Number(rows[0].id);

  // Fire-and-forget background ingestion. We do NOT await — the response
  // returns immediately; client polls SSE for status.
  (async () => {
    try {
      await ingestPdf({ sourceId, data: new Uint8Array(buf) });
    } catch (err) {
      console.error(`[ingest pdf ${sourceId}] failed:`, err);
    }
  })();

  return NextResponse.json({ ok: true, sourceId });
}
