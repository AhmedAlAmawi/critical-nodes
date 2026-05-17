/**
 * Faculty dashboard placeholder. Filled in by Phase 4.
 */

export default function FacultyHome() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-stone-500">
          Faculty
        </p>
        <h1 className="text-3xl font-serif mt-1">Your courses</h1>
        <p className="text-sm text-stone-600 mt-1">
          Faculty portal coming online in Phase 4 — courses, source library, and
          assignment composer.
        </p>
      </header>
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-500 text-sm">
        No courses yet. The faculty UI ships in the next milestone.
      </div>
    </main>
  );
}
