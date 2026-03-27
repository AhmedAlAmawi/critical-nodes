"use client";

import { createContext, useContext } from "react";

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  base64: string | null;
  mimeType: string | null;
  processing: boolean;
}

export interface RenderHistoryItem {
  id: string;
  prompt: string;
  thumbnail: string;
  fullImage: string | null;
  createdAt: number;
  model: string;
  aspectRatio: string;
}

export type GeminiModel =
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview";

export interface AppState {
  modelImage: UploadedImage | null;
  materialImages: UploadedImage[];
  furnitureImages: UploadedImage[];
  prompt: string;
  aspectRatio: "16:9" | "9:16" | "4:3" | "3:4" | "1:1";
  imageSize: "1K" | "2K" | "4K";
  geminiModel: GeminiModel;
  isRendering: boolean;
  renderProgress: number;
  renderResult: string | null;
  renderMimeType: string | null;
  renderError: string | null;
  history: RenderHistoryItem[];
}

export type AppAction =
  | { type: "SET_MODEL_IMAGE"; payload: UploadedImage | null }
  | { type: "UPDATE_MODEL_IMAGE"; payload: Partial<UploadedImage> }
  | { type: "ADD_MATERIAL_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_MATERIAL_IMAGE"; payload: string }
  | {
      type: "UPDATE_MATERIAL_IMAGE";
      payload: { id: string } & Partial<UploadedImage>;
    }
  | { type: "ADD_FURNITURE_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_FURNITURE_IMAGE"; payload: string }
  | {
      type: "UPDATE_FURNITURE_IMAGE";
      payload: { id: string } & Partial<UploadedImage>;
    }
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SET_ASPECT_RATIO"; payload: AppState["aspectRatio"] }
  | { type: "SET_IMAGE_SIZE"; payload: AppState["imageSize"] }
  | { type: "SET_GEMINI_MODEL"; payload: GeminiModel }
  | { type: "SET_RENDERING"; payload: boolean }
  | { type: "SET_RENDER_PROGRESS"; payload: number }
  | {
      type: "SET_RENDER_RESULT";
      payload: { image: string; mimeType: string } | null;
    }
  | { type: "SET_RENDER_ERROR"; payload: string | null }
  | { type: "ADD_HISTORY_ITEM"; payload: RenderHistoryItem }
  | { type: "LOAD_HISTORY"; payload: RenderHistoryItem[] }
  | { type: "CLEAR_RESULT" };

export const initialState: AppState = {
  modelImage: null,
  materialImages: [],
  furnitureImages: [],
  prompt: "",
  aspectRatio: "16:9",
  imageSize: "2K",
  geminiModel: "gemini-3.1-flash-image-preview",
  isRendering: false,
  renderProgress: 0,
  renderResult: null,
  renderMimeType: null,
  renderError: null,
  history: [],
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_MODEL_IMAGE":
      return { ...state, modelImage: action.payload };
    case "UPDATE_MODEL_IMAGE":
      return state.modelImage
        ? { ...state, modelImage: { ...state.modelImage, ...action.payload } }
        : state;
    case "ADD_MATERIAL_IMAGE":
      return {
        ...state,
        materialImages: [...state.materialImages, action.payload],
      };
    case "REMOVE_MATERIAL_IMAGE":
      return {
        ...state,
        materialImages: state.materialImages.filter(
          (i) => i.id !== action.payload
        ),
      };
    case "UPDATE_MATERIAL_IMAGE":
      return {
        ...state,
        materialImages: state.materialImages.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload } : i
        ),
      };
    case "ADD_FURNITURE_IMAGE":
      return {
        ...state,
        furnitureImages: [...state.furnitureImages, action.payload],
      };
    case "REMOVE_FURNITURE_IMAGE":
      return {
        ...state,
        furnitureImages: state.furnitureImages.filter(
          (i) => i.id !== action.payload
        ),
      };
    case "UPDATE_FURNITURE_IMAGE":
      return {
        ...state,
        furnitureImages: state.furnitureImages.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload } : i
        ),
      };
    case "SET_PROMPT":
      return { ...state, prompt: action.payload };
    case "SET_ASPECT_RATIO":
      return { ...state, aspectRatio: action.payload };
    case "SET_IMAGE_SIZE":
      return { ...state, imageSize: action.payload };
    case "SET_GEMINI_MODEL":
      return { ...state, geminiModel: action.payload };
    case "SET_RENDERING":
      return { ...state, isRendering: action.payload };
    case "SET_RENDER_PROGRESS":
      return { ...state, renderProgress: action.payload };
    case "SET_RENDER_RESULT":
      return action.payload
        ? {
            ...state,
            renderResult: action.payload.image,
            renderMimeType: action.payload.mimeType,
          }
        : { ...state, renderResult: null, renderMimeType: null };
    case "SET_RENDER_ERROR":
      return { ...state, renderError: action.payload };
    case "ADD_HISTORY_ITEM":
      return { ...state, history: [action.payload, ...state.history] };
    case "LOAD_HISTORY":
      return { ...state, history: action.payload };
    case "CLEAR_RESULT":
      return {
        ...state,
        renderResult: null,
        renderMimeType: null,
        renderError: null,
        renderProgress: 0,
      };
    default:
      return state;
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

export function useApp() {
  return useContext(AppContext);
}
