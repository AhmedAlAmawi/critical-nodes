/**
 * GET /api/ingest/[id]/stream
 *
 * Server-Sent Events stream of ingest progress for one source. Implementation
 * is poll-driven: every second, read the `sources` row and emit a status
 * event; emit `done` when ingest_status is done/error.
 *
 * This keeps the surface area trivial while still letting the faculty UI
 * render a live progress bar. A future iteration can switch to true push
 * via Postgres LISTEN/NOTIFY.
 */

import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as Response;
  }
  const { id } = await ctx.params;
  const sourceId = parseInt(id, 10);
  if (!Number.isFinite(sourceId)) {
    return new Response("bad id", { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  // Verify ownership.
  const owns = (await sql`
    SELECT s.id FROM sources s
    JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${sourceId} AND c.owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return new Response("not found", { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      const deadline = Date.now() + 5 * 60_000;
      let last = "";
      while (Date.now() < deadline) {
        const rows = (await sql`
          SELECT ingest_status AS status, ingest_error AS error,
                 page_count AS pages,
                 (SELECT COUNT(*) FROM source_chunks WHERE source_id = ${sourceId}) AS chunks
          FROM sources WHERE id = ${sourceId}
        `) as Array<{
          status: string;
          error: string | null;
          pages: number | null;
          chunks: number;
        }>;
        const row = rows[0];
        if (!row) {
          send("error", { error: "source gone" });
          break;
        }
        const snapshot = JSON.stringify(row);
        if (snapshot !== last) {
          send("progress", row);
          last = snapshot;
        }
        if (row.status === "done" || row.status === "error") {
          send("done", row);
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
