/**
 * Student studio entry — session list placeholder. Filled in by Phase 5.
 */

export default function StudioHome() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-stone-500">
          Studio
        </p>
        <h1 className="text-3xl font-serif mt-1">Your sessions</h1>
        <p className="text-sm text-stone-600 mt-1">
          The full lifecycle: Concept → Zoning → Visualization → Audit.
          Session list ships in Phase 5.
        </p>
      </header>
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-500 text-sm">
        No sessions yet.
      </div>
    </main>
  );
}
