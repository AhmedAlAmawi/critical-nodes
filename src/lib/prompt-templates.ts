export interface PromptTemplate {
  name: string;
  description: string;
  prompt: string;
}

export const promptTemplates: PromptTemplate[] = [
  {
    name: "Photorealistic Interior",
    description: "Natural lighting, high-end finishes",
    prompt:
      "Render this as a photorealistic interior visualization. Apply the reference materials to walls, floors, and ceiling surfaces. Place the reference furniture naturally in the space. Use warm natural lighting from windows with soft ambient fill. High-end architectural photography style, 8K quality, subtle depth of field.",
  },
  {
    name: "Warm & Natural",
    description: "Warm tones, organic materials, golden hour",
    prompt:
      "Create a warm, inviting interior render. Apply the reference materials with emphasis on natural wood tones and organic textures. Place furniture to create intimate conversation areas. Golden hour lighting streaming through windows, warm color temperature, cozy atmosphere. Architectural Digest photography style.",
  },
  {
    name: "Minimalist Modern",
    description: "Clean lines, neutral palette, dramatic lighting",
    prompt:
      "Render a minimalist modern interior. Apply materials with clean, seamless finishes. Place furniture with generous negative space between pieces. Cool, even lighting with dramatic shadow play. Monochromatic palette with subtle material variations. High-contrast architectural photography.",
  },
  {
    name: "Luxury Residential",
    description: "Premium materials, curated styling",
    prompt:
      "Create a luxury residential render. Apply the reference materials as premium finishes — marble, natural stone, rich fabrics. Place furniture as if styled by an interior designer with decorative accessories. Soft, flattering light from multiple sources. Vogue Living editorial photography style.",
  },
  {
    name: "Scandinavian",
    description: "Light woods, white walls, hygge atmosphere",
    prompt:
      "Render in Scandinavian design style. Apply light wood and white matte materials to surfaces. Place furniture in a relaxed, functional arrangement. Bright, diffused daylight flooding the space. Clean, airy atmosphere with plants and textiles for warmth. Nordic interior photography.",
  },
  {
    name: "Industrial Loft",
    description: "Exposed materials, raw textures, urban feel",
    prompt:
      "Create an industrial loft visualization. Apply raw materials — exposed brick, concrete, weathered metal. Place furniture mixing vintage industrial pieces with modern comfort. Dramatic directional lighting with warm Edison bulb accents. Urban, editorial photography with character.",
  },
  {
    name: "Exterior Facade",
    description: "Building exterior with landscaping",
    prompt:
      "Render the building exterior with photorealistic materials applied to the facade. Include realistic landscaping, sky, and ground plane. Late afternoon sunlight with long shadows. Architectural photography with slight upward perspective. Sharp details on material textures.",
  },
  {
    name: "Night Scene",
    description: "Evening ambiance, artificial lighting",
    prompt:
      "Render as a dramatic night scene. Apply materials with emphasis on how they look under artificial light. Warm interior glow visible through windows. Strategic accent lighting highlighting architectural features. Moody, atmospheric photography with deep shadows and warm highlights.",
  },
];

export function buildSystemPrompt(
  userPrompt: string,
  materialCount: number,
  furnitureCount: number
): string {
  const parts: string[] = [];

  parts.push(
    "You are rendering a photorealistic architectural visualization."
  );
  parts.push(
    "The first image is a 3D model screenshot that defines the spatial layout, geometry, and camera angle."
  );

  if (materialCount > 0) {
    const matRange =
      materialCount === 1 ? "image 2" : `images 2-${1 + materialCount}`;
    parts.push(
      `${matRange} ${materialCount === 1 ? "is a" : "are"} reference material/texture ${materialCount === 1 ? "sample" : "samples"} to apply to the surfaces in the scene.`
    );
  }

  if (furnitureCount > 0) {
    const furStart = 2 + materialCount;
    const furRange =
      furnitureCount === 1
        ? `Image ${furStart}`
        : `Images ${furStart}-${furStart + furnitureCount - 1}`;
    parts.push(
      `${furRange} ${furnitureCount === 1 ? "is a" : "are"} reference furniture/object ${furnitureCount === 1 ? "piece" : "pieces"} to place in the scene.`
    );
  }

  parts.push("");
  parts.push("User instructions:");
  parts.push(userPrompt);
  parts.push("");
  parts.push(
    "Maintain the exact camera angle and spatial proportions from the 3D model. Produce a photorealistic result with natural lighting, accurate material reflections, and realistic shadows."
  );

  return parts.join("\n");
}
