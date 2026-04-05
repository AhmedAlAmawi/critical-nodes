"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Layers, ArrowRight, Loader2, Box, Image as ImageIcon, Eye } from "lucide-react";
import {
  useApp, getActiveSession,
  type PromptFields, type AppState, type GeminiModel, type UploadedImage,
} from "@/lib/store";
import { assemblePrompt, buildSystemPromptWithImages } from "@/lib/prompt-assembly";
import { processImageFile, createThumbnail } from "@/lib/image-utils";
import { validateRequired } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeShell, ChallengeCard } from "@/components/node-shell";

const emptyFields: PromptFields = { lens: "", lighting: "", materials: "", cameraHeight: "", mood: "", composition: "", resolution: "" };

type FieldErrors = Partial<Record<keyof PromptFields, string[]>>;

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("gemini_api_key") || "";
}

export function PromptArchitecture() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  const [fields, setFields] = useState<PromptFields>(session?.promptFields ?? emptyFields);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (session?.promptFields) setFields(session.promptFields);
  }, [session?.promptFields]);

  const filledCount = useMemo(() => {
    let c = 0;
    if (fields.lens.trim()) c++;
    if (fields.lighting.trim()) c++;
    if (fields.materials.trim()) c++;
    if (fields.cameraHeight.trim()) c++;
    if (fields.mood.trim()) c++;
    if (fields.composition.trim()) c++;
    if (fields.resolution.trim()) c++;
    return c;
  }, [fields]);

  function update<K extends keyof PromptFields>(field: K, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const processImage = useCallback(async (image: UploadedImage): Promise<{ data: string; mimeType: string } | null> => {
    if (image.base64 && image.mimeType) return { data: image.base64, mimeType: image.mimeType };
    try { return await processImageFile(image.file); } catch { return null; }
  }, []);

  async function handleRender() {
    if (!state.modelImage || !session) return;
    const reqErrors: FieldErrors = {};
    for (const [k, v] of Object.entries(fields)) {
      const err = validateRequired(v, k);
      if (err) reqErrors[k as keyof PromptFields] = [err];
    }
    if (Object.keys(reqErrors).length > 0) { setErrors(reqErrors); return; }

    dispatch({ type: "SET_PROMPT_FIELDS", payload: fields });
    dispatch({ type: "CLEAR_RESULT" });
    dispatch({ type: "SET_RENDERING", payload: true });
    dispatch({ type: "SET_RENDER_PROGRESS", payload: 10 });

    const allImages: UploadedImage[] = [state.modelImage, ...state.materialImages, ...state.referenceImages];
    const processedImages: { data: string; mimeType: string }[] = [];
    for (const img of allImages) {
      const result = await processImage(img);
      if (!result) { dispatch({ type: "SET_RENDERING", payload: false }); dispatch({ type: "SET_RENDER_ERROR", payload: `Failed to process image: ${img.file.name}` }); return; }
      processedImages.push(result);
    }
    dispatch({ type: "SET_RENDER_PROGRESS", payload: 25 });

    const assembled = assemblePrompt(session, fields);
    const systemPrompt = buildSystemPromptWithImages(assembled, state.materialImages.length, state.referenceImages.length);
    dispatch({ type: "SET_PROMPT", payload: systemPrompt });

    const geminiKey = getApiKey();
    try {
      dispatch({ type: "SET_RENDER_PROGRESS", payload: 35 });
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(geminiKey && { "x-gemini-key": geminiKey }) },
        body: JSON.stringify({ images: processedImages, prompt: systemPrompt, aspectRatio: state.aspectRatio, imageSize: state.imageSize, model: state.geminiModel }),
      });
      const data = await res.json();
      if (data.error) { dispatch({ type: "SET_RENDERING", payload: false }); dispatch({ type: "SET_RENDER_ERROR", payload: data.error }); return; }

      dispatch({ type: "SET_RENDERING", payload: false });
      dispatch({ type: "SET_RENDER_PROGRESS", payload: 100 });
      dispatch({ type: "SET_RENDER_RESULT", payload: { image: data.imageBase64, mimeType: data.mimeType } });
      if (session.currentNode === "prompt") dispatch({ type: "ADVANCE_NODE" });
      try {
        const thumb = await createThumbnail(data.imageBase64, data.mimeType);
        dispatch({ type: "ADD_HISTORY_ITEM", payload: { id: crypto.randomUUID(), prompt: systemPrompt.slice(0, 200), thumbnail: thumb, fullImage: null, createdAt: Date.now(), model: state.geminiModel, aspectRatio: state.aspectRatio, sessionId: session.id } });
      } catch {}
    } catch (err) {
      dispatch({ type: "SET_RENDERING", payload: false });
      dispatch({ type: "SET_RENDER_ERROR", payload: err instanceof Error ? err.message : "Request failed" });
    }
  }

  const canRender = !state.isRendering && state.modelImage;

  return (
    <NodeShell
      number="06"
      title="Prompt Architecture"
      description="The prompt assembles your declared decisions using the structure-reference-vision hierarchy. Review each section before generating."
      icon={<Layers className="w-5 h-5 text-warm" />}
      totalFields={7}
      completedFields={filledCount}
    >
      {/* Pillar 1: Structure (read-only summary from Geometry node) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-warm/70" />
          <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">Pillar 1: Structure</span>
        </div>
        <div className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]">
          {state.modelImage ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-foreground/70">Model screenshot uploaded</p>
              {session?.geometryValidation?.cameraRelationship && (
                <p className="text-[11px] text-foreground/70">
                  Camera: intentionally <span className="text-warm">{session.geometryValidation.cameraRelationship}</span> to reference
                </p>
              )}
              {session?.geometryValidation?.cameraJustification && (
                <p className="text-[10px] text-muted-foreground">{session.geometryValidation.cameraJustification}</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No model uploaded yet. Complete Geometry & View node first.</p>
          )}
        </div>
      </div>

      {/* Pillar 2: Reference (read-only summary from Reference node) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-warm/70" />
          <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">Pillar 2: Reference</span>
        </div>
        <div className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]">
          {session?.referenceBreakdowns && session.referenceBreakdowns.length > 0 ? (
            <div className="space-y-2">
              {session.referenceBreakdowns.map((r, i) => (
                <div key={r.id} className="space-y-1">
                  <p className="text-[10px] font-mono text-muted-foreground">Reference {i + 1}</p>
                  <p className="text-[11px] text-foreground/70">{r.lens} / {r.framing} / {r.tone}</p>
                  {r.borrowingCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.borrowingCategories.map((cat) => (
                        <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded bg-warm/10 text-warm">{cat}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No references deconstructed yet.</p>
          )}
        </div>
      </div>

      {/* Pillar 3: Vision (editable fields) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-warm/70" />
          <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground">Pillar 3: Vision</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ChallengeCard label="Lens" filled={!!fields.lens.trim()} errors={errors.lens}>
            <input type="text" value={fields.lens} onChange={(e) => update("lens", e.target.value)} placeholder="e.g. 24mm wide" className="w-full h-8 px-3 rounded-md bg-transparent border border-border text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring" disabled={state.isRendering} />
          </ChallengeCard>
          <ChallengeCard label="Camera Height" filled={!!fields.cameraHeight.trim()} errors={errors.cameraHeight}>
            <input type="text" value={fields.cameraHeight} onChange={(e) => update("cameraHeight", e.target.value)} placeholder="e.g. Eye level, 1.5m" className="w-full h-8 px-3 rounded-md bg-transparent border border-border text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring" disabled={state.isRendering} />
          </ChallengeCard>
        </div>

        <ChallengeCard label="Lighting" filled={!!fields.lighting.trim()} errors={errors.lighting}>
          <Textarea value={fields.lighting} onChange={(e) => update("lighting", e.target.value)} placeholder="e.g. Warm afternoon light from west-facing windows, soft ambient fill" className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={state.isRendering} />
        </ChallengeCard>

        <ChallengeCard label="Materials" filled={!!fields.materials.trim()} errors={errors.materials}>
          <Textarea value={fields.materials} onChange={(e) => update("materials", e.target.value)} placeholder="e.g. Honed travertine floors, white oak joinery, linen upholstery" className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={state.isRendering} />
        </ChallengeCard>

        <ChallengeCard label="Mood" filled={!!fields.mood.trim()} errors={errors.mood}>
          <Textarea value={fields.mood} onChange={(e) => update("mood", e.target.value)} placeholder="e.g. Quiet contemplation, tactile warmth, spatial generosity" className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={state.isRendering} />
        </ChallengeCard>

        <ChallengeCard label="Composition" filled={!!fields.composition.trim()} errors={errors.composition}>
          <Textarea value={fields.composition} onChange={(e) => update("composition", e.target.value)} placeholder="e.g. Strong left-to-right depth with fireplace as focal anchor" className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={state.isRendering} />
        </ChallengeCard>

        <ChallengeCard label="Resolution" filled={!!fields.resolution.trim()} errors={errors.resolution}>
          <input type="text" value={fields.resolution} onChange={(e) => update("resolution", e.target.value)} placeholder="e.g. 8K, high detail" className="w-full h-8 px-3 rounded-md bg-transparent border border-border text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring" disabled={state.isRendering} />
        </ChallengeCard>
      </div>

      {/* Render controls */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={state.aspectRatio} onValueChange={(v) => dispatch({ type: "SET_ASPECT_RATIO", payload: v as AppState["aspectRatio"] })} disabled={state.isRendering}>
            <SelectTrigger className="w-[88px] h-8 bg-transparent border-border text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="9:16">9:16</SelectItem><SelectItem value="4:3">4:3</SelectItem><SelectItem value="3:4">3:4</SelectItem><SelectItem value="1:1">1:1</SelectItem></SelectContent>
          </Select>
          <Select value={state.imageSize} onValueChange={(v) => dispatch({ type: "SET_IMAGE_SIZE", payload: v as AppState["imageSize"] })} disabled={state.isRendering}>
            <SelectTrigger className="w-[72px] h-8 bg-transparent border-border text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1K">1K</SelectItem><SelectItem value="2K">2K</SelectItem><SelectItem value="4K">4K</SelectItem></SelectContent>
          </Select>
          <Select value={state.geminiModel} onValueChange={(v) => dispatch({ type: "SET_GEMINI_MODEL", payload: v as GeminiModel })} disabled={state.isRendering}>
            <SelectTrigger className="w-[170px] h-8 bg-transparent border-border text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="gemini-3.1-flash-image-preview">Nano Banana 2</SelectItem><SelectItem value="gemini-3-pro-image-preview">Nano Banana Pro</SelectItem></SelectContent>
          </Select>
        </div>

        <Button onClick={handleRender} disabled={!canRender} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all disabled:opacity-20">
          {state.isRendering ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Rendering...</span></>) : (<><span>Generate Render</span><ArrowRight className="w-4 h-4" /></>)}
        </Button>

        {!state.modelImage && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
            Upload a model screenshot in the Geometry & View node first.
          </p>
        )}
      </div>
    </NodeShell>
  );
}
