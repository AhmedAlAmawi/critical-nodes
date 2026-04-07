"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenTool, LayoutGrid, Settings, Check, AlertTriangle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NODE_ORDER,
  NODE_LABELS,
  getNodeStatus,
  getSkipDiagnostic,
  type NodeId,
  type Session,
} from "@/lib/store";

const navItems = [
  { href: "/", label: "Studio", icon: PenTool },
  { href: "/gallery", label: "Gallery", icon: LayoutGrid },
];

interface NavProps {
  onOpenSettings: () => void;
  onOpenDrawer?: (nodeId: NodeId) => void;
  session?: Session | null;
}

export function Nav({ onOpenSettings, onOpenDrawer, session }: NavProps) {
  const pathname = usePathname();
  const isStudio = pathname === "/";

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-0.5 px-1.5 h-11 rounded-2xl border border-border bg-background/80 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        {/* Logo */}
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-foreground hover:bg-foreground/[0.05] transition-all duration-200">
            <Link href="/" className="flex items-center justify-center w-full h-full">
              <LogoMark size="sm" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Home</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-foreground/[0.06] mx-0.5" />

        {/* Nav links */}
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                className={cn(
                  "inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200",
                  active
                    ? "bg-foreground/[0.1] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]"
                )}
              >
                <Link href={item.href} className="flex items-center justify-center w-full h-full">
                  <Icon className="w-[17px] h-[17px]" strokeWidth={1.6} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}

        {/* Node progress -- inline in nav when session is active on studio page */}
        {isStudio && session && onOpenDrawer && (
          <>
            <div className="w-px h-4 bg-foreground/[0.06] mx-1" />
            <div className="flex items-center gap-0.5">
              {NODE_ORDER.map((nodeId, idx) => {
                const status = getNodeStatus(session, nodeId);
                const diagnostic = status === "skipped" ? getSkipDiagnostic(nodeId) : null;

                const btn = (
                  <button
                    key={nodeId}
                    onClick={() => onOpenDrawer(nodeId)}
                    className={cn(
                      "relative flex items-center justify-center w-7 h-7 rounded-lg text-[9px] font-mono transition-all duration-200",
                      status === "complete" && "text-warm hover:bg-warm/10",
                      status === "partial" && "text-amber-500 hover:bg-amber-500/10",
                      status === "skipped" && "text-muted-foreground/40 hover:bg-foreground/[0.04]",
                      status === "empty" && "text-muted-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"
                    )}
                  >
                    {status === "complete" ? (
                      <Check className="w-3 h-3" strokeWidth={2.5} />
                    ) : status === "partial" ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : status === "skipped" ? (
                      <SkipForward className="w-2.5 h-2.5" />
                    ) : (
                      <span className="tabular-nums">{String(idx + 1).padStart(2, "0")}</span>
                    )}
                  </button>
                );

                if (diagnostic) {
                  return (
                    <Tooltip key={nodeId}>
                      <TooltipTrigger
                        onClick={() => onOpenDrawer(nodeId)}
                        className={cn(
                          "relative flex items-center justify-center w-7 h-7 rounded-lg text-[9px] font-mono transition-all duration-200",
                          "text-muted-foreground/40 hover:bg-foreground/[0.04]"
                        )}
                      >
                        <SkipForward className="w-2.5 h-2.5" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] text-[10px]">
                        {NODE_LABELS[nodeId]}: {diagnostic}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return btn;
              })}
            </div>
          </>
        )}

        <div className="w-px h-4 bg-foreground/[0.06] mx-0.5" />

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-all duration-200"
            onClick={onOpenSettings}
          >
            <Settings className="w-[17px] h-[17px]" strokeWidth={1.6} />
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
