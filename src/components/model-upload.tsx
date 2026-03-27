"use client";

import { Box } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";

export function ModelUpload() {
  const { state, dispatch } = useApp();

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (state.modelImage) {
      URL.revokeObjectURL(state.modelImage.preview);
    }

    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);

    dispatch({
      type: "SET_MODEL_IMAGE",
      payload: {
        id,
        file,
        preview,
        base64: null,
        mimeType: null,
        processing: false,
      },
    });
  };

  const handleRemove = () => {
    if (state.modelImage) {
      URL.revokeObjectURL(state.modelImage.preview);
    }
    dispatch({ type: "SET_MODEL_IMAGE", payload: null });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Model
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 tracking-wider">
          REQUIRED
        </span>
      </div>

      {state.modelImage ? (
        <AnimatePresence mode="wait">
          <ImageThumbnail
            key={state.modelImage.id}
            src={state.modelImage.preview}
            alt="3D Model Screenshot"
            uploading={state.modelImage.processing}
            onRemove={handleRemove}
            aspectRatio="aspect-[4/3]"
          />
        </AnimatePresence>
      ) : (
        <UploadZone
          onFiles={handleFiles}
          label="Rhino screenshot"
          sublabel="Drop or click to upload"
          icon={
            <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center">
              <Box className="w-4 h-4 text-muted-foreground/60" />
            </div>
          }
        />
      )}
    </div>
  );
}
