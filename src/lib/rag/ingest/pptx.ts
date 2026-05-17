/**
 * PPTX ingestion stub.
 *
 * Per §8 of the spec, the production path converts PPTX → PDF via Gemini
 * Files API, then runs the PDF pipeline. For the MVP we accept PPTX uploads
 * but flag them as error with a clear message — once the Files API
 * conversion is wired, this file's only change is one helper call.
 */

import "server-only";
import { markError, setIngestStatus } from "./_common";

export async function ingestPptx(args: {
  sourceId: number;
}): Promise<never> {
  await setIngestStatus(args.sourceId, "running");
  const msg =
    "PPTX ingestion via Gemini Files API conversion ships in v3.0.1. Please re-upload as PDF for now.";
  await markError(args.sourceId, msg);
  throw new Error(msg);
}
