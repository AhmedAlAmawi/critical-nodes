import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ADVISORY_MODEL = "gemini-3.1-flash-lite-preview";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    const apiKey =
      request.headers.get("x-gemini-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key required." },
        { status: 401 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    switch (type) {
      case "concept-clarity": {
        const intent = data;
        const prompt = `You are a design mentor evaluating a student's visualization intent for an architectural project.

The student has provided these declarations:
- Concept Statement: ${intent.conceptStatement}
- Target User: ${intent.targetUser}
- Spatial Goal: ${intent.spatialGoal}
- Emotional Atmosphere: ${intent.emotionalAtmosphere}
- Behavior Reinforcement: ${intent.behaviorReinforcement}
- Image Type: ${intent.imageType}
- Intent Statement: ${intent.intentStatement}
${intent.socraticResponses ? `- Spatial Mechanism: ${intent.socraticResponses.spatialMechanism}
- Visual Moment: ${intent.socraticResponses.visualMoment}
- Opposite Description: ${intent.socraticResponses.oppositeDescription}
- Failure Scenario: ${intent.socraticResponses.failureScenario}` : ""}

Analyze this intent and respond with ONLY valid JSON in this exact format:
{
  "wellDefined": ["list of aspects that are clear and well-articulated"],
  "ambiguous": ["list of aspects that are vague or need more specificity"],
  "suggestions": ["list of specific suggestions to strengthen the intent"],
  "readings": ["1-2 targeted suggestions for reference (concepts, not full citations)"]
}`;

        const response = await ai.models.generateContent({
          model: ADVISORY_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0];
        if (!text || !("text" in text) || !text.text) {
          return NextResponse.json({ result: { wellDefined: [], ambiguous: ["Unable to analyze intent."], suggestions: [], readings: [] } });
        }

        try {
          const cleaned = text.text.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return NextResponse.json({ result: parsed });
        } catch {
          return NextResponse.json({
            result: { wellDefined: [], ambiguous: ["AI response could not be parsed."], suggestions: [text.text], readings: [] },
          });
        }
      }

      case "reference-alignment": {
        const { reference, intent } = data;
        const prompt = `You are a design mentor checking whether a student's visual reference aligns with their declared design intent.

Intent:
- Concept: ${intent.conceptStatement}
- Atmosphere: ${intent.emotionalAtmosphere}
- Spatial Goal: ${intent.spatialGoal}

Reference analysis:
- Lens: ${reference.lens}
- Framing: ${reference.framing}
- Tone: ${reference.tone}
- Emotion: ${reference.emotion}
- Color Temperature: ${reference.colorTemperature}
- Borrowing: ${(reference.borrowingCategories || []).join(", ")}
- Not Borrowing: ${reference.notBorrowing}

If this reference contradicts or misaligns with the declared intent, respond with a single clear advisory sentence (e.g., "This reference emphasizes X, but your intent emphasizes Y. Consider whether this tension is intentional.").
If they align well, respond with just the word "null".
Respond with ONLY valid JSON: {"alert": "your message or null"}`;

        const response = await ai.models.generateContent({
          model: ADVISORY_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0];
        if (!text || !("text" in text) || !text.text) {
          return NextResponse.json({ result: { alert: null } });
        }

        try {
          const cleaned = text.text.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return NextResponse.json({ result: { alert: parsed.alert === "null" ? null : parsed.alert } });
        } catch {
          return NextResponse.json({ result: { alert: null } });
        }
      }

      case "material-light": {
        const { materials, lighting } = data;
        const materialDesc = materials
          .map((m: { materialName: string; lightBehavior: string; tactileQuality: string }) =>
            `${m.materialName}: light behavior="${m.lightBehavior}", tactile="${m.tactileQuality}"`
          )
          .join("\n");

        const prompt = `You are a design mentor evaluating whether a student's material choices are consistent with their declared lighting setup.

Materials:
${materialDesc}

Lighting:
- Time of Day: ${lighting.timeOfDay}
- Source: ${lighting.lightSource}
- Contrast: ${lighting.contrastLevel}
- Shadow Intention: ${lighting.shadowIntention}
- Mood: ${lighting.moodProduced}
- Preset: ${lighting.preset}

Check for these issues:
1. Highly reflective surfaces under diffuse/flat lighting (reflections need directional light)
2. Material color temperature mismatches with declared lighting warmth/coolness
3. Too many competing "primary" materials (more than 2-3 dominant materials dilutes hierarchy)

Respond with ONLY valid JSON: {"flags": ["list of advisory warnings, or empty array if no issues"]}`;

        const response = await ai.models.generateContent({
          model: ADVISORY_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0];
        if (!text || !("text" in text) || !text.text) {
          return NextResponse.json({ result: { flags: [] } });
        }

        try {
          const cleaned = text.text.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return NextResponse.json({ result: parsed });
        } catch {
          return NextResponse.json({ result: { flags: [] } });
        }
      }

      case "sketch-evaluation": {
        const { sketchBase64, context } = data;
        const parts: Array<
          | { text: string }
          | { inlineData: { mimeType: string; data: string } }
        > = [];

        if (sketchBase64) {
          parts.push({
            inlineData: { mimeType: "image/jpeg", data: sketchBase64 },
          });
        }

        parts.push({
          text: `You are a design mentor evaluating a student's hand-drawn concept sketch or annotated diagram.

Context: ${context}

Analyze this sketch and provide constructive feedback:
1. What spatial concepts or design intentions are visible in the sketch?
2. What is clear and well-communicated?
3. What could be developed further?
4. How does this relate to their stated context?

Keep your response concise (3-5 sentences). Be encouraging but specific.`,
        });

        const response = await ai.models.generateContent({
          model: ADVISORY_MODEL,
          contents: [{ parts }],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0];
        if (!text || !("text" in text) || !text.text) {
          return NextResponse.json({ result: { feedback: "Unable to evaluate sketch at this time." } });
        }

        return NextResponse.json({ result: { feedback: text.text } });
      }

      default:
        return NextResponse.json(
          { error: `Unknown advisory type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Advisory request failed";
    console.error("Advisory error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
