/**
 * Spatial Translation Opportunities — keyword library lifted verbatim
 * from §5.6 of malzama-investigation.md.
 *
 * Used during Concept Synthesis: runs (Q3 + Q5 + actText) through this table
 * and returns up to 3 suggestions for the matched group. Falls back to the
 * generic studio principles if nothing matches.
 */

export const SPATIAL_TRANSLATION_GROUPS: Array<{
  triggers: string[];
  suggestions: string[];
}> = [
  {
    triggers: ["erosion", "layer", "layers", "descent", "descend", "strata", "sediment"],
    suggestions: [
      "Descending level changes from entry to core",
      "Layered circulation — user moves through strata",
      "Progressive spatial compression toward the centre",
    ],
  },
  {
    triggers: ["flow", "fluid", "fluidity", "wave", "current", "drift"],
    suggestions: [
      "Continuous circulation without hard stops",
      "Visual connections maintained across zones",
      "Gradual, curved transitions between spaces",
    ],
  },
  {
    triggers: ["tension", "contrast", "duality", "opposing", "conflict", "balance"],
    suggestions: [
      "Opposing material palettes that meet at a threshold",
      "Compression and release sequences along the main axis",
      "Threshold moments that mark conceptual shifts",
    ],
  },
  {
    triggers: ["nature", "organic", "growth", "botanical", "natural", "biophilic"],
    suggestions: [
      "Organic plan geometry that resists rigid grids",
      "Natural material hierarchy — raw to refined",
      "Biomorphic spatial volumes with irregular edges",
    ],
  },
  {
    triggers: ["light", "shadow", "dark", "luminous", "glow", "beam"],
    suggestions: [
      "Strategic daylight control to define zones",
      "Gradient lighting sequences guiding movement",
      "Shadow used as a spatial boundary, not just absence of light",
    ],
  },
  {
    triggers: ["memory", "nostalgia", "past", "history", "time", "archive"],
    suggestions: [
      "Layered material surfaces suggesting temporal depth",
      "Temporal sequences — past to present along circulation",
      "Objects and textures as mnemonic anchors",
    ],
  },
  {
    triggers: ["silence", "still", "quiet", "calm", "retreat", "sanctuary"],
    suggestions: [
      "Acoustic gradients from active zones to quiet core",
      "Visual stillness reinforced through material restraint",
      "Buffer spaces that decompress users before arrival",
    ],
  },
  {
    triggers: ["community", "social", "gather", "collective", "shared", "together"],
    suggestions: [
      "Flexible gathering configurations around a central node",
      "Social edge conditions — seating that faces outward",
      "Shared threshold spaces that encourage encounter",
    ],
  },
  {
    triggers: ["journey", "path", "sequence", "narrative", "story", "procession"],
    suggestions: [
      "Clear spatial sequence with a defined beginning and end",
      "Moments of pause and reveal along the route",
      "Hierarchy of spaces that builds toward a climax",
    ],
  },
  {
    triggers: ["fragment", "ruin", "incomplete", "trace", "remnant"],
    suggestions: [
      "Exposed structural elements as conceptual artifacts",
      "Deliberate voids and gaps in the spatial envelope",
      "Material incompleteness as design intention",
    ],
  },
];

export const STUDIO_PRINCIPLES_FALLBACK = [
  "Establish a clear spatial hierarchy: primary, secondary, peripheral",
  "Create intentional transition moments between activity zones",
  "Use materiality to reinforce the concept's atmosphere",
  "Define circulation that supports — not fights — the concept logic",
];

export function spatialTranslationFor(text: string): string[] {
  const lower = text.toLowerCase();
  for (const group of SPATIAL_TRANSLATION_GROUPS) {
    if (group.triggers.some((t) => lower.includes(t))) return group.suggestions;
  }
  return STUDIO_PRINCIPLES_FALLBACK;
}
