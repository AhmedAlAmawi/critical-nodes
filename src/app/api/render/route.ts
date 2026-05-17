import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { auth } from "@clerk/nextjs/server";
import { renderWithGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/render
 *
 * v2 contract preserved: returns { imageBase64, mimeType, text } so existing
 * components keep working.
 *
 * v3 extension: when `sessionId` is included in the body, also persist the
 * rendered image to Vercel Blob and insert a row into `renders` so the Final
 * Audit can pick it up. v2 callers without sessionId behave unchanged.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      images,
      prompt,
      aspectRatio,
      imageSize,
      model,
      sessionId,
    }: {
      images?: string[];
      prompt?: string;
      aspectRatio?: string;
      imageSize?: string;
      model?: string;
      sessionId?: number;
    } = body;

    const apiKey =
      request.headers.get("x-gemini-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key required. Set it in Settings or add GEMINI_API_KEY to .env.local",
        },
        { status: 401 },
      );
    }
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }
    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 },
      );
    }

    const result = await renderWithGemini(apiKey, {
      images,
      prompt,
      aspectRatio,
      imageSize,
      model,
    });

    // Optional v3 persistence path.
    let renderId: number | null = null;
    let blobUrl: string | null = null;
    if (sessionId && result.imageBase64) {
      try {
        const { userId } = await auth();
        if (!userId) throw new Error("unauthenticated");
        const sql = neon(process.env.DATABASE_URL!);
        const owns = (await sql`
          SELECT s.id FROM sessions s
          JOIN users u ON u.id = s.student_id
          WHERE s.id = ${sessionId} AND u.clerk_id = ${userId}
          LIMIT 1
        `) as Array<{ id: number }>;
        if (owns[0]) {
          const mime = result.mimeType || "image/png";
          const buf = Buffer.from(result.imageBase64, "base64");
          const blob = await put(
            `renders/${sessionId}/${Date.now()}.png`,
            buf,
            {
              access: "public",
              contentType: mime,
              addRandomSuffix: true,
            },
          );
          blobUrl = blob.url;
          const rows = (await sql`
            INSERT INTO renders (session_id, prompt, model, aspect, blob_url)
            VALUES (${sessionId}, ${prompt}, ${model ?? "gemini-3.1-flash-image-preview"},
                    ${aspectRatio ?? "1:1"}, ${blob.url})
            RETURNING id
          `) as Array<{ id: number }>;
          renderId = Number(rows[0].id);
        }
      } catch (err) {
        // Persistence is best-effort; never break the render itself.
        console.warn(`[render] persist failed: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      text: result.text,
      renderId,
      blobUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    console.error("Render error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
