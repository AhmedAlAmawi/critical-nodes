/**
 * EPUB ingestion stub.
 *
 * Per §8 of the spec, EPUBs are parsed with epub2 and chunked by chapter.
 * Implementation deferred to v3.0.1 — the chunk graph is uniform with PDF/
 * link paths, so backfilling is a localized change.
 */

import "server-only";
import { markError, setIngestStatus } from "./_common";

export async function ingestEpub(args: {
  sourceId: number;
}): Promise<never> {
  await setIngestStatus(args.sourceId, "running");
  const msg =
    "EPUB ingestion ships in v3.0.1. Please paste chapter text as a link or convert to PDF.";
  await markError(args.sourceId, msg);
  throw new Error(msg);
}
