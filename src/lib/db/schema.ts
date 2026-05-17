/**
 * Critical Nodes v3 — Postgres + pgvector schema.
 *
 * One source of truth for every table in §5 of critical-nodes-v3.md.
 * Run `npm run db:generate` after edits to emit SQL into drizzle/.
 *
 * pgvector note: drizzle does not yet have a first-class `vector(N)` type, so
 * `source_chunk_vec.embedding` is declared via a custom type. The ivfflat index
 * is created in drizzle/0001_pgvector_index.sql (raw SQL).
 */

import {
  bigserial,
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- pgvector custom type ---------------------------------------------------

export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1024})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    if (typeof value === "string") {
      return value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((n) => Number(n));
    }
    return value as unknown as number[];
  },
});

// --- Users + courses --------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clerkId: text("clerk_id").notNull().unique(),
    role: text("role").notNull(), // 'faculty' | 'student'
    displayName: text("display_name"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clerkIdx: index("idx_users_clerk").on(t.clerkId),
  }),
);

export const courses = pgTable("courses", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ownerId: bigint("owner_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  code: text("code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: bigint("student_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.courseId, t.studentId] }),
  }),
);

// --- Sources + chunks + vectors --------------------------------------------

export const sources = pgTable(
  "sources",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'pdf' | 'pptx' | 'epub' | 'image' | 'link'
    title: text("title").notNull(),
    blobUrl: text("blob_url").notNull(),
    mime: text("mime"),
    pageCount: integer("page_count"),
    ingestStatus: text("ingest_status").notNull().default("queued"),
    ingestError: text("ingest_error"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }),
    uploadedBy: bigint("uploaded_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    rawMeta: jsonb("raw_meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    courseIdx: index("idx_sources_course").on(t.courseId),
  }),
);

export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: bigint("source_id", { mode: "number" })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    parentChunkId: bigint("parent_chunk_id", { mode: "number" }),
    ordinal: integer("ordinal").notNull(),
    kind: text("kind").notNull(), // 'text' | 'image' | 'table'
    page: integer("page"),
    bbox: jsonb("bbox"),
    contentText: text("content_text"),
    imageBlobUrl: text("image_blob_url"),
    tokens: integer("tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sourceIdx: index("idx_source_chunks_source").on(t.sourceId),
  }),
);

export const sourceChunkVec = pgTable("source_chunk_vec", {
  chunkId: bigint("chunk_id", { mode: "number" })
    .primaryKey()
    .references(() => sourceChunks.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
});

// --- Assignments + sessions + state ----------------------------------------

export const assignments = pgTable("assignments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  courseId: bigint("course_id", { mode: "number" })
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  brief: text("brief"),
  // Postgres bigint[] / int[] arrays.
  scopeSourceIds: bigint("scope_source_ids", { mode: "number" })
    .array()
    .notNull()
    .default(sql`'{}'::bigint[]`),
  scopeChunkIds: bigint("scope_chunk_ids", { mode: "number" })
    .array()
    .notNull()
    .default(sql`'{}'::bigint[]`),
  requiredNodes: text("required_nodes")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  rubric: jsonb("rubric").notNull().default(sql`'{}'::jsonb`),
  dueAt: timestamp("due_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    studentId: bigint("student_id", { mode: "number" })
      .notNull()
      .references(() => users.id),
    courseId: bigint("course_id", { mode: "number" }).references(
      () => courses.id,
    ),
    assignmentId: bigint("assignment_id", { mode: "number" }).references(
      () => assignments.id,
    ),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    studentIdx: index("idx_sessions_student").on(t.studentId),
  }),
);

export const sessionNodeState = pgTable(
  "session_node_state",
  {
    sessionId: bigint("session_id", { mode: "number" })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    mentorFeedback: jsonb("mentor_feedback"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.nodeId] }),
  }),
);

// --- AI logs + renders + evals + audit -------------------------------------

export const mentorMessages = pgTable(
  "mentor_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: bigint("session_id", { mode: "number" })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    step: text("step"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").notNull().default(sql`'[]'::jsonb`),
    model: text("model"),
    promptTokens: integer("prompt_tokens"),
    outputTokens: integer("output_tokens"),
    ms: integer("ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sessionIdx: index("idx_mentor_session").on(t.sessionId, t.createdAt),
  }),
);

export const renders = pgTable("renders", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" })
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  aspect: text("aspect").notNull(),
  blobUrl: text("blob_url").notNull(),
  thumbBlobUrl: text("thumb_blob_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const evaluations = pgTable("evaluations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" })
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  assignmentId: bigint("assignment_id", { mode: "number" })
    .notNull()
    .references(() => assignments.id),
  rubricScores: jsonb("rubric_scores").notNull(),
  narrative: text("narrative").notNull(),
  citations: jsonb("citations").notNull().default(sql`'[]'::jsonb`),
  model: text("model").notNull(),
  facultyOverrides: jsonb("faculty_overrides"),
  facultyNotes: text("faculty_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorId: bigint("actor_id", { mode: "number" }).references(() => users.id),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Inferred TS types ------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type SourceChunk = typeof sourceChunks.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionNodeState = typeof sessionNodeState.$inferSelect;
export type MentorMessage = typeof mentorMessages.$inferSelect;
export type Render = typeof renders.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
