import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";

export interface RenderRequest {
  images: { data: string; mimeType: string }[];
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  model?: string;
}

export interface RenderResult {
  imageBase64: string;
  mimeType: string;
  text?: string;
}

export async function renderWithGemini(
  apiKey: string,
  request: RenderRequest
): Promise<RenderResult> {
  const ai = new GoogleGenAI({ apiKey });
  const model = request.model || DEFAULT_MODEL;

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  for (const img of request.images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    });
  }

  parts.push({ text: request.prompt });

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      imageConfig: {
        aspectRatio: (request.aspectRatio || "16:9") as
          | "1:1"
          | "3:4"
          | "4:3"
          | "9:16"
          | "16:9",
        imageSize: (request.imageSize || "2K") as "1K" | "2K" | "4K",
      },
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("No response from model");
  }

  const responseParts = candidates[0].content?.parts;
  if (!responseParts) {
    throw new Error("Empty response from model");
  }

  let resultImage: RenderResult | null = null;
  let resultText = "";

  for (const part of responseParts) {
    if ("inlineData" in part && part.inlineData?.data) {
      resultImage = {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
    if ("text" in part && part.text) {
      resultText += part.text;
    }
  }

  if (!resultImage) {
    throw new Error(
      resultText || "Model did not generate an image. Try refining your prompt."
    );
  }

  resultImage.text = resultText || undefined;
  return resultImage;
}
