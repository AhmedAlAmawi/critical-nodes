"use client";

import { useState } from "react";
import { ChevronDown, Wand2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import { promptTemplates } from "@/lib/prompt-templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PromptBuilder() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);

  const handleTemplateSelect = (prompt: string) => {
    dispatch({ type: "SET_PROMPT", payload: prompt });
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Prompt
          </span>
        </div>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger className="inline-flex items-center h-6 px-2 rounded text-[11px] text-muted-foreground/60 gap-1 hover:text-muted-foreground transition-colors">
            Presets
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {promptTemplates.map((t) => (
              <DropdownMenuItem
                key={t.name}
                onClick={() => handleTemplateSelect(t.prompt)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="text-[13px] font-medium">{t.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.description}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Textarea
        value={state.prompt}
        onChange={(e) =>
          dispatch({ type: "SET_PROMPT", payload: e.target.value })
        }
        placeholder={`Describe how to render this scene.\n\nExample: Apply the walnut wood to the floor and marble to the island countertop. Place the dining chairs around the table. Warm afternoon light from the windows.`}
        className="min-h-[120px] resize-y bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/30"
        disabled={state.isRendering}
      />
    </div>
  );
}
