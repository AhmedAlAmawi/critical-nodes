"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  currentCount?: number;
  disabled?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
}

export function UploadZone({
  onFiles,
  multiple = false,
  maxFiles,
  currentCount = 0,
  disabled = false,
  compact = false,
  children,
  icon,
  label,
  sublabel,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length === 0) return;
      const remaining = maxFiles ? maxFiles - currentCount : undefined;
      const toAdd =
        remaining !== undefined ? files.slice(0, remaining) : files;
      if (toAdd.length > 0) onFiles(toAdd);
    },
    [disabled, maxFiles, currentCount, onFiles]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = multiple;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      const remaining = maxFiles ? maxFiles - currentCount : undefined;
      const toAdd =
        remaining !== undefined ? files.slice(0, remaining) : files;
      if (toAdd.length > 0) onFiles(toAdd);
    };
    input.click();
  }, [disabled, multiple, maxFiles, currentCount, onFiles]);

  const isFull = maxFiles !== undefined && currentCount >= maxFiles;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={isFull ? undefined : handleClick}
      className={cn(
        "relative rounded-lg border border-dashed transition-all duration-200",
        compact ? "p-3" : "p-5",
        isDragging
          ? "border-warm/40 bg-warm/[0.03]"
          : "border-border hover:border-muted-foreground/25",
        disabled && "opacity-40 pointer-events-none",
        isFull && "pointer-events-none opacity-40",
        !isFull && !disabled && "cursor-pointer"
      )}
    >
      {children || (
        <div
          className={cn(
            "flex items-center gap-3",
            compact ? "" : "flex-col text-center gap-2.5"
          )}
        >
          {compact ? (
            <Plus className="w-4 h-4 text-muted-foreground" />
          ) : (
            icon || (
              <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
            )
          )}
          <div>
            <p
              className={cn(
                "font-medium text-foreground/70",
                compact ? "text-xs" : "text-[13px]"
              )}
            >
              {label}
            </p>
            {sublabel && !compact && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {sublabel}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
