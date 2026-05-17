/**
 * Zoning phase content — verbatim port of §4.2 of malzama-investigation.md.
 */

import type { Phase } from "./types";

export const zoningPhase: Phase = {
  id: "zoning",
  title: "Zoning Phase",
  subtitle: "Organising space and flow",
  goal: "Translate your concept into spatial logic — define zones, relationships, and movement.",
  conceptDefinition:
    "Zoning is how you turn an idea into inhabitable space. It is not floor plan divisions — it is the choreography of how people move, pause, and experience the space you designed.",
  academic: {
    source: "Francis D.K. Ching — Architecture: Form, Space & Order",
    insight:
      "Zoning is not about dividing space — it is about orchestrating experience. Every boundary you draw creates a transition, and every transition communicates intention.",
  },
  example:
    "A library zoned not by function but by energy level — from loud collaborative zones at the entrance fading into a deep silence zone at the core, with transitional buffer spaces in between.",
  exampleExplanation:
    "The organising logic here is energy, not function. That's what makes it spatial storytelling — each zone tells you something about where you are in the experience.",
  questions: [
    "What are the primary activities this space needs to support?",
    "Which zones need to be adjacent — and which need separation?",
    "Where does the journey begin, and how does it unfold?",
    "What is the spatial hierarchy — primary, secondary, peripheral?",
  ],
  questionOptions: [null, null, null, null],
  thinkResponses: [
    "Good. Now think about where those activities conflict.",
    "Proximity reveals priority. Interesting.",
    "The journey is the design. Keep going.",
    "Hierarchy gives space its meaning.",
  ],
  questionInsights: [
    null,
    {
      text: "Adjacency is not convenience — it is argument. Which spaces touch each other communicates the relationship between activities.",
      referenceId: "ching-form-space-order",
      visual: "/references/zoning-adjacency.svg",
      caption: "Adjacency matrix — which zones should relate, which need separation",
      compare: false,
    },
    {
      text: "The sequence of spaces is the experience. Entry, threshold, and core are choreographic decisions — not logistical ones.",
      referenceId: "pallasmaa-eyes-of-the-skin",
      visual: "/references/zoning-journey.svg",
      caption: "Spatial sequence — from arrival to core",
      compare: true,
    },
    {
      text: "Hierarchy determines what the eye reads first. Without hierarchy, space becomes noise.",
      referenceId: "ching-form-space-order",
      visual: "/references/zoning-hierarchy.svg",
      caption: "Spatial hierarchy — primary, secondary, peripheral",
      compare: false,
    },
  ],
  driverQuestion: "What primarily organises your zones?",
  driverOptions: ["Activity type", "Energy level", "Privacy", "User journey"],
  driverResponse: "That logic will shape everything else.",
  reference: {
    image: "/references/zoning-hierarchy.svg",
    caption:
      "Spatial hierarchy with primary, secondary, and quiet zones connected by circulation.",
    source: "F.D.K. Ching — Architecture: Form, Space & Order",
  },
  compareQuestion: "Comparing your layout to this diagram, what do you notice?",
  compareOptions: ["Clear hierarchy", "Hierarchy unclear", "Different approach"],
  compareResponse:
    "Good observation. Clarity of hierarchy is the first thing a critic sees.",
  action: {
    instruction: "Stop. Draw or describe your zoning plan now.",
    description:
      "Create a bubble diagram, sketch a rough floor plan, or describe the spatial layout in detail.",
    placeholder:
      "Describe your zoning layout. What zones exist? How do they connect? How does a user move through the space?",
  },
  missions: [
    {
      id: "adjacency",
      title: "Adjacency Diagram",
      required: true,
      referenceId: "ching-form-space-order",
      insight:
        "Adjacency is not convenience — it is argument. Which spaces touch each other communicates the relationship between activities.",
      visual: "/references/zoning-adjacency.svg",
      caption: "Adjacency matrix — adjacent, buffered, separated",
      task: "Map which spaces must be adjacent, which need a transitional buffer, and which need clear separation. Use a matrix, a bubble diagram, or a sketch.",
      outputKey: "adjacency",
      placeholder: "Describe your adjacency logic",
    },
    {
      id: "zones",
      title: "Zoning Plan",
      required: true,
      referenceId: "ching-form-space-order",
      insight:
        "Zoning is not about dividing space — it is about orchestrating experience. Every boundary is a decision.",
      visual: "/references/zoning-hierarchy.svg",
      caption: "Spatial hierarchy — primary, secondary, peripheral zones",
      task: "Draw a plan showing all zones with clear boundaries. Label each zone with its primary function and energy level — loud, medium, quiet.",
      outputKey: "zones",
      placeholder: "Describe how your zones are organised",
    },
    {
      id: "circulation",
      title: "Circulation Diagram",
      required: true,
      referenceId: "lynch-image-of-the-city",
      insight:
        "Movement is not a path between spaces — it is the experience of the design unfolding in time.",
      visual: "/references/zoning-journey.svg",
      caption: "Spatial sequence — entry, threshold, primary, core",
      task: "Draw the primary circulation routes. Mark how users enter, move through, and exit. Distinguish the main path from secondary routes.",
      outputKey: "circulation",
      placeholder: "Describe the circulation logic",
    },
    {
      id: "blockPlan",
      title: "Block Plan",
      required: true,
      referenceId: "ching-form-space-order",
      insight:
        "The block plan is where strategy becomes commitment. Every boundary you confirm is a spatial thesis.",
      visual: "/references/concept-spatial.svg",
      caption: "Concept → spatial decisions — confirming the design logic",
      task: "Draw your final block plan — confirmed zones, confirmed circulation, confirmed relationships. This is your spatial thesis. Every decision counts.",
      outputKey: "blockPlan",
      placeholder: "Describe your final spatial decisions",
    },
  ],
  reflection: [
    "Does your zoning logic support your concept narrative?",
    "Are there any conflicts or ambiguities in how zones relate?",
    "What zone feels most resolved? What needs more thinking?",
    "How does the user journey through the space tell the design story?",
  ],
  reflectChoices: ["Yes", "Not quite", "Not sure"],
  reflectResponses: [
    "Naming the conflict is the first step to resolving it.",
    "Build from what's resolved.",
    "That journey is your thesis.",
  ],
};
