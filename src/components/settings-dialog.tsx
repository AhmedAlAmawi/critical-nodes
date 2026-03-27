"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStored(key: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) || "";
}

function setStored(key: string, value: string) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [geminiKey, setGeminiKey] = useState("");

  useEffect(() => {
    if (open) {
      setGeminiKey(getStored("gemini_api_key"));
    }
  }, [open]);

  const handleSave = () => {
    setStored("gemini_api_key", geminiKey);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Settings</DialogTitle>
          <DialogDescription className="text-[12px]">
            Your key is stored locally in the browser. You can also set{" "}
            <code className="text-[11px] font-mono bg-secondary px-1 py-0.5 rounded">
              GEMINI_API_KEY
            </code>{" "}
            in <code className="text-[11px] font-mono bg-secondary px-1 py-0.5 rounded">.env.local</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium">
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                Get key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-[13px] placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] bg-foreground text-background hover:bg-foreground/90"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
