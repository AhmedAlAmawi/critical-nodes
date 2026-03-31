"use client";

import { Target, Palette, Sun, Image as ImageIcon, Check } from "lucide-react";
import { useApp, getActiveSession, NODE_ORDER } from "@/lib/store";
import { cn } from "@/lib/utils";

function SummarySection({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-warm" />
        <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-mono">{label}</span>
      <p className="text-[13px] text-foreground/80 leading-relaxed mt-0.5">{value}</p>
    </div>
  );
}

export function IntentSummary() {
  const { state } = useApp();
  const session = getActiveSession(state);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <p className="font-display text-xl text-foreground/30 mb-3">Critical Nodes</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            A cognitive discipline system for AI-mediated representation. Start a session to begin.
          </p>
        </div>
      </div>
    );
  }

  if (!session.intent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-warm/[0.06] border border-warm/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-7 h-7 text-warm/60" />
          </div>
          <p className="font-display text-lg text-foreground/40 mb-2">Define Your Intent</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Complete Node 01 to establish the reference anchor for all subsequent decisions.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = NODE_ORDER.indexOf(session.currentNode);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="p-6 space-y-6">
        <div>
          <p className="text-[10px] font-mono tracking-wider uppercase text-warm mb-1.5">Session Anchor</p>
          <h2 className="font-display text-lg text-foreground leading-snug">
            {session.intent.intentStatement ? session.intent.intentStatement.split(".")[0] + "." : "Intent Defined"}
          </h2>
        </div>

        {/* Node progress pills */}
        <div className="flex items-center gap-2">
          {NODE_ORDER.map((nodeId, idx) => {
            const done = idx < currentIdx;
            const active = nodeId === state.activeNode;
            return (
              <div key={nodeId} className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono",
                done && "bg-warm/10 text-warm",
                active && !done && "bg-foreground/[0.06] text-foreground/80",
                !done && !active && "text-muted-foreground/40"
              )}>
                {done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                {String(idx + 1).padStart(2, "0")}
              </div>
            );
          })}
        </div>

        <div className="h-px bg-foreground/[0.06]" />

        <SummarySection icon={Target} label="Intent">
          <div className="space-y-3">
            <SummaryField label="Concept" value={session.intent.conceptStatement} />
            <SummaryField label="Target User" value={session.intent.targetUser} />
            <SummaryField label="Spatial Goal" value={session.intent.spatialGoal} />
            <SummaryField label="Atmosphere" value={session.intent.emotionalAtmosphere} />
            <SummaryField label="Image Type" value={session.intent.imageType} />
          </div>
          {session.intent.intentStatement && (
            <div className="mt-3 border-l-2 border-warm/40 pl-3">
              <p className="text-[13px] text-foreground/70 italic leading-relaxed">{session.intent.intentStatement}</p>
            </div>
          )}
        </SummarySection>

        {session.materialJustifications.length > 0 && (
          <>
            <div className="h-px bg-foreground/[0.06]" />
            <SummarySection icon={Palette} label="Materials">
              <div className="space-y-3">
                {session.materialJustifications.map((m, i) => (
                  <div key={m.id} className="space-y-1">
                    <p className="text-[13px] font-medium text-foreground/80">{m.materialName || `Material ${i + 1}`}</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{m.whyForUser}</p>
                  </div>
                ))}
              </div>
            </SummarySection>
          </>
        )}

        {session.lighting && (
          <>
            <div className="h-px bg-foreground/[0.06]" />
            <SummarySection icon={Sun} label="Lighting">
              <div className="space-y-2">
                <SummaryField label="Time" value={session.lighting.timeOfDay} />
                <SummaryField label="Source" value={session.lighting.lightSource} />
                <SummaryField label="Mood" value={session.lighting.moodProduced} />
              </div>
            </SummarySection>
          </>
        )}

        {session.referenceBreakdowns.length > 0 && (
          <>
            <div className="h-px bg-foreground/[0.06]" />
            <SummarySection icon={ImageIcon} label="References">
              <div className="space-y-3">
                {session.referenceBreakdowns.map((r, i) => (
                  <div key={r.id} className="space-y-1">
                    <p className="text-[11px] font-mono text-muted-foreground">Ref {i + 1}</p>
                    <p className="text-[12px] text-foreground/75">{r.lens} / {r.framing} / {r.tone}</p>
                    <p className="text-[11px] text-muted-foreground/70">Not borrowing: {r.notBorrowing}</p>
                  </div>
                ))}
              </div>
            </SummarySection>
          </>
        )}
      </div>
    </div>
  );
}
