/**
 * POST /api/ingest/[id]/embed — phase 2 of ingestion, one bounded slice.
 *
 * Embeds up to EMBED_CHUNKS_PER_CALL un-vectored chunks of a source and
 * returns progress. The faculty UI loops on this until `remaining === 0`.
 * Idempotent and safe to call at any time (this is what "Resume" does).
 *
 * GET returns the same progress shape without doing any work.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { countChunks, embedMissingChunks } from "@/lib/rag/ingest/embed-missing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function authorize(
  ctx: { params: Promise<{ id: string }> },
): Promise<{ sourceId: number } | NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const { id } = await ctx.params;
  const sourceId = parseInt(id, 10);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT s.id FROM sources s
    JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${sourceId} AND c.owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return { sourceId };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const a = await authorize(ctx);
  if (a instanceof NextResponse) return a;
  const counts = await countChunks(a.sourceId);
  return NextResponse.json({
    ok: true,
    sourceId: a.sourceId,
    total: counts.total,
    embedded: counts.embedded,
    remaining: counts.total - counts.embedded,
  });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const a = await authorize(ctx);
  if (a instanceof NextResponse) return a;
  if (!process.env.JINA_API_KEY) {
    return NextResponse.json(
      { error: "Embedding provider not configured (JINA_API_KEY missing)." },
      { status: 503 },
    );
  }
  try {
    const progress = await embedMissingChunks(a.sourceId);
    return NextResponse.json({ ok: true, ...progress });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
