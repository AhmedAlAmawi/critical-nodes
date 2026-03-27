"use client";

import { Palette } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";

const MAX_MATERIALS = 4;

export function MaterialsGallery() {
  const { state, dispatch } = useApp();

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      if (state.materialImages.length >= MAX_MATERIALS) return;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      dispatch({
        type: "ADD_MATERIAL_IMAGE",
        payload: {
          id,
          file,
          preview,
          base64: null,
          mimeType: null,
          processing: false,
        },
      });
    });
  };

  const handleRemove = (id: string) => {
    const img = state.materialImages.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    dispatch({ type: "REMOVE_MATERIAL_IMAGE", payload: id });
  };

  const hasImages = state.materialImages.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Materials
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
          {state.materialImages.length}/{MAX_MATERIALS}
        </span>
      </div>

      {hasImages && (
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <AnimatePresence>
            {state.materialImages.map((img) => (
              <ImageThumbnail
                key={img.id}
                src={img.preview}
                alt="Material"
                uploading={img.processing}
                onRemove={() => handleRemove(img.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {state.materialImages.length < MAX_MATERIALS && (
        <UploadZone
          onFiles={handleFiles}
          multiple
          maxFiles={MAX_MATERIALS}
          currentCount={state.materialImages.length}
          compact={hasImages}
          label={hasImages ? "Add material" : "Material references"}
          sublabel={hasImages ? undefined : "Textures, finishes, samples"}
        />
      )}
    </div>
  );
}
