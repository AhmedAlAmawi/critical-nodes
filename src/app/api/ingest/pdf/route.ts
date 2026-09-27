/**
 * POST /api/ingest/pdf
 *
 * Multipart form: { courseId, title, file }. Uploads the file to Vercel Blob,
 * creates a `sources` row, then runs phase 1 of ingestion *synchronously*
 * (text extraction + chunk insert — seconds, not minutes). Returns the source
 * id plus chunk/page counts; the client then drives phase 2 by calling
 * `/api/ingest/[id]/embed` until `remaining === 0`.
 *
 * Why not fire-and-forget the whole pipeline? Because on Vercel a function's
 * background work is not guaranteed to run once the response is sent, and
 * the previous implementation depended on exactly that. Uploads "succeeded"
 * and then silently never finished.
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { ingestPdf, looksLikePdf } from "@/lib/rag/ingest/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "File storage is not configured on the server (BLOB_READ_WRITE_TOKEN missing)." },
      { status: 503 },
    );
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
  const title = ((form.get("title") as string | null) ?? "").trim() || "Untitled PDF";

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

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt") || lower.endsWith(".key")) {
    return NextResponse.json(
      { error: "Slide decks aren't parsed directly yet — export the deck as PDF (File → Export → PDF) and upload that." },
      { status: 415 },
    );
  }
  if (lower.endsWith(".epub")) {
    return NextResponse.json(
      { error: "EPUB isn't supported yet — convert to PDF and upload that." },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikePdf(new Uint8Array(buf))) {
    return NextResponse.json(
      { error: "That file doesn't look like a PDF. Export it as PDF and upload again." },
      { status: 415 },
    );
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Verify the course belongs to this faculty BEFORE storing anything.
  const owns = (await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let blobUrl: string;
  try {
    const blob = await put(`sources/${courseId}/${Date.now()}-${file.name}`, buf, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    blobUrl = blob.url;
  } catch (err) {
    return NextResponse.json(
      { error: `File storage failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const rows = (await sql`
    INSERT INTO sources (course_id, kind, title, blob_url, mime, uploaded_by, ingest_status, raw_meta)
    VALUES (${courseId}, 'pdf', ${title}, ${blobUrl}, 'application/pdf', ${user.id}, 'queued',
            ${JSON.stringify({ originalName: file.name, bytes: file.size })}::jsonb)
    RETURNING id
  `) as Array<{ id: number }>;
  const sourceId = Number(rows[0].id);

  try {
    const result = await ingestPdf({ sourceId, data: new Uint8Array(buf) });
    return NextResponse.json({
      ok: true,
      sourceId,
      pageCount: result.pageCount,
      chunkCount: result.chunkCount,
      embedPending: result.chunkCount,
    });
  } catch (err) {
    // The sources row already carries ingest_status='error' + message.
    return NextResponse.json(
      { ok: false, sourceId, error: (err as Error).message },
      { status: 422 },
    );
  }
}
