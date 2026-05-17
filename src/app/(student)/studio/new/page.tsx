/**
 * /studio/new — landing point for assignment-link starts. Creates a session
 * for the given assignmentId then redirects to /studio/[sessionId].
 */

"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewSessionRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      const assignmentId = params.get("assignmentId");
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignmentId ? Number(assignmentId) : null,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { sessionId?: number };
        if (j.sessionId) {
          router.replace(`/studio/${j.sessionId}`);
        } else {
          router.replace("/studio");
        }
      } catch {
        router.replace("/studio");
      }
    })();
  }, [params, router]);

  return (
    <main className="min-h-screen grid place-items-center text-sm text-stone-500">
      Starting…
    </main>
  );
}
