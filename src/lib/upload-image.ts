/**
 * uploadStudentImage — browser-side helper used by the phase runner.
 *
 * Tries a client-side Vercel Blob upload (via /api/uploads token broker) and
 * returns the public URL. If Blob is unavailable for any reason (no token,
 * network hiccup, oversize), falls back to an inline base64 data URL so the
 * student is never blocked — persistence still works, it's just heavier.
 */

"use client";

import { upload } from "@vercel/blob/client";

export type UploadResult = {
  url: string;
  /** true when we fell back to an inline data URL */
  inline: boolean;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "upload";
}

export async function uploadStudentImage(
  file: File,
  opts: { sessionId: number; key: string },
): Promise<UploadResult> {
  const pathname = `sessions/${opts.sessionId}/${opts.key}/${Date.now()}-${safeName(file.name)}`;
  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/uploads",
      clientPayload: JSON.stringify({ sessionId: opts.sessionId, key: opts.key }),
      contentType: file.type || undefined,
    });
    return { url: blob.url, inline: false };
  } catch (err) {
    console.warn(
      `[uploadStudentImage] blob upload failed, falling back to inline: ${(err as Error).message}`,
    );
    const dataUrl = await readAsDataUrl(file);
    return { url: dataUrl, inline: true };
  }
}
