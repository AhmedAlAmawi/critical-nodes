"use client";

import { useState, useMemo } from "react";
import { BookOpen, Search, Tag } from "lucide-react";
import curatedData from "@/config/curated-references.json";
import { cn } from "@/lib/utils";

interface CuratedReference {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

const ALL_TAGS = Array.from(new Set(curatedData.references.flatMap((r: CuratedReference) => r.tags)));

export function ReferenceLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return curatedData.references.slice(0, 3) as CuratedReference[];
    const lower = searchTerm.toLowerCase();
    const results = (curatedData.references as CuratedReference[]).filter((r) =>
      r.title.toLowerCase().includes(lower) ||
      r.description.toLowerCase().includes(lower) ||
      r.tags.some((t) => t.toLowerCase().includes(lower))
    );
    return results.slice(0, 3);
  }, [searchTerm]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-foreground/[0.06] hover:border-foreground/[0.12] transition-colors text-left"
      >
        <BookOpen className="w-3.5 h-3.5 text-warm/70 shrink-0" />
        <div>
          <p className="text-[11px] font-medium text-foreground/80">Reference Library</p>
          <p className="text-[10px] text-muted-foreground">Curated examples by light, camera, material, space</p>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.01] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-warm/70" />
          <span className="text-[11px] font-medium text-foreground/80">Reference Library</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Collapse
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by concept keyword..."
          className="w-full h-8 pl-8 pr-3 rounded-md bg-transparent border border-border text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setSearchTerm(tag)}
            className={cn(
              "text-[9px] px-2 py-0.5 rounded-md border transition-colors",
              searchTerm === tag
                ? "bg-warm/10 border-warm/30 text-warm"
                : "border-foreground/[0.08] text-muted-foreground/70 hover:text-foreground"
            )}
          >
            <Tag className="w-2 h-2 inline mr-1" />
            {tag}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-2 text-center">No matching references found.</p>
        ) : (
          filtered.map((ref) => (
            <div key={ref.id} className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.05] space-y-1.5">
              <p className="text-[12px] font-medium text-foreground/85">{ref.title}</p>
              <p className="text-[11px] text-foreground/60 leading-relaxed">{ref.description}</p>
              <div className="flex flex-wrap gap-1">
                {ref.tags.map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-warm/8 text-warm/80">{tag}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
