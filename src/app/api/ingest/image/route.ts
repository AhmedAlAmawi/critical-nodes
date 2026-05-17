/**
 * POST /api/ingest/image
 *
 * Single-image upload: stores in Blob, creates a `sources` row of kind=image,
 * runs the single-shot image embed pipeline synchronously (it's fast).
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { ingestImage } from "@/lib/rag/ingest/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }

  const form = await req.formData();
  const courseId = parseInt((form.get("courseId") as string) ?? "", 10);
  const title = (form.get("title") as string | null) ?? "Untitled image";
  const caption = form.get("caption") as string | null;
  const file = form.get("file");
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ error: "bad courseId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const blob = await put(`sources/${courseId}/${Date.now()}-${file.name}`, buf, {
    access: "public",
    contentType: mime,
    addRandomSuffix: true,
  });

  const rows = (await sql`
    INSERT INTO sources (course_id, kind, title, blob_url, mime, uploaded_by, ingest_status)
    VALUES (${courseId}, 'image', ${title}, ${blob.url}, ${mime}, ${user.id}, 'queued')
    RETURNING id
  `) as Array<{ id: number }>;
  const sourceId = Number(rows[0].id);

  try {
    await ingestImage({
      sourceId,
      imageUrl: blob.url,
      bytes: buf,
      mime,
      caption: caption ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, sourceId, error: (err as Error).message },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, sourceId });
}
