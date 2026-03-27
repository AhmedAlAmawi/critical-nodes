"use client";

import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { type RenderHistoryItem } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface RenderHistoryProps {
  history: RenderHistoryItem[];
  onSelect: (item: RenderHistoryItem) => void;
  onClear: () => void;
}

export function RenderHistory({
  history,
  onSelect,
  onClear,
}: RenderHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-display text-lg text-foreground/15 mb-2">
          No renders yet
        </p>
        <p className="text-[12px] text-muted-foreground/30 max-w-[200px] leading-relaxed">
          Generated renders will be saved here automatically
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-lg">Gallery</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground gap-1.5"
          onClick={onClear}
        >
          <Trash2 className="w-3 h-3" />
          Clear all
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {history.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onSelect(item)}
            className="group text-left"
          >
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-secondary/50 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <p className="text-[11px] text-foreground/60 line-clamp-2 leading-relaxed">
              {item.prompt}
            </p>
            <p className="text-[10px] text-muted-foreground/30 mt-1 font-mono">
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
