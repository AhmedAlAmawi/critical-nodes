"use client";

import { useEffect, useReducer, useState } from "react";
import {
  AppContext,
  appReducer,
  initialState,
  type RenderHistoryItem,
} from "@/lib/store";
import { Nav } from "@/components/nav";
import { RenderHistory } from "@/components/render-history";
import { SettingsDialog } from "@/components/settings-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Copy } from "lucide-react";

export default function GalleryPage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RenderHistoryItem | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("render_history");
      if (saved) dispatch({ type: "LOAD_HISTORY", payload: JSON.parse(saved) });
    } catch {}
  }, []);

  const handleClear = () => {
    dispatch({ type: "LOAD_HISTORY", payload: [] });
    localStorage.removeItem("render_history");
  };

  const handleSelect = (item: RenderHistoryItem) => {
    setSelectedItem(item);
  };

  const handleDownload = () => {
    if (!selectedItem) return;
    const a = document.createElement("a");
    a.href = selectedItem.thumbnail;
    a.download = `render-${selectedItem.id}.png`;
    a.click();
  };

  const handleCopy = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(selectedItem.thumbnail);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
    } catch {
      await navigator.clipboard.writeText(selectedItem.thumbnail);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="h-screen overflow-hidden p-2.5 pt-[52px]">
        <main className="h-full overflow-y-auto scrollbar-thin rounded-2xl bg-background border border-white/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
          <div className="max-w-5xl mx-auto px-8 py-10">
            <RenderHistory
              history={state.history}
              onSelect={handleSelect}
              onClear={handleClear}
            />
          </div>
        </main>
      </div>

      <Nav onOpenSettings={() => setSettingsOpen(true)} />

      {/* Lightbox */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6"
            onClick={() => setSelectedItem(null)}
          >
            <button
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              onClick={() => setSelectedItem(null)}
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

            <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedItem.thumbnail}
                alt=""
                className="w-full h-auto max-h-[80vh] object-contain rounded-md"
              />
              <p className="text-[12px] text-white/40 mt-4 text-center max-w-lg mx-auto leading-relaxed">
                {selectedItem.prompt}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AppContext.Provider>
  );
}
