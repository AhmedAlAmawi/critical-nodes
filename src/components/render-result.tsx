"use client";

import { useState } from "react";
import { Download, Copy, Maximize2, X, RotateCcw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RenderResult() {
  const { state, dispatch } = useApp();
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const dataUrl =
    state.renderResult && state.renderMimeType
      ? `data:${state.renderMimeType};base64,${state.renderResult}`
      : null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `critical-nodes-${Date.now()}.png`;
    a.click();
  };

  const handleCopy = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
    } catch {
      if (dataUrl) await navigator.clipboard.writeText(dataUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => dispatch({ type: "CLEAR_RESULT" });

  if (!state.isRendering && !state.renderResult && !state.renderError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <p className="font-display text-lg text-foreground/20 mb-2">
            Your render will appear here
          </p>
          <p className="text-[12px] text-muted-foreground/30 leading-relaxed">
            Upload a model screenshot, add materials and furniture, write a
            prompt, and generate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        {state.renderResult && (
          <div className="flex items-center justify-between px-4 h-10 border-b border-border shrink-0">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  onClick={handleDownload}
                >
                  <Download className="w-3.5 h-3.5" />
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  onClick={handleCopy}
                >
                  <Copy className="w-3.5 h-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? "Copied!" : "Copy image"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  onClick={() => setFullscreen(true)}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </TooltipTrigger>
                <TooltipContent>Fullscreen</TooltipContent>
              </Tooltip>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground gap-1.5"
              onClick={handleClear}
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </Button>
          </div>
        )}

        {/* Progress */}
        {state.isRendering && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-xs space-y-4">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Generating...</span>
                <span className="font-mono tabular-nums">
                  {state.renderProgress}%
                </span>
              </div>
              <Progress value={state.renderProgress} className="h-[3px]" />
              <p className="text-[11px] text-muted-foreground/30 text-center">
                This may take 30-60 seconds
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {state.renderError && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-sm text-center space-y-3">
              <AlertCircle className="w-5 h-5 text-destructive mx-auto" />
              <p className="text-[13px] text-destructive/80">
                {state.renderError}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px]"
                onClick={handleClear}
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Result image */}
        {dataUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex items-center justify-center p-4 overflow-hidden cursor-pointer"
            onClick={() => setFullscreen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="Rendered result"
              className="max-w-full max-h-full object-contain rounded-md"
            />
          </motion.div>
        )}
      </div>

      {/* Fullscreen lightbox */}
      <AnimatePresence>
        {fullscreen && dataUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6"
            onClick={() => setFullscreen(false)}
          >
            <button
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              onClick={() => setFullscreen(false)}
            >
              <X className="w-4 h-4 text-white" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <button
                className="h-8 px-4 rounded-full bg-white/10 text-[12px] text-white hover:bg-white/20 transition-colors flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                className="h-8 px-4 rounded-full bg-white/10 text-[12px] text-white hover:bg-white/20 transition-colors flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="Fullscreen render"
              className="max-w-full max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
