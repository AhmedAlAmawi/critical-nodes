import { NextRequest, NextResponse } from "next/server";
import { renderWithGemini } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images, prompt, aspectRatio, imageSize, model } = body;

    const apiKey =
      request.headers.get("x-gemini-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key required. Set it in Settings or add GEMINI_API_KEY to .env.local",
        },
        { status: 401 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    const result = await renderWithGemini(apiKey, {
      images,
      prompt,
      aspectRatio,
      imageSize,
      model,
    });

    return NextResponse.json({
      success: true,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      text: result.text,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Render failed";
    console.error("Render error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
