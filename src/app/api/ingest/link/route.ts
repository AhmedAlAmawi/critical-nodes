/**
 * POST /api/ingest/link
 *
 * Body: { courseId, url, title? }. Fetches the URL, strips HTML, chunks and
 * inserts rows (phase 1). The client then loops `/api/ingest/[id]/embed`
 * to vectorise them (phase 2), exactly like PDFs.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { ingestLink } from "@/lib/rag/ingest/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as {
    courseId?: number;
    url?: string;
    title?: string;
  };
  if (!body.courseId || !body.url) {
    return NextResponse.json(
      { error: "courseId and url required" },
      { status: 400 },
    );
  }
  try {
    const u = new URL(body.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Enter a full http(s) URL." }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id FROM courses WHERE id = ${body.courseId} AND owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = (await sql`
    INSERT INTO sources (course_id, kind, title, blob_url, uploaded_by, ingest_status)
    VALUES (${body.courseId}, 'link', ${body.title ?? body.url}, ${body.url}, ${user.id}, 'queued')
    RETURNING id
  `) as Array<{ id: number }>;
  const sourceId = Number(rows[0].id);

  try {
    const result = await ingestLink({ sourceId, url: body.url });
    return NextResponse.json({
      ok: true,
      sourceId,
      chunkCount: result.chunkCount,
      embedPending: result.chunkCount,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, sourceId, error: (err as Error).message },
      { status: 422 },
    );
  }
}
