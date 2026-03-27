"use client";

import { Loader2, ArrowRight } from "lucide-react";
import { useApp, type AppState, type GeminiModel } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RenderControlsProps {
  onRender: () => void;
}

export function RenderControls({ onRender }: RenderControlsProps) {
  const { state, dispatch } = useApp();

  const canRender =
    !state.isRendering && state.prompt.trim().length > 0 && state.modelImage;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={state.aspectRatio}
          onValueChange={(v) =>
            dispatch({
              type: "SET_ASPECT_RATIO",
              payload: v as AppState["aspectRatio"],
            })
          }
          disabled={state.isRendering}
        >
          <SelectTrigger className="w-[88px] h-8 bg-transparent border-border text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="4:3">4:3</SelectItem>
            <SelectItem value="3:4">3:4</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={state.imageSize}
          onValueChange={(v) =>
            dispatch({
              type: "SET_IMAGE_SIZE",
              payload: v as AppState["imageSize"],
            })
          }
          disabled={state.isRendering}
        >
          <SelectTrigger className="w-[72px] h-8 bg-transparent border-border text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1K">1K</SelectItem>
            <SelectItem value="2K">2K</SelectItem>
            <SelectItem value="4K">4K</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={state.geminiModel}
          onValueChange={(v) =>
            dispatch({
              type: "SET_GEMINI_MODEL",
              payload: v as GeminiModel,
            })
          }
          disabled={state.isRendering}
        >
          <SelectTrigger className="w-[170px] h-8 bg-transparent border-border text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini-3.1-flash-image-preview">
              Nano Banana 2
            </SelectItem>
            <SelectItem value="gemini-3-pro-image-preview">
              Nano Banana Pro
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={onRender}
        disabled={!canRender}
        className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all disabled:opacity-20"
      >
        {state.isRendering ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Rendering...</span>
          </>
        ) : (
          <>
            <span>Generate Render</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
