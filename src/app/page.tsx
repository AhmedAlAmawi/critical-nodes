"use client";

import { useReducer, useCallback, useEffect, useState } from "react";
import { AppContext, appReducer, initialState, type UploadedImage } from "@/lib/store";
import { buildSystemPrompt } from "@/lib/prompt-templates";
import { processImageFile, createThumbnail } from "@/lib/image-utils";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { ModelUpload } from "@/components/model-upload";
import { MaterialsGallery } from "@/components/materials-gallery";
import { FurnitureGallery } from "@/components/furniture-gallery";
import { PromptBuilder } from "@/components/prompt-builder";
import { RenderControls } from "@/components/render-controls";
import { RenderResult } from "@/components/render-result";
import { SettingsDialog } from "@/components/settings-dialog";
import { Separator } from "@/components/ui/separator";

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("gemini_api_key") || "";
}

export default function StudioPage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("render_history");
      if (saved) dispatch({ type: "LOAD_HISTORY", payload: JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    if (state.history.length > 0) {
      try {
        localStorage.setItem(
          "render_history",
          JSON.stringify(state.history.slice(0, 30))
        );
      } catch {}
    }
  }, [state.history]);

  const processImage = useCallback(
    async (image: UploadedImage): Promise<{ data: string; mimeType: string } | null> => {
      if (image.base64 && image.mimeType) {
        return { data: image.base64, mimeType: image.mimeType };
      }
      try {
        return await processImageFile(image.file);
      } catch (err) {
        console.error("Image processing failed:", err);
        return null;
      }
    },
    []
  );

  const handleRender = useCallback(async () => {
    if (!state.modelImage || !state.prompt.trim()) return;

    dispatch({ type: "CLEAR_RESULT" });
    dispatch({ type: "SET_RENDERING", payload: true });
    dispatch({ type: "SET_RENDER_PROGRESS", payload: 10 });

    const allImages: UploadedImage[] = [
      state.modelImage,
      ...state.materialImages,
      ...state.furnitureImages,
    ];

    const processedImages: { data: string; mimeType: string }[] = [];

    for (const img of allImages) {
      const result = await processImage(img);
      if (!result) {
        dispatch({ type: "SET_RENDERING", payload: false });
        dispatch({
          type: "SET_RENDER_ERROR",
          payload: `Failed to process image: ${img.file.name}`,
        });
        return;
      }
      processedImages.push(result);
    }

    dispatch({ type: "SET_RENDER_PROGRESS", payload: 25 });

    const systemPrompt = buildSystemPrompt(
      state.prompt,
      state.materialImages.length,
      state.furnitureImages.length
    );

    const geminiKey = getApiKey();

    try {
      dispatch({ type: "SET_RENDER_PROGRESS", payload: 35 });

      const res = await fetch("/api/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(geminiKey && { "x-gemini-key": geminiKey }),
        },
        body: JSON.stringify({
          images: processedImages,
          prompt: systemPrompt,
          aspectRatio: state.aspectRatio,
          imageSize: state.imageSize,
          model: state.geminiModel,
        }),
      });

      const data = await res.json();

      if (data.error) {
        dispatch({ type: "SET_RENDERING", payload: false });
        dispatch({ type: "SET_RENDER_ERROR", payload: data.error });
        return;
      }

      dispatch({ type: "SET_RENDERING", payload: false });
      dispatch({ type: "SET_RENDER_PROGRESS", payload: 100 });
      dispatch({
        type: "SET_RENDER_RESULT",
        payload: { image: data.imageBase64, mimeType: data.mimeType },
      });

      try {
        const thumb = await createThumbnail(data.imageBase64, data.mimeType);
        dispatch({
          type: "ADD_HISTORY_ITEM",
          payload: {
            id: crypto.randomUUID(),
            prompt: state.prompt,
            thumbnail: thumb,
            fullImage: null,
            createdAt: Date.now(),
            model: state.geminiModel,
            aspectRatio: state.aspectRatio,
          },
        });
      } catch {}
    } catch (err) {
      dispatch({ type: "SET_RENDERING", payload: false });
      dispatch({
        type: "SET_RENDER_ERROR",
        payload: err instanceof Error ? err.message : "Request failed",
      });
    }
  }, [
    state.modelImage,
    state.materialImages,
    state.furnitureImages,
    state.prompt,
    state.aspectRatio,
    state.imageSize,
    state.geminiModel,
    processImage,
  ]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="h-screen overflow-hidden p-2.5 pt-[52px] flex gap-2.5">
        {/* Left panel -- inputs */}
        <aside className="w-[340px] shrink-0 flex flex-col overflow-hidden rounded-2xl bg-background border border-white/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
          {/* Brand */}
          <div className="shrink-0 px-5 h-14 flex items-center border-b border-white/[0.05]">
            <Logo size="md" />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
            <ModelUpload />
            <Separator className="bg-white/[0.04]" />
            <MaterialsGallery />
            <Separator className="bg-white/[0.04]" />
            <FurnitureGallery />
            <Separator className="bg-white/[0.04]" />
            <PromptBuilder />
          </div>

          <div className="shrink-0 p-4 border-t border-white/[0.05]">
            <RenderControls onRender={handleRender} />
          </div>
        </aside>

        {/* Right panel -- canvas */}
        <main className="flex-1 flex flex-col overflow-hidden rounded-2xl bg-background border border-white/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
          <RenderResult />
        </main>
      </div>

      <Nav onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AppContext.Provider>
  );
}
