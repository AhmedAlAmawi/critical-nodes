"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runEmbedLoop } from "@/lib/embed-loop";

type Upload = {
  id: string;
  name: string;
  status: "uploading" | "extracting" | "embedding" | "done" | "error";
  sourceId?: number;
  pages?: number;
  chunks?: number;
  embedded?: number;
  error?: string;
};

const IMAGE_MAX = 12 * 1024 * 1024;
const PDF_MAX = 50 * 1024 * 1024;

export function SourceUploader({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [hover, setHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const updateUpload = useCallback((id: string, patch: Partial<Upload>) => {
    setUploads((curr) => curr.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const embed = useCallback(
    async (uploadId: string, sourceId: number) => {
      updateUpload(uploadId, { status: "embedding", sourceId });
      const result = await runEmbedLoop(sourceId, (p) => {
        updateUpload(uploadId, {
          status: "embedding",
          chunks: p.total || undefined,
          embedded: p.embedded,
          error: p.error,
        });
      });
      if (result.status === "done") {
        updateUpload(uploadId, { status: "done", embedded: result.total, chunks: result.total, error: undefined });
      } else {
        updateUpload(uploadId, { status: "error", error: result.error ?? "Embedding did not finish." });
      }
      router.refresh();
    },
    [router, updateUpload],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const uploadId = crypto.randomUUID();
      setUploads((curr) => [...curr, { id: uploadId, name: file.name, status: "uploading" }]);

      const lower = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
      const isImage = file.type.startsWith("image/");

      if (!isPdf && !isImage) {
        updateUpload(uploadId, {
          status: "error",
          error: /\.(pptx?|key)$/.test(lower)
            ? "Export the slide deck as PDF (File → Export → PDF) and upload that."
            : /\.epub$/.test(lower)
              ? "Convert the EPUB to PDF and upload that."
              : "Only PDF and image files are accepted right now.",
        });
        return;
      }
      if (isPdf && file.size > PDF_MAX) {
        updateUpload(uploadId, { status: "error", error: "PDF is over 50 MB." });
        return;
      }
      if (isImage && file.size > IMAGE_MAX) {
        updateUpload(uploadId, { status: "error", error: "Image is over 12 MB." });
        return;
      }

      try {
        const form = new FormData();
        form.set("courseId", String(courseId));
        form.set("title", file.name.replace(/\.[^.]+$/, ""));
        form.set("file", file);
        updateUpload(uploadId, { status: isPdf ? "extracting" : "uploading" });
        const res = await fetch(isPdf ? "/api/ingest/pdf" : "/api/ingest/image", {
          method: "POST",
          body: form,
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          sourceId?: number;
          pageCount?: number;
          chunkCount?: number;
          error?: string;
        };
        if (!res.ok || !j.ok || !j.sourceId) {
          updateUpload(uploadId, { status: "error", sourceId: j.sourceId, error: j.error ?? `HTTP ${res.status}` });
          router.refresh();
          return;
        }
        updateUpload(uploadId, { sourceId: j.sourceId, pages: j.pageCount, chunks: j.chunkCount });
        router.refresh();
        if (isPdf) await embed(uploadId, j.sourceId);
        else updateUpload(uploadId, { status: "done" });
      } catch (e) {
        updateUpload(uploadId, { status: "error", error: (e as Error).message });
      }
    },
    [courseId, router, updateUpload, embed],
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      // Sequential so we don't hammer the embedding provider with N parallel loops.
      (async () => {
        for (const f of Array.from(files)) await uploadFile(f);
      })();
    },
    [uploadFile],
  );

  async function submitLink() {
    if (!linkUrl.trim()) return;
    setLinkSubmitting(true);
    setLinkError(null);
    const uploadId = crypto.randomUUID();
    const name = linkTitle.trim() || linkUrl.trim();
    setUploads((curr) => [...curr, { id: uploadId, name, status: "extracting" }]);
    try {
      const res = await fetch("/api/ingest/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, url: linkUrl.trim(), title: linkTitle.trim() || undefined }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sourceId?: number;
        chunkCount?: number;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.sourceId) throw new Error(j.error ?? `HTTP ${res.status}`);
      setLinkUrl("");
      setLinkTitle("");
      updateUpload(uploadId, { sourceId: j.sourceId, chunks: j.chunkCount });
      router.refresh();
      await embed(uploadId, j.sourceId);
    } catch (e) {
      const msg = (e as Error).message;
      setLinkError(msg);
      updateUpload(uploadId, { status: "error", error: msg });
      router.refresh();
    } finally {
      setLinkSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed bg-white px-8 py-14 text-center cursor-pointer transition-colors ${
          hover ? "border-stone-900 bg-stone-50" : "border-stone-300 hover:border-stone-500"
        }`}
      >
        <p className="text-base font-medium">Drop PDFs or images here</p>
        <p className="text-xs text-stone-500 mt-1">
          PDF up to 50 MB · image up to 12 MB · or click to browse. Slide decks: export as PDF first.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer text-stone-700">…or paste a link</summary>
        <div className="mt-3 space-y-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Optional title"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!linkUrl.trim() || linkSubmitting}
              onClick={submitLink}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
            >
              {linkSubmitting ? "Ingesting…" : "Ingest link"}
            </button>
            {linkError && <span className="text-xs text-red-600">{linkError}</span>}
          </div>
        </div>
      </details>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li
              key={u.id}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate min-w-0">{u.name}</span>
                <span className="text-xs text-stone-500 ml-3 tabular-nums whitespace-nowrap">
                  {u.status === "uploading" && "Uploading…"}
                  {u.status === "extracting" && "Reading text…"}
                  {u.status === "embedding" &&
                    `Indexing${u.chunks ? ` ${u.embedded ?? 0} / ${u.chunks}` : "…"}${u.pages ? ` · ${u.pages} pages` : ""}`}
                  {u.status === "done" && (
                    <span className="text-green-700">
                      Ready{u.chunks ? ` · ${u.chunks} chunks` : ""}{u.pages ? ` · ${u.pages} pages` : ""}
                    </span>
                  )}
                  {u.status === "error" && <span className="text-red-600">{u.error}</span>}
                </span>
              </div>
              {u.status === "embedding" && u.chunks ? (
                <div className="mt-2 h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-stone-700 transition-all"
                    style={{ width: `${Math.min(100, ((u.embedded ?? 0) / u.chunks) * 100)}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
