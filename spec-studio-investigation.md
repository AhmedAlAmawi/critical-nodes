---
name: Spec Studio investigation doc
overview: Produce a single thorough, technical investigation doc at `critical-nodes/spec-studio-investigation.md` that mirrors `malzama-investigation.md` in shape and depth — fully reverse-engineering the spec-studio retrieval + re-rank pipeline so it can be carried forward (especially as the kernel for PDF-context RAG in the next version of Critical Nodes).
todos:
  - id: write_doc
    content: Write critical-nodes/spec-studio-investigation.md (~12 sections, mermaid diagram, parallel structure to malzama-investigation.md)
    status: pending
isProject: false
---

## Goal

One new file: [`malzama-investigation.md`](malzama-investigation.md)'s sibling — [`critical-nodes/spec-studio-investigation.md`](critical-nodes/spec-studio-investigation.md). Single source of truth for "how the retrieval gold works", written with the same level of detail (exact endpoints, batch sizes, retry policies, prompts, schemas, fallbacks, dimensions, units).

No code changes anywhere; just a markdown artifact.

## Source files I'm reverse-engineering

Every claim in the doc will trace back to a specific file:

- Pipeline kernel: [`lib/embed.ts`](../../spec-studio/lib/embed.ts), [`lib/db.ts`](../../spec-studio/lib/db.ts), [`lib/rerank.ts`](../../spec-studio/lib/rerank.ts), [`lib/schema.sql`](../../spec-studio/lib/schema.sql), [`lib/types.ts`](../../spec-studio/lib/types.ts), [`lib/env.ts`](../../spec-studio/lib/env.ts)
- Edge surface: [`app/api/match/route.ts`](../../spec-studio/app/api/match/route.ts), [`app/page.tsx`](../../spec-studio/app/page.tsx), [`components/MatchExperience.tsx`](../../spec-studio/components/MatchExperience.tsx), [`components/Dropzone.tsx`](../../spec-studio/components/Dropzone.tsx), [`components/ResultCard.tsx`](../../spec-studio/components/ResultCard.tsx)
- Ingestion: [`scripts/ingest.ts`](../../spec-studio/scripts/ingest.ts), [`scripts/init-db.ts`](../../spec-studio/scripts/init-db.ts), [`scripts/probe-vendors.ts`](../../spec-studio/scripts/probe-vendors.ts), [`scripts/smoke-test.ts`](../../spec-studio/scripts/smoke-test.ts)
- Vendor adapters: [`scripts/vendors/_common.ts`](../../spec-studio/scripts/vendors/_common.ts), [`scripts/vendors/magento.ts`](../../spec-studio/scripts/vendors/magento.ts), [`scripts/vendors/shopify.ts`](../../spec-studio/scripts/vendors/shopify.ts), [`scripts/vendors/panhomestores.ts`](../../spec-studio/scripts/vendors/panhomestores.ts)

## Document outline (12 sections, mirrors malzama doc)

1. **What it is** — one-paragraph framing: "lens for Qatar furniture," 6 vendors live, sub-30s queries, localhost-only, weekend MVP that overshot its 3-vendor target.

2. **Tech stack (decoded from the build)** — Next.js 15.1 + React 19 + Tailwind v4, `better-sqlite3` + `sqlite-vec` (vec0 virtual table, 1024-dim FLOAT), `@google/genai` (Gemini 2.5 Flash), Jina CLIP v2 over plain `fetch`. Node runtime (forced via `export const runtime = "nodejs"`). No backend DB — single SQLite file at `data/catalog.db` with WAL journaling.

3. **Routes & top-level navigation**
   - `/` — RSC home: calls `initSchema()` + `getIngestionStats()`, renders header + `<MatchExperience/>`.
   - `POST /api/match` — multipart `image` + optional `maxPrice` → `MatchResponse`.
   - `GET /api/match` — health/stats probe.

4. **Data model — the schema gold**
   - SQL DDL from `schema.sql`: `products(id, vendor, vendor_sku, name, price_qar, currency_orig, url, image_url, category, dimensions, raw_json, ingested_at, UNIQUE(vendor, vendor_sku))` plus indexes on `price_qar` and `vendor`.
   - `product_vec` as `vec0(product_id INTEGER PRIMARY KEY, embedding FLOAT[1024])` — the magic table.
   - TypeScript type contracts (`NormalizedProduct`, `Product`, `MatchResult`, `MatchResponse`, `IngestionStats`) from `types.ts`, including the 7-member `Vendor` union and `VENDOR_LABELS` map.

5. **The full pipeline — every stage, every fallback** — split into Query Path and Ingestion Path. For each stage: input, transformation, parameters, failure mode, exact code references.

   - **Query Path** (`/api/match`):
     - `formData()` → 12MB cap, MIME default `image/jpeg`, `maxPrice` parse with `Number.isFinite > 0`.
     - `embedImageBuffer(buf, mime)` → base64 data URL → single-image Jina call.
     - `searchByEmbedding(qVec, {k:24, maxPrice})` → vec0 `MATCH` with `k = overscan(96)`, then post-filter by price/vendor, then slice to `k`. Similarity = `clamp01(1 - distance)`.
     - **Auto-relax on empty** — if `hits.length===0 && maxPrice!=null`, re-query without `maxPrice`, set `relaxedFilter=true`.
     - `rerank(buf, mime, hits, 8)` → Gemini 2.5 Flash multimodal call.
     - Response packs `timingMs.{embed, search, rerank, total}` for the UI badge.

   - **Ingestion Path** (`npm run ingest`):
     - For each `VendorAdapter` in `[...magentoAdapters, ...shopifyAdapters]`:
       1. `fetchCatalog({limit})` → `NormalizedProduct[]`
       2. Embed in batches of 8 via `embedImageUrlsBatch()`
       3. `upsertProduct(p, vec)` with `ON CONFLICT(vendor, vendor_sku) DO UPDATE`
       4. Print per-vendor `done: N products, M embedded` line
     - Modes: full / `--vendor=` / `--limit=` / `--skip-embed` / `--embed-missing` (recovery mode that scans for rows with no `product_vec` row and only embeds those).

6. **Information flow diagram** — single mermaid `flowchart TD` covering both Query and Ingestion paths, with the price-relax decision diamond and the rerank-fallback decision diamond explicit. Will use camelCase node IDs and avoid the unsafe mermaid patterns from the system rules.

7. **AI integration — exact details**
   - **Jina CLIP v2** (`embed.ts`)
     - Endpoint: `POST https://api.jina.ai/v1/embeddings`
     - Model: `jina-clip-v2`, `dimensions: 1024`, `normalized: true`, `embedding_type: "float"`
     - Token reality: **~4,000 tokens per image flat** (not per-pixel as docs imply) → 25 images/min ceiling on free 100k TPM tier → batch size 8, inter-batch delay 22s = ~22 imgs/min target.
     - Retry: 6 attempts, exponential backoff `500 * 2^i`, but rate-limit gets a **65s cooldown** so the bucket actually refills.
     - URL rewriting (`thumbnailUrl()`): documented as a priority list — Shopify CDN insert `_512x`, Cloudflare `cdn-cgi/image/...,width=` fill-in, Magento `?width=` fill-in, fallback to `wsrv.nl` proxy. The token-cost calculus that motivates it.

   - **Gemini 2.5 Flash multimodal re-rank** (`rerank.ts`)
     - Model: `gemini-2.5-flash`, `temperature: 0.2`, `responseMimeType: "application/json"`, strict `responseSchema` (`Type.OBJECT` with required `ranked` array of `{id, reason}`).
     - The full **PROMPT** verbatim — silhouette / color / material / era / scale ranking criteria, "ignore background, lighting, staging," **same-category-only** filtering, 12-word reason cap.
     - Candidate prep: each of up to 8 candidates → `imageUrlToBase64()` with browser UA spoof; (image unavailable) text fallback if hotlink fails.
     - **Fallback chain**: no `GEMINI_API_KEY` → identity ordering; API call throws → identity ordering; JSON parse fails → identity ordering; empty `ranked` → identity ordering. User always sees results.

8. **Vendor adapters — the parameterized scrape kernel**
   - The `VendorAdapter` contract from `_common.ts` (`vendor`, `label`, `fetchCatalog`).
   - Shared HTTP utilities: `fetchJson<T>`, `fetchText` — UA-spoofed Chrome 146, 3 attempts, exponential backoff; plus `dedupBySku()` and `logProgress()` helpers.
   - **Magento adapter** (`magento.ts`) — `query AllProducts($pageSize, $currentPage)` with `search: " "` trick, `pageSize=100`, walks `total_pages`, uses `media_gallery[0]` over `image.url` to avoid the placeholder problem (with `isPlaceholderUrl` heuristics for `/placeholder/` and `Group_NN.png`). Currently configures Pan Home (`qatar_en`) and Midas (`qtr_en`). 100ms inter-page delay.
   - **Shopify adapter** (`shopify.ts`) — `GET /products.json?limit=250&page=N`, stops when page returns <250 items, 150ms inter-page delay, `toQarMultiplier` for non-QAR storefronts (defaults 1). Currently configures Klekktic, Al Jameel, Diana Store, That's Living.
   - **panhomestores.ts** as a thin re-export — pattern to copy when adding new vendors.
   - Saturday probe table (`probe-vendors.ts` output) of which storefronts have public catalog endpoints.

9. **Smoke test — what it actually proves** — walk through the 4 assertions in `smoke-test.ts`:
   1. Exact-vector match ranks #1 with `similarity >= 0.99`.
   2. Jittered vector (eps=0.4) still lands in top-3.
   3. `maxPrice` filter holds with zero leakage.
   4. `rerank()` with no `GEMINI_API_KEY` falls back to identity ordering and exact count.

   Why this matters: the test reproduces every failure-mode interface the production code depends on, using deterministic seeded random vectors — so it survives offline and is a portable smoke test pattern.

10. **Costs (rough, from the README + my read)** — embedding ~$1 / 50k images (Jina CLIP v2); per query ~$0.00002 embedding + ~$0.001 Gemini Flash multimodal = ~1000 searches per $1.

11. **Persistence, security & failure modes**
    - Server-side keys only (`JINA_API_KEY`, `GEMINI_API_KEY`) loaded via a 30-line custom `loadDotenv()` — **no `NEXT_PUBLIC_` exposure** (a deliberate improvement over the malzama anti-pattern).
    - `force-dynamic` route, Node runtime, no edge.
    - SQLite WAL, single-file at `data/catalog.db` (~6 MB after the Saturday ingest).
    - No vendor image caching — vendor CDN URLs are hotlinked; URL rotation = silent 404s until next ingest.

12. **What's worth carrying forward (especially to PDF-context RAG in Critical Nodes)**
    Short, opinionated list — kept here because it's the explicit purpose of the doc:
    - **The 3-stage retrieve → filter → re-rank pattern** is the kernel. For PDF RAG the same shape works: embed chunks → ANN top-N → LLM re-rank with a strict-JSON schema. Treat that as the architecture, not the embedding model.
    - **Strict `responseSchema` on the re-ranker** is what makes the failure path safe; preserve it.
    - **Always-have-a-fallback** (identity ordering on rerank failure, auto-relax on empty filter) is the UX guarantee — port it: PDF RAG should fall back to plain vector results if the LLM step fails.
    - **Overscan-then-filter** at the SQL boundary (`k*4`) — directly reusable for any post-vector filter (page, doc, tag).
    - **Token-aware ingestion** (the `thumbnailUrl` family) — for PDFs becomes "chunk + page-image thumbnail" with the same batched, rate-limited posture.
    - **Adapter pattern** for sources — `VendorAdapter` becomes `SourceAdapter` (PDF, web page, book reference, image library).
    - **Schema** translates directly: `products`→`chunks`, `product_vec`→`chunk_vec`, with `source_id`, `page`, `bbox`, `raw_text` replacing vendor-specific columns.
    - **Offline smoke test pattern** — port the deterministic seeded-random fixture approach.

## Mermaid diagram sketch (will live in section 6)

```
flowchart TD
  subgraph queryPath [Query path]
    upload[User drops image + optional maxPrice] --> route["POST /api/match"]
    route --> embedQ[embedImageBuffer Jina CLIP v2]
    embedQ --> search["searchByEmbedding k=24 overscan=96"]
    search --> filterCheck{"hits empty AND maxPrice set?"}
    filterCheck -->|yes| relax["re-query no maxPrice; relaxedFilter=true"]
    filterCheck -->|no| keep[keep hits]
    relax --> rerank["rerank top 8 with Gemini 2.5 Flash"]
    keep --> rerank
    rerank --> rerankCheck{"API ok AND JSON valid?"}
    rerankCheck -->|yes| rankedOut[ranked + reasons]
    rerankCheck -->|no| identityOut[identity order, empty reasons]
    rankedOut --> respond[MatchResponse with timingMs]
    identityOut --> respond
  end
  subgraph ingest [Ingestion path]
    cli["npm run ingest"] --> pickAdapter[per-vendor VendorAdapter]
    pickAdapter --> fetchCat[fetchCatalog pages]
    fetchCat --> normalize["normalize + dedupBySku"]
    normalize --> embedBatch["embedImageUrlsBatch size 8 every 22s"]
    embedBatch --> upsert["upsertProduct ON CONFLICT update + replace vec"]
    upsert --> done["report stats"]
  end
```

## Out of scope (will say so explicitly in the doc)

- No Critical Nodes integration design — that's a follow-up artifact.
- No code changes to spec-studio.
- No new prompts or product decisions.