/**
 * Single-image ingestion. The image bytes are already uploaded to Blob;
 * we embed them via Jina CLIP v2 and create one image chunk.
 */

import "server-only";
import { embedImageBuffer } from "../embed";
import { insertChunk } from "../db";
import { markError, setIngestStatus } from "./_common";

export async function ingestImage(args: {
  sourceId: number;
  imageUrl: string;
  bytes: Buffer;
  mime: string;
  caption?: string;
}): Promise<{ chunkCount: number }> {
  await setIngestStatus(args.sourceId, "running");
  try {
    const v = await embedImageBuffer(args.bytes, args.mime);
    await insertChunk({
      sourceId: args.sourceId,
      ordinal: 0,
      kind: "image",
      contentText: args.caption ?? null,
      imageBlobUrl: args.imageUrl,
      embedding: v,
    });
    await setIngestStatus(args.sourceId, "done");
    return { chunkCount: 1 };
  } catch (err) {
    await markError(args.sourceId, (err as Error).message);
    throw err;
  }
}
