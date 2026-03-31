"use client";

import { X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

interface ImageThumbnailProps {
  src: string;
  alt: string;
  uploading?: boolean;
  onRemove?: () => void;
  aspectRatio?: string;
}

export function ImageThumbnail({
  src,
  alt,
  uploading,
  onRemove,
  aspectRatio = "aspect-square",
}: ImageThumbnailProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`relative group ${aspectRatio} rounded-lg overflow-hidden bg-secondary/50`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        unoptimized
      />

      {uploading && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-foreground/60 animate-spin" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/80"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}
    </motion.div>
  );
}
