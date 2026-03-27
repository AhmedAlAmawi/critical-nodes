"use client";

import { Armchair } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";

const MAX_FURNITURE = 3;

export function FurnitureGallery() {
  const { state, dispatch } = useApp();

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      if (state.furnitureImages.length >= MAX_FURNITURE) return;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      dispatch({
        type: "ADD_FURNITURE_IMAGE",
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
    const img = state.furnitureImages.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    dispatch({ type: "REMOVE_FURNITURE_IMAGE", payload: id });
  };

  const hasImages = state.furnitureImages.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Armchair className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Furniture
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
          {state.furnitureImages.length}/{MAX_FURNITURE}
        </span>
      </div>

      {hasImages && (
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <AnimatePresence>
            {state.furnitureImages.map((img) => (
              <ImageThumbnail
                key={img.id}
                src={img.preview}
                alt="Furniture"
                uploading={img.processing}
                onRemove={() => handleRemove(img.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {state.furnitureImages.length < MAX_FURNITURE && (
        <UploadZone
          onFiles={handleFiles}
          multiple
          maxFiles={MAX_FURNITURE}
          currentCount={state.furnitureImages.length}
          compact={hasImages}
          label={hasImages ? "Add furniture" : "Furniture references"}
          sublabel={hasImages ? undefined : "Chairs, tables, fixtures"}
        />
      )}
    </div>
  );
}
