# Critical Nodes v3

The entire lifecycle of design for the student — grounded in your faculty's own material.

Critical Nodes v3 fuses:

- **Malzama** — the pedagogical micro-flow `Orient → Sketch → Think → Act → Reflect → Synthesis` (Concept + Zoning phases).
- **Critical Nodes v2** — the 7-node AI-render discipline (Intent → Visual Priority → References → Geometry → Material/Light → Prompt → Audit).
- **Spec Studio's retrieval kernel** — multimodal Jina CLIP v2 + pgvector ANN + Gemini 2.5 Flash re-rank with strict-JSON schema and always-on fallback.
- **Faculty Portal** — upload PDFs / slides / images, build assignments scoped to specific chunks, evaluate student work against that material.

Full design spec at [`critical-nodes-v3.md`](critical-nodes-v3.md) (1,200+ lines).
Source investigations: [`malzama-investigation.md`](malzama-investigation.md), [`spec-studio-investigation.md`](spec-studio-investigation.md).

## Tech stack

- **Next.js 16** App Router (`proxy.ts` middleware naming) + React 19 + Tailwind v4
- **Neon Postgres + pgvector** (`@neondatabase/serverless` + drizzle-orm)
- **Vercel Blob** for faculty uploads + per-page rasters + renders
- **Clerk** for auth + faculty/student roles
- **Gemini 2.5 Flash / Pro** via `@google/genai`; **Nano Banana 2 / Pro** for image gen
- **Jina CLIP v2** for embeddings (1024d, image + text shared space)

## Setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL, BLOB_READ_WRITE_TOKEN, CLERK_*, GEMINI_API_KEY, JINA_API_KEY
npm run db:migrate
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run db:generate` | Generate SQL migrations from Drizzle schema |
| `npm run db:migrate` | Apply all SQL migrations (pgvector ext + tables + indexes) |
| `npm run db:push` | Drizzle push (dev-only short-circuit) |
| `npm run db:studio` | Drizzle Studio |
| `npm run smoke:rag` | Offline RAG smoke test — 5 deterministic assertions per §14 |
| `npm run smoke:routes` | Manual route reachability check against `APP_URL` |

## Routes

| Surface | Path |
|---|---|
| Public | `/`, `/sign-in`, `/sign-up`, `/select-role` |
| Faculty | `/faculty`, `/faculty/courses/[id]/{sources,assignments,cohort,evaluations}` |
| Student | `/studio`, `/studio/[id]/{concept,zoning,visualize,audit}` |
| API | `/api/{rag,ingest,mentor,audit,evaluate,sessions,courses,evaluations,auth}` |

## Acceptance smokes (§14 of the v3 spec)

- **RAG smoke** — `npm run smoke:rag` against a Neon database. Five assertions on the retrieve/rerank/ground contract; no external AI API needed.
- **Routes smoke** — `npm run smoke:routes` against a running dev server. Confirms every public + auth-gated route is reachable.

## Implementation phases (one commit each)

1. Foundation (Clerk + Drizzle + Postgres schema + role-select)
2. RAG kernel (port spec-studio → pgvector)
3. Mixed-media ingestion (PDF + image + link; PPTX/EPUB stubbed)
4. Faculty portal MVP (course list, course detail, sources, assignments)
5. Student Stage B (sessions API, useSessionState hook, mentor route, visualize shell)
6. Student Stage A (malzama Concept + Zoning phase content + runner)
7. Final cross-stage Alignment Audit (Prompt #9)
8. Faculty evaluation + cohort + override UI (Prompt #11)
9. Acceptance smoke tests (smoke-rag + smoke-routes)

See `critical-nodes-v3.md` §18 for the implementation order rationale.
