/**
 * Offline smoke test for the v3 RAG kernel — port of
 * spec-studio/scripts/smoke-test.ts to Postgres + pgvector.
 *
 * Five assertions (per §14 of critical-nodes-v3.md):
 *   1. Exact-vector seeded match ranks #1 with similarity >= 0.99
 *   2. Jittered vector (eps=0.4) lands in top-3
 *   3. scope filter (sourceIds + chunkIds) holds with zero leakage
 *   4. rerank() with no GEMINI_API_KEY falls back to identity ordering
 *   5. ground() responses always include citations (empty on fallback)
 *
 * Runs against DATABASE_URL_UNPOOLED. Cleans up the rows it inserts. No
 * external API needed.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { rerank } from "../src/lib/rag/rerank";
import { ground } from "../src/lib/rag/ground";
import { searchByEmbedding } from "../src/lib/rag/db";
import { Type } from "@google/genai";
import { EMBEDDING_DIM } from "../src/lib/rag/embed";

const TEST_PREFIX = "smoke-rag-";

function vecLit(v: Float32Array): string {
  return `[${Array.from(v).join(",")}]`;
}

function seededRand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0xffffffff;
  };
}

function randUnitVec(seed: number): Float32Array {
  const rand = seededRand(seed);
  const v = new Float32Array(EMBEDDING_DIM);
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const x = rand() * 2 - 1;
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < EMBEDDING_DIM; i++) v[i] /= norm;
  return v;
}

function jitter(v: Float32Array, eps: number, seed: number): Float32Array {
  const noise = randUnitVec(seed);
  const out = new Float32Array(EMBEDDING_DIM);
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    out[i] = v[i] + eps * noise[i];
    norm += out[i] * out[i];
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < EMBEDDING_DIM; i++) out[i] /= norm;
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL_UNPOOLED required.");
    process.exit(2);
  }
  const sql = neon(url);

  // Insert a smoke faculty user, course, sources, chunks, vectors.
  const facultyEmail = `${TEST_PREFIX}${Date.now()}@example.test`;
  const userRows = (await sql`
    INSERT INTO users (clerk_id, role, display_name, email)
    VALUES (${`smoke-${Date.now()}`}, 'faculty', 'Smoke', ${facultyEmail})
    RETURNING id
  `) as Array<{ id: number }>;
  const facultyId = Number(userRows[0].id);

  const courseRows = (await sql`
    INSERT INTO courses (owner_id, title, slug)
    VALUES (${facultyId}, 'Smoke Course', ${`${TEST_PREFIX}course-${Date.now()}`})
    RETURNING id
  `) as Array<{ id: number }>;
  const courseId = Number(courseRows[0].id);

  // Two sources so we can test sourceIds scope.
  const sourceIds: number[] = [];
  for (let s = 0; s < 2; s++) {
    const sr = (await sql`
      INSERT INTO sources (course_id, kind, title, blob_url, uploaded_by, ingest_status)
      VALUES (${courseId}, 'pdf', ${`Smoke PDF ${s}`}, 'https://example.test/blob', ${facultyId}, 'done')
      RETURNING id
    `) as Array<{ id: number }>;
    sourceIds.push(Number(sr[0].id));
  }

  // 12 chunks, 6 per source, with deterministic seeded vectors.
  const fixtures: Array<{ id: number; sourceId: number; vec: Float32Array }> = [];
  for (let i = 0; i < 12; i++) {
    const sourceId = sourceIds[i % 2];
    const vec = randUnitVec(1000 + i);
    const cr = (await sql`
      INSERT INTO source_chunks (source_id, ordinal, kind, page, content_text, tokens)
      VALUES (${sourceId}, ${i}, 'text', ${(i % 6) + 1}, ${`smoke chunk ${i}`}, 200)
      RETURNING id
    `) as Array<{ id: number }>;
    const chunkId = Number(cr[0].id);
    await sql`
      INSERT INTO source_chunk_vec (chunk_id, embedding)
      VALUES (${chunkId}, ${vecLit(vec)}::vector)
    `;
    fixtures.push({ id: chunkId, sourceId, vec });
  }

  let pass = 0;
  let fail = 0;
  function expect(cond: boolean, label: string) {
    if (cond) {
      console.log(`  PASS ${label}`);
      pass++;
    } else {
      console.log(`  FAIL ${label}`);
      fail++;
    }
  }

  // 1. Exact match ranks #1
  const target = fixtures[5];
  const hits1 = await searchByEmbedding({
    query: target.vec,
    courseId,
    k: 5,
  });
  expect(hits1.length > 0, `[1] exact: hits non-empty`);
  expect(
    hits1[0]?.id === target.id,
    `[1] exact: target ranks #1 (got id=${hits1[0]?.id}, want=${target.id})`,
  );
  expect(
    (hits1[0]?.similarity ?? 0) >= 0.99,
    `[1] exact: similarity >= 0.99 (got ${hits1[0]?.similarity.toFixed(4)})`,
  );

  // 2. Jittered match in top-3
  const target2 = fixtures[2];
  const jittered = jitter(target2.vec, 0.4, 9001);
  const hits2 = await searchByEmbedding({
    query: jittered,
    courseId,
    k: 5,
  });
  const idx2 = hits2.findIndex((h) => h.id === target2.id);
  expect(
    idx2 >= 0 && idx2 <= 2,
    `[2] jittered: target in top-3 (got rank=${idx2 + 1})`,
  );

  // 3. Scope filter holds: sourceIds restricts; chunkIds restricts further
  const scopedSource = sourceIds[0];
  const allowedChunkIds = fixtures
    .filter((f) => f.sourceId === scopedSource)
    .map((f) => f.id);
  const hits3a = await searchByEmbedding({
    query: target.vec,
    courseId,
    sourceIds: [scopedSource],
    k: 12,
  });
  expect(
    hits3a.every((h) => h.sourceId === scopedSource),
    `[3a] sourceIds: zero leakage (got ${hits3a.length} hits, all in source ${scopedSource})`,
  );
  const hits3b = await searchByEmbedding({
    query: target.vec,
    courseId,
    chunkIds: allowedChunkIds.slice(0, 2),
    k: 12,
  });
  expect(
    hits3b.every((h) => allowedChunkIds.slice(0, 2).includes(h.id)),
    `[3b] chunkIds: zero leakage`,
  );

  // 4. rerank() fallback when no GEMINI_API_KEY
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const reranked = await rerank({ kind: "text", text: "smoke" }, hits1, 5);
  expect(
    reranked.length === Math.min(5, hits1.length),
    `[4] rerank: identity count preserved (got ${reranked.length})`,
  );
  expect(
    reranked[0]?.id === hits1[0]?.id,
    `[4] rerank: identity order preserved`,
  );
  expect(
    reranked.every((r) => r.reason === ""),
    `[4] rerank: fallback reasons empty`,
  );
  if (prevKey) process.env.GEMINI_API_KEY = prevKey;

  // 5. ground() always populates citations[] (empty on fallback)
  const prevKey2 = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const grounded = await ground({
    model: "gemini-2.5-flash",
    systemPrompt: "Smoke test.",
    userPrompt: "What is here?",
    chunks: hits1,
    responseSchema: {
      type: Type.OBJECT,
      properties: { answer: { type: Type.STRING } },
      required: ["answer"],
    },
    temperature: 0.2,
    fallback: { answer: "(template fallback)" } as { answer: string },
  });
  expect(
    Array.isArray(grounded.citations),
    `[5] ground: citations is an array`,
  );
  expect(
    grounded.fallback === true && grounded.citations.length === 0,
    `[5] ground: fallback yields empty citations`,
  );
  if (prevKey2) process.env.GEMINI_API_KEY = prevKey2;

  // Cleanup — cascade deletes drop sources/chunks/vecs.
  await sql`DELETE FROM courses WHERE id = ${courseId}`;
  await sql`DELETE FROM users WHERE id = ${facultyId}`;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
