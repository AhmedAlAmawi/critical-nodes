"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Upload = {
  id: string;
  name: string;
  status: "uploading" | "ingesting" | "done" | "error";
  sourceId?: number;
  pages?: number;
  chunks?: number;
  error?: string;
};

export function SourceUploader({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [hover, setHover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  const updateUpload = useCallback(
    (id: string, patch: Partial<Upload>) => {
      setUploads((curr) =>
        curr.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      );
    },
    [],
  );

  function streamProgress(uploadId: string, sourceId: number) {
    const es = new EventSource(`/api/ingest/${sourceId}/stream`);
    es.addEventListener("progress", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as {
        status: string;
        pages: number | null;
        chunks: number;
      };
      updateUpload(uploadId, {
        status:
          d.status === "done"
            ? "done"
            : d.status === "error"
              ? "error"
              : "ingesting",
        pages: d.pages ?? undefined,
        chunks: d.chunks,
      });
    });
    es.addEventListener("done", () => {
      es.close();
      router.refresh();
    });
    es.addEventListener("error", () => {
      es.close();
    });
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const uploadId = crypto.randomUUID();
      setUploads((curr) => [
        ...curr,
        { id: uploadId, name: file.name, status: "uploading" },
      ]);
      try {
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        const isImage = file.type.startsWith("image/");
        const endpoint = isPdf
          ? "/api/ingest/pdf"
          : isImage
            ? "/api/ingest/image"
            : "/api/ingest/pdf"; // PPTX/EPUB stubs go through pdf route for now
        const form = new FormData();
        form.set("courseId", String(courseId));
        form.set("title", file.name);
        form.set("file", file);
        const res = await fetch(endpoint, { method: "POST", body: form });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          sourceId?: number;
          error?: string;
        };
        if (!res.ok || !j.sourceId) {
          updateUpload(uploadId, {
            status: "error",
            error: j.error ?? `HTTP ${res.status}`,
          });
          return;
        }
        updateUpload(uploadId, { status: "ingesting", sourceId: j.sourceId });
        if (isPdf) streamProgress(uploadId, j.sourceId);
        else updateUpload(uploadId, { status: "done" });
        router.refresh();
      } catch (e) {
        updateUpload(uploadId, {
          status: "error",
          error: (e as Error).message,
        });
      }
    },
    [courseId, router, updateUpload],
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((f) => uploadFile(f));
    },
    [uploadFile],
  );

  async function submitLink() {
    if (!linkUrl.trim()) return;
    setLinkSubmitting(true);
    try {
      const res = await fetch("/api/ingest/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          url: linkUrl,
          title: linkTitle || linkUrl,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        sourceId?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setLinkUrl("");
      setLinkTitle("");
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
          hover ? "border-stone-900 bg-stone-50" : "border-stone-300"
        }`}
      >
        <p className="text-base font-medium">
          Drop PDFs, slide decks, or images here
        </p>
        <p className="text-xs text-stone-500 mt-1">
          PDF / PPTX / EPUB up to 50 MB · image up to 12 MB · or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,.pptx,.epub,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer text-stone-700">
          …or paste a link
        </summary>
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
          <button
            type="button"
            disabled={!linkUrl.trim() || linkSubmitting}
            onClick={submitLink}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
          >
            {linkSubmitting ? "Ingesting…" : "Ingest link"}
          </button>
        </div>
      </details>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm"
            >
              <span className="truncate min-w-0">{u.name}</span>
              <span className="text-xs text-stone-500 ml-3 tabular-nums">
                {u.status === "uploading" && "Uploading…"}
                {u.status === "ingesting" &&
                  `Ingesting${u.pages ? ` · ${u.pages} pages` : ""}${u.chunks ? ` · ${u.chunks} chunks` : ""}`}
                {u.status === "done" && "Done"}
                {u.status === "error" && (
                  <span className="text-red-600">{u.error}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
