/**
 * GET /api/courses/[id]/sources/[sourceId] — source + its chunks for the viewer.
 * DELETE /api/courses/[id]/sources/[sourceId] — cascade-delete a source.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const { id, sourceId } = await ctx.params;
  const courseId = parseInt(id, 10);
  const srcId = parseInt(sourceId, 10);
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT s.id FROM sources s JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${srcId} AND c.id = ${courseId} AND c.owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const source = await sql`
    SELECT id, kind, title, blob_url, mime, page_count, ingest_status, ingest_error, created_at
    FROM sources WHERE id = ${srcId}
  `;
  const chunks = await sql`
    SELECT id, parent_chunk_id, ordinal, kind, page, bbox, content_text, image_blob_url, tokens
    FROM source_chunks WHERE source_id = ${srcId}
    ORDER BY ordinal
    LIMIT 500
  `;
  return NextResponse.json({ ok: true, source: source[0], chunks });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const { id, sourceId } = await ctx.params;
  const courseId = parseInt(id, 10);
  const srcId = parseInt(sourceId, 10);
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    DELETE FROM sources WHERE id = ${srcId} AND course_id = ${courseId}
      AND course_id IN (SELECT id FROM courses WHERE owner_id = ${user.id})
  `;
  return NextResponse.json({ ok: true });
}
