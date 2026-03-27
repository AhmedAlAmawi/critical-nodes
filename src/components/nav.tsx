"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenTool, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const items = [
  { href: "/", label: "Studio", icon: PenTool },
  { href: "/gallery", label: "Gallery", icon: LayoutGrid },
];

interface NavProps {
  onOpenSettings: () => void;
}

export function Nav({ onOpenSettings }: NavProps) {
  const pathname = usePathname();

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-0.5 px-1.5 h-11 rounded-2xl border border-white/[0.08] bg-background/80 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        {/* Logo home button */}
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-foreground hover:bg-white/[0.05] transition-all duration-200">
            <Link
              href="/"
              className="flex items-center justify-center w-full h-full"
            >
              <LogoMark size="sm" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Home</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-white/[0.06] mx-0.5" />

        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                className={cn(
                  "inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200",
                  active
                    ? "bg-white/[0.1] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                )}
              >
                <Link
                  href={item.href}
                  className="flex items-center justify-center w-full h-full"
                >
                  <Icon className="w-[17px] h-[17px]" strokeWidth={1.6} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}

        <div className="w-px h-4 bg-white/[0.06] mx-0.5" />

        <Tooltip>
          <TooltipTrigger
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-all duration-200"
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
