"use client";

import { Check, CircleDot, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeShellProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  totalFields: number;
  completedFields: number;
  onSkip?: () => void;
  skipped?: boolean;
  children: React.ReactNode;
}

export function NodeShell({
  number,
  title,
  description,
  icon,
  totalFields,
  completedFields,
  onSkip,
  skipped,
  children,
}: NodeShellProps) {
  const progress = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  const allComplete = completedFields >= totalFields && totalFields > 0;

  return (
    <div className="space-y-5">
      <div className="relative">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <span className="text-[40px] font-display leading-none text-foreground/[0.04] select-none">
              {number}
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              {icon}
            </div>
          </div>

          <div className="flex-1 pt-1">
            <h2 className="text-[14px] font-medium text-foreground tracking-tight">
              {title}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {totalFields > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  allComplete ? "bg-warm" : "bg-warm/60"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={cn(
              "text-[11px] font-mono tabular-nums shrink-0",
              allComplete ? "text-warm" : "text-muted-foreground"
            )}>
              {completedFields}/{totalFields}
            </span>
          </div>
        )}
      </div>

      {skipped && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
          <SkipForward className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono tracking-wider uppercase">
            Skipped — return anytime to strengthen this node
          </span>
        </div>
      )}

      {children}

      {onSkip && !allComplete && (
        <button
          onClick={onSkip}
          className="w-full flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <SkipForward className="w-3 h-3" />
          Skip — I&apos;ll return to this later
        </button>
      )}
    </div>
  );
}

interface ChallengeCardProps {
  label: string;
  hint?: string;
  filled?: boolean;
  errors?: string[];
  warnings?: string[];
  children: React.ReactNode;
}

export function ChallengeCard({ label, hint, filled, errors, warnings, children }: ChallengeCardProps) {
  const hasError = errors && errors.length > 0;
  const hasWarning = warnings && warnings.length > 0;

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all duration-200",
      hasError
        ? "border-destructive/30 bg-destructive/[0.03]"
        : filled
          ? "border-warm/20 bg-warm/[0.02]"
          : "border-foreground/[0.07] bg-foreground/[0.01]"
    )}>
      <div className="flex items-start gap-3 mb-2.5">
        <div className={cn(
          "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all",
          filled
            ? "bg-warm/20"
            : "bg-foreground/[0.05]"
        )}>
          {filled ? (
            <Check className="w-2.5 h-2.5 text-warm" strokeWidth={3} />
          ) : (
            <CircleDot className="w-2.5 h-2.5 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-foreground/90">
            {label}
          </label>
          {hint && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
          )}
        </div>
      </div>

      {children}

      {errors?.map((e, i) => (
        <p key={i} className="text-[11px] text-destructive mt-2 pl-7">
          {e}
        </p>
      ))}

      {hasWarning && !hasError && warnings.map((w, i) => (
        <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 pl-7">
          {w}
        </p>
      ))}
    </div>
  );
}
