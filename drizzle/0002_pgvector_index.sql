-- ivfflat index for cosine-distance ANN on Jina CLIP v2 embeddings.
-- `lists = 100` is a reasonable default for catalogs of 1k-1M chunks;
-- re-tune as the corpus grows. See pgvector docs:
-- https://github.com/pgvector/pgvector#indexing
CREATE INDEX IF NOT EXISTS idx_source_chunk_vec_ivf
  ON source_chunk_vec USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index for hybrid retrieval (short queries union with
-- vector top-K).
CREATE INDEX IF NOT EXISTS idx_source_chunks_text_fts
  ON source_chunks USING gin (to_tsvector('english', coalesce(content_text,'')));
