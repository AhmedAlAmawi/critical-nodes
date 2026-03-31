"use client";

import { Check, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeShellProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  totalFields: number;
  completedFields: number;
  locked?: boolean;
  children: React.ReactNode;
}

export function NodeShell({
  number,
  title,
  description,
  icon,
  totalFields,
  completedFields,
  locked,
  children,
}: NodeShellProps) {
  const progress = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  const allComplete = completedFields >= totalFields && totalFields > 0;

  return (
    <div className="space-y-5">
      {/* Big header */}
      <div className="relative">
        <div className="flex items-start gap-4">
          {/* Big number */}
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

        {/* Completion bar */}
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

      {locked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warm/[0.06] border border-warm/20">
          <Check className="w-3.5 h-3.5 text-warm" />
          <span className="text-[11px] text-warm font-mono tracking-wider uppercase">
            Locked
          </span>
        </div>
      )}

      {children}
    </div>
  );
}

interface ChallengeCardProps {
  label: string;
  hint?: string;
  filled?: boolean;
  errors?: string[];
  children: React.ReactNode;
}

export function ChallengeCard({ label, hint, filled, errors, children }: ChallengeCardProps) {
  const hasError = errors && errors.length > 0;

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
    </div>
  );
}
