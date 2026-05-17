-- Enable pgvector before any table that references vector(N) is created.
-- This file is applied first by scripts/db-migrate.ts (alphabetical order).
CREATE EXTENSION IF NOT EXISTS vector;
