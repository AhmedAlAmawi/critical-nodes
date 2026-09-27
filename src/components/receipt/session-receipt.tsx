/**
 * SessionReceipt — print-friendly rendering of a SessionReceipt record.
 * Server-compatible (no hooks). Shared by the student receipt page and the
 * faculty session view.
 */

import type { GenericNodeReceipt, PhaseReceipt, SessionReceipt as Receipt } from "@/lib/receipt";

function fmt(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionReceipt({ receipt, audience }: { receipt: Receipt; audience: "student" | "faculty" }) {
  const { session, student, phases, nodes, renders, evaluations, totals } = receipt;
  const submitted = session.status !== "active";
  return (
    <article className="space-y-10 text-stone-900">
      {/* Header */}
      <header className="border border-stone-200 rounded-2xl p-6 bg-white space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-stone-400 uppercase">Session receipt</p>
            <h1 className="text-2xl font-light mt-1">
              {session.assignmentTitle ?? session.courseTitle ?? "Freeform session"}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {student.displayName ?? `Student #${student.id}`}
              {student.email ? ` · ${student.email}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs whitespace-nowrap ${
              submitted ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {submitted ? `Submitted ${fmt(session.endedAt)}` : "In progress"}
          </span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <Meta k="Session" v={`#${session.id}`} />
          <Meta k="Started" v={fmt(session.startedAt)} />
          <Meta k="Course" v={session.courseTitle ?? "—"} />
          <Meta k="Progress" v={`${totals.nodesCompleted} / ${totals.nodesTotal} nodes`} />
          <Meta k="Responses recorded" v={String(totals.answers)} />
          <Meta k="Images" v={String(totals.images)} />
          <Meta k="Mentor notes" v={String(receipt.mentorMessages.length)} />
          <Meta k="Generated" v={fmt(receipt.generatedAt)} />
        </dl>
      </header>

      {/* Stage A */}
      <section className="space-y-6">
        <SectionTitle>Stage A — Pedagogy</SectionTitle>
        {phases.map((p) => (
          <PhaseBlock key={p.id} p={p} />
        ))}
      </section>

      {/* Stage B */}
      <section className="space-y-6">
        <SectionTitle>Stage B — Visualization</SectionTitle>
        {nodes.length === 0 ? (
          <Empty>No visualization work recorded yet.</Empty>
        ) : (
          nodes.map((n) => <NodeBlock key={n.id} n={n} />)
        )}
      </section>

      {renders.length > 0 && (
        <section className="space-y-4">
          <SectionTitle>Renders ({renders.length})</SectionTitle>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {renders.map((r) => (
              <li key={r.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={r.prompt} className="w-full aspect-square object-cover bg-stone-100" />
                <p className="px-3 py-2 text-[11px] text-stone-600 line-clamp-3">{r.prompt}</p>
                <p className="px-3 pb-2 text-[10px] text-stone-400">{fmt(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {audience === "faculty" && evaluations.length > 0 && (
        <section className="space-y-4">
          <SectionTitle>Evaluations ({evaluations.length})</SectionTitle>
          {evaluations.map((e) => (
            <div key={e.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-400 mb-1">Evaluation #{e.id} · {fmt(e.createdAt)}</p>
              <p className="text-sm text-stone-700 leading-relaxed">{e.narrative}</p>
            </div>
          ))}
        </section>
      )}

      <footer className="text-[10px] text-stone-400 pt-6 border-t border-stone-100">
        Critical Nodes · session #{session.id} · receipt generated {fmt(receipt.generatedAt)}
      </footer>
    </article>
  );
}

function PhaseBlock({ p }: { p: PhaseReceipt }) {
  const started = p.thinking.length > 0 || p.sketch || p.actText || p.missions.length > 0 || p.step !== "orient";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-6 break-inside-avoid">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-light">{p.title}</h2>
        <StatusPill done={!!p.completedAt} started={!!started} label={p.completedAt ? `Completed ${fmt(p.completedAt)}` : started ? `At: ${p.step}` : "Not started"} />
      </div>

      {!started ? (
        <Empty>No responses recorded for this phase.</Empty>
      ) : (
        <>
          {p.conceptStatement && (
            <Block label="Concept statement">
              <p className="text-base font-light leading-relaxed">“{p.conceptStatement}”</p>
            </Block>
          )}

          {p.sketch && (
            <Block label="Initial sketch">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.sketch.url} alt="Initial sketch" className="w-40 h-40 object-contain rounded-lg border border-stone-200 bg-stone-50" />
                {p.sketch.note && <p className="text-sm text-stone-600">{p.sketch.note}</p>}
              </div>
            </Block>
          )}

          {(p.thinking.length > 0 || p.driver || p.compare) && (
            <Block label="Think">
              <QAList items={[...p.thinking, ...(p.driver ? [p.driver] : []), ...(p.compare ? [p.compare] : [])]} />
            </Block>
          )}

          {(p.actText || p.actImageUrl || p.missions.length > 0) && (
            <Block label="Act">
              {p.actText && <p className="text-sm text-stone-700 whitespace-pre-line leading-relaxed">{p.actText}</p>}
              {p.actImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.actImageUrl} alt="Output" className="mt-3 max-h-64 object-contain rounded-lg border border-stone-200 bg-stone-50" />
              )}
              {p.missions.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 mt-2">
                  {p.missions.map((m) => (
                    <li key={m.title} className="space-y-1.5">
                      <p className="text-xs text-stone-500">
                        {m.title}
                        {m.required ? "" : " (optional)"}
                      </p>
                      {m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.imageUrl} alt={m.title} className="w-full aspect-square object-contain rounded-lg border border-stone-200 bg-stone-50" />
                      ) : (
                        <div className="w-full aspect-square rounded-lg border border-dashed border-stone-200 grid place-items-center text-[10px] text-stone-400">
                          no image
                        </div>
                      )}
                      {m.note && <p className="text-xs text-stone-600">{m.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          {p.reflection.length > 0 && (
            <Block label="Reflect">
              <QAList items={p.reflection} />
            </Block>
          )}

          {p.mentorFeedback && (
            <Block label={`Mentor feedback${p.mentorCitations ? ` · ${p.mentorCitations} citation${p.mentorCitations === 1 ? "" : "s"}` : ""}`}>
              <p className="text-sm italic text-stone-700 leading-relaxed">“{p.mentorFeedback}”</p>
            </Block>
          )}
        </>
      )}
    </div>
  );
}

function NodeBlock({ n }: { n: GenericNodeReceipt }) {
  const started = n.fields.length > 0 || n.images.length > 0;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4 break-inside-avoid">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-light">{n.label}</h2>
        <StatusPill done={!!n.completedAt} started={started} label={n.completedAt ? `Completed ${fmt(n.completedAt)}` : started ? "In progress" : "Not started"} />
      </div>
      {!started ? (
        <Empty>No responses recorded.</Empty>
      ) : (
        <>
          {n.fields.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {n.fields.map((f, i) => (
                <div key={i} className="min-w-0">
                  <dt className="text-[11px] text-stone-400 leading-snug">{f.label}</dt>
                  <dd className="text-sm text-stone-700 leading-relaxed whitespace-pre-line break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {n.images.length > 0 && (
            <ul className="grid grid-cols-3 gap-3">
              {n.images.map((im, i) => (
                <li key={i} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt={im.label} className="w-full aspect-square object-contain rounded-lg border border-stone-200 bg-stone-50" />
                  <p className="text-[10px] text-stone-400 truncate">{im.label}</p>
                </li>
              ))}
            </ul>
          )}
          {n.mentorFeedback && (
            <Block label="Mentor feedback">
              <p className="text-sm italic text-stone-700 leading-relaxed">“{n.mentorFeedback}”</p>
            </Block>
          )}
        </>
      )}
    </div>
  );
}

function QAList({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <dl className="space-y-3">
      {items.map((qa, i) => (
        <div key={i}>
          <dt className="text-xs text-stone-400 leading-snug">{qa.question}</dt>
          <dd className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{qa.answer}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-widest text-stone-400 uppercase border-b border-stone-100 pb-2">{label}</p>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-widest text-stone-500">{children}</h2>;
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-stone-400">{k}</dt>
      <dd className="text-stone-800 mt-0.5 break-words">{v}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-400 italic">{children}</p>;
}

function StatusPill({ done, started, label }: { done: boolean; started: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] whitespace-nowrap ${
        done ? "bg-green-50 text-green-700" : started ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      {label}
    </span>
  );
}
