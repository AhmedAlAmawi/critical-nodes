/**
 * Concept phase content — verbatim port of §4.1 of malzama-investigation.md.
 *
 * The `referenceId` strings on academic citations, insights, and missions are
 * resolved at runtime: faculty-uploaded `sources` with matching titles take
 * precedence over the canonical academic library in
 * src/config/references-academic.json.
 */

import type { Phase } from "./types";

export const conceptPhase: Phase = {
  id: "concept",
  title: "Concept Phase",
  subtitle: "Framing the narrative",
  goal: "Define a clear design narrative before touching form or function.",
  conceptDefinition:
    "A concept is the central idea that gives your design a reason to exist. It is not about aesthetics — it is about intent. Every spatial decision should be traceable back to it.",
  academic: {
    source: "Bryan Lawson — How Designers Think",
    insight:
      "Design begins by framing the problem, not solving it. The concept is the lens through which every decision is filtered.",
  },
  example:
    "A café inspired by coastal erosion — layered seating zones that gradually descend toward a central 'tide pool' lounge, with rough concrete edges softened by clusters of warm light.",
  exampleExplanation:
    "Notice: the coastal erosion idea is not just a mood. It directly generates the spatial structure — the layers, the descent, the materiality. That is the difference between a concept and a theme.",
  questions: [
    "What type of space is this project?",
    "What is the primary atmosphere this space should create?",
    "What is the single idea or metaphor at the heart of your concept?",
    "How does that idea translate into the physical space?",
    "Complete this sentence: 'This space is fundamentally about…'",
  ],
  questionOptions: [
    ["Residential", "Hospitality", "Cultural", "Commercial", "Educational", "Other"],
    [
      "Calm & contemplative",
      "Energetic & social",
      "Intimate & personal",
      "Expansive & open",
      "Raw & honest",
      "Playful & unexpected",
    ],
    null,
    null,
    null,
  ],
  thinkResponses: [
    "Good. That context shapes everything.",
    "That atmosphere is your emotional target. Hold onto it.",
    "Good. Now you have something concrete to work from.",
    "That translation is the design. Don't lose it.",
    "That sentence is your compass.",
  ],
  questionInsights: [
    null,
    null,
    {
      text: "A concept is not a mood — it is a principle that generates form. Ask not what it looks like, but what logic it creates.",
      referenceId: "zumthor-thinking-architecture",
      visual: "/references/concept-principle.svg",
      caption: "Concept as generative principle — from idea to spatial logic",
      compare: false,
    },
    {
      text: "Every material, proportion, and light condition should be traceable back to the concept's inner logic.",
      referenceId: "lawson-how-designers-think",
      visual: "/references/concept-spatial.svg",
      caption: "One concept — multiple spatial decisions",
      compare: true,
    },
    null,
  ],
  driverQuestion: "What primarily drives your concept?",
  driverOptions: ["Emotion", "Material", "Narrative", "User ritual"],
  driverResponse: "That's your primary lens. It will make decisions easier.",
  reference: {
    image: "/references/concept-translation.svg",
    caption:
      "How a concept becomes spatial structure — not decoration, but organisation.",
    source: "Interior Design Studio — Concept Translation Diagram",
  },
  compareQuestion: "Compared to this example, where is your concept right now?",
  compareOptions: ["Clearly structured", "Still forming", "Very different direction"],
  compareResponse:
    "Good. Hold that honest assessment — it's more useful than confidence.",
  action: {
    instruction: "Stop. Produce your concept now.",
    description:
      "Sketch it, diagram it, or describe it in full. This is not a draft — commit to an idea.",
    placeholder:
      "Describe your concept. What does it look like? How does it feel? What does it communicate?",
  },
  missionsIntro:
    "You can explore your concept through multiple diagram types. The first is required — the rest will strengthen your idea.",
  missions: [
    {
      id: "concept-core",
      title: "Concept Diagram",
      required: true,
      referenceId: "zumthor-thinking-architecture",
      insight:
        "A concept diagram is not decoration — it is a spatial argument made visible. Draw the idea, not the building.",
      visual: "/references/concept-translation.svg",
      caption:
        "How a concept becomes spatial structure — from principle to organisation",
      task: "Draw or upload a diagram that shows your concept as a spatial idea. It can be abstract — but it must communicate your core principle, not just your aesthetic.",
      outputKey: "primary",
      placeholder: "Describe what your concept diagram communicates (optional)",
    },
    {
      id: "bubble",
      title: "Bubble Diagram",
      required: false,
      referenceId: "ching-form-space-order",
      insight:
        "A bubble diagram tests spatial relationships before committing to form. Proximity here is an argument.",
      visual: "/references/zoning-adjacency.svg",
      caption:
        "Spatial relationships — which zones need to be adjacent, buffered, or separate",
      task: "Draw the key spaces as bubbles and show how they relate. Focus on adjacency and proximity — not shape or scale.",
      outputKey: "bubble",
      placeholder: "Notes on your spatial relationships (optional)",
    },
    {
      id: "circulation",
      title: "Circulation Diagram",
      required: false,
      referenceId: "lynch-image-of-the-city",
      insight:
        "Circulation is the invisible architecture — the path through space gives it its meaning and rhythm.",
      visual: "/references/zoning-journey.svg",
      caption: "Spatial sequence — entry, movement, destination",
      task: "Draw how a person moves through your space. Mark the entry, the main path, and the destination. What do they experience at each moment?",
      outputKey: "circulation",
      placeholder: "Describe the movement experience (optional)",
    },
    {
      id: "massing",
      title: "Massing / Volume Diagram",
      required: false,
      referenceId: "ching-form-space-order",
      insight:
        "Volume is where concept meets construction. How does your idea translate into mass, scale, and proportion?",
      visual: "/references/concept-principle.svg",
      caption: "Concept as generative principle — how idea becomes form",
      task: "Sketch or upload a simple 3D massing diagram — block volumes that communicate your concept's spatial logic. No details, no finishes.",
      outputKey: "massing",
      placeholder: "Describe the volume relationships (optional)",
    },
  ],
  reflection: [
    "Does your concept clearly connect to your user's experience?",
    "What part of your concept is still vague or unresolved?",
    "What is the strongest element of your concept so far?",
    "If you had to reduce this to one sentence, what would it be?",
  ],
  reflectChoices: ["Yes", "Not really", "Not sure"],
  reflectResponses: [
    "Naming the gap is the first step to closing it.",
    "Build from what's working.",
    "One sentence. That's your compass.",
  ],
};
