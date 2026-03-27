"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: 20, md: 28, lg: 36 }[size];

  return (
    <svg
      width={dims}
      height={dims}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Connection lines */}
      <line
        x1="8" y1="8" x2="24" y2="8"
        stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
      />
      <line
        x1="8" y1="8" x2="8" y2="24"
        stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
      />
      <line
        x1="8" y1="24" x2="24" y2="24"
        stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
      />
      <line
        x1="24" y1="8" x2="24" y2="24"
        stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
      />
      <line
        x1="8" y1="8" x2="24" y2="24"
        stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
      />
      <line
        x1="24" y1="8" x2="8" y2="24"
        stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
      />
      <line
        x1="16" y1="4" x2="16" y2="28"
        stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
      />
      <line
        x1="4" y1="16" x2="28" y2="16"
        stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
      />

      {/* Secondary nodes */}
      <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.2" />
      <circle cx="24" cy="8" r="1.5" fill="currentColor" opacity="0.2" />
      <circle cx="8" cy="24" r="1.5" fill="currentColor" opacity="0.2" />

      {/* Critical node -- warm accent, bottom right intersection */}
      <circle cx="24" cy="24" r="2.5" className="fill-warm" opacity="0.9" />
      <circle cx="24" cy="24" r="5" className="fill-warm" opacity="0.08" />

      {/* Center critical node */}
      <circle cx="16" cy="16" r="2" className="fill-warm" opacity="0.6" />
      <circle cx="16" cy="16" r="4" className="fill-warm" opacity="0.05" />

      {/* Mid nodes */}
      <circle cx="16" cy="8" r="1.2" fill="currentColor" opacity="0.12" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" opacity="0.12" />
      <circle cx="24" cy="16" r="1.2" fill="currentColor" opacity="0.15" />
      <circle cx="16" cy="24" r="1.2" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display tracking-[0.04em] uppercase",
              size === "sm" && "text-[10px]",
              size === "md" && "text-[11px]",
              size === "lg" && "text-[13px]"
            )}
          >
            Critical
          </span>
          <span
            className={cn(
              "font-display tracking-[0.04em] uppercase text-warm",
              size === "sm" && "text-[10px]",
              size === "md" && "text-[11px]",
              size === "lg" && "text-[13px]"
            )}
          >
            Nodes
          </span>
        </div>
      )}
    </div>
  );
}

export { LogoMark };
