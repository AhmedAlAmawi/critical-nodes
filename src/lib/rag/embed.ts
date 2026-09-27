/**
 * Jina CLIP v2 embeddings — port of spec-studio/lib/embed.ts.
 *
 * Docs: https://api.jina.ai/v1/embeddings (model: jina-clip-v2, 1024d,
 *       image + text in one space)
 *
 * Token-cost reality (carried over from spec-studio's notes): Jina charges
 * ~4,000 tokens per image regardless of pixel size. The free tier limits
 * 100k tokens/min = 25 images/min ceiling; we target ~22 imgs/min via
 * BATCH_SIZE 8 × 22s inter-batch delay. Override via env when on paid tier.
 */

import "server-only";

export const EMBEDDING_DIM = 1024;
const JINA_URL = "https://api.jina.ai/v1/embeddings";
const MODEL = "jina-clip-v2";

// Image inputs: ~4k tokens each → the 22s/8-image cadence from spec-studio.
const BATCH_SIZE = Number(process.env.JINA_BATCH_SIZE ?? 8);
const BATCH_DELAY_MS = Number(process.env.JINA_BATCH_DELAY_MS ?? 22_000);

// Text inputs: a ~500-token chunk costs ~500 tokens, i.e. ~8x cheaper than an
// image. Using the image cadence for text made a 60-page PDF take >20 minutes
// and blow through the function timeout — the #1 reason faculty uploads never
// finished. 16 chunks / 4s ≈ 120k tokens/min worst case, which the 429 retry
// below absorbs on the free tier and which is nowhere near paid-tier limits.
const TEXT_BATCH_SIZE = Number(process.env.JINA_TEXT_BATCH_SIZE ?? 16);
const TEXT_BATCH_DELAY_MS = Number(process.env.JINA_TEXT_BATCH_DELAY_MS ?? 4_000);

const RATE_LIMIT_COOLDOWN_MS = Number(
  process.env.JINA_RATE_LIMIT_COOLDOWN_MS ?? 20_000,
);
const MAX_ATTEMPTS = 4;

type JinaInput = { image: string } | { text: string };

type JinaResponse = {
  model: string;
  data: Array<{ index: number; embedding: number[] }>;
  usage?: { total_tokens: number };
};

function getKey(): string {
  const k = process.env.JINA_API_KEY;
  if (!k) {
    throw new Error(
      "JINA_API_KEY missing. Set it in .env.local. https://jina.ai/embeddings/",
    );
  }
  return k;
}

/**
 * Rewrite vendor / public CDN URLs to a small-thumbnail variant before
 * embedding. Lifted from spec-studio with one addition: PDF page rasters
 * stored on Vercel Blob already arrive at ~512px so no rewrite is needed.
 */
export function thumbnailUrl(url: string, width = 512): string {
  if (!url) return url;

  // Vercel Blob URLs — leave as-is; we already rasterized to 512px on upload.
  if (url.includes("public.blob.vercel-storage.com")) return url;

  // Shopify CDN
  if (
    url.includes("cdn.shopify.com") ||
    url.includes("cdn.shopifycdn.net") ||
    /\/cdn\/shop\//.test(url)
  ) {
    return url.replace(
      /(\.(?:jpe?g|png|webp|gif|avif))(\?|$)/i,
      `_${width}x$1$2`,
    );
  }

  // Cloudflare Images
  if (url.includes("/cdn-cgi/image/")) {
    return url.replace(/\bwidth=(?:[^,/]*)/, `width=${width}`);
  }

  // Magento native resize
  if (/\?[^?]*width=(?=&|$)/.test(url)) {
    return url.replace(/(\?|&)width=(?=&|$)/, `$1width=${width}`);
  }

  // Last resort: public image proxy
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=jpg&q=85`;
}

async function callJina(inputs: JinaInput[]): Promise<Float32Array[]> {
  const res = await fetch(JINA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIM,
      normalized: true,
      embedding_type: "float",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Jina ${res.status}: ${text.slice(0, 400)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const json = (await res.json()) as JinaResponse;
  const out = new Array<Float32Array>(inputs.length);
  for (const row of json.data) {
    out[row.index] = Float32Array.from(row.embedding);
  }
  return out;
}

async function embedBatched(
  inputs: JinaInput[],
  opts: { batchSize: number; delayMs: number } = {
    batchSize: BATCH_SIZE,
    delayMs: BATCH_DELAY_MS,
  },
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < inputs.length; i += opts.batchSize) {
    const slice = inputs.slice(i, i + opts.batchSize);
    const res = await retry(() => callJina(slice));
    out.push(...res);
    if (i + opts.batchSize < inputs.length) {
      await sleep(opts.delayMs);
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function retry<T>(
  fn: () => Promise<T>,
  attempts = MAX_ATTEMPTS,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error).message ?? "");
      const status = (err as Error & { status?: number }).status ?? 0;
      const isRateLimit =
        status === 429 ||
        msg.includes("429") ||
        msg.includes("RATE_TOKEN_LIMIT") ||
        msg.includes("rate limit");
      if (i === attempts - 1) break;
      const wait = isRateLimit
        ? RATE_LIMIT_COOLDOWN_MS + Math.random() * 5000
        : 500 * 2 ** i + Math.random() * 250;
      if (isRateLimit) {
        process.stdout.write?.(
          `\n  jina rate-limited; sleeping ${Math.round(wait / 1000)}s...`,
        );
      }
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** Embed a single image by URL (or data URL). */
export async function embedImageUrl(url: string): Promise<Float32Array> {
  const [v] = await callJina([{ image: thumbnailUrl(url) }]);
  return v;
}

/** Embed a raw image buffer (user upload). */
export async function embedImageBuffer(
  buf: Buffer,
  mime: string = "image/jpeg",
): Promise<Float32Array> {
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  const [v] = await callJina([{ image: dataUrl }]);
  return v;
}

/** Embed a single text string. */
export async function embedText(text: string): Promise<Float32Array> {
  const [v] = await callJina([{ text }]);
  return v;
}

/** Batched image embedding for ingestion. */
export async function embedImageUrlsBatch(
  urls: string[],
): Promise<Float32Array[]> {
  return embedBatched(urls.map((u) => ({ image: thumbnailUrl(u) })));
}

/** Batched text embedding for ingestion (text cadence, not image cadence). */
export async function embedTextsBatch(
  texts: string[],
): Promise<Float32Array[]> {
  return embedBatched(
    texts.map((t) => ({ text: t || " " })),
    { batchSize: TEXT_BATCH_SIZE, delayMs: TEXT_BATCH_DELAY_MS },
  );
}

/** How many text chunks one `/embed` call should take on (2 batches). */
export const EMBED_CHUNKS_PER_CALL = TEXT_BATCH_SIZE * 2;
